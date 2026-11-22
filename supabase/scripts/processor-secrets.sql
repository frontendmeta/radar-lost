-- Create or update the two Vault secrets the pg_cron tick (0004_cron.sql) reads:
--   processor_url     where the DB posts process-run
--   processor_secret  sent as x-processor-secret; must equal the function's PROCESSOR_SECRET
-- Run once per environment (re-running updates both). Never commit the real secret.
--
-- Local (URL as seen from inside the DB container; the secret is read from the gitignored env file):
--   SECRET=$(grep '^PROCESSOR_SECRET=' supabase/functions/.env | cut -d= -f2-)
--   docker exec -i supabase_db_lost-sale-radar psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     -v url='http://host.docker.internal:55321/functions/v1/process-run' -v secret="$SECRET" \
--     < supabase/scripts/processor-secrets.sql
--   Fallback URL if host.docker.internal is unreachable: http://supabase_kong_lost-sale-radar:8000/functions/v1/process-run
--
-- Hosted:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -v url='https://<project-ref>.supabase.co/functions/v1/process-run' -v secret="$SECRET" \
--     -f supabase/scripts/processor-secrets.sql
--   (Dashboard SQL editor has no psql variables: run the DO block below with the two values inlined,
--    or call vault.create_secret('<value>', 'processor_url') / vault.update_secret(id, '<value>').)

\if :{?url}
\else
  \echo 'usage: psql -v url=<process-run URL> -v secret=<PROCESSOR_SECRET> -f supabase/scripts/processor-secrets.sql'
  \quit
\endif
\if :{?secret}
\else
  \echo 'usage: psql -v url=<process-run URL> -v secret=<PROCESSOR_SECRET> -f supabase/scripts/processor-secrets.sql'
  \quit
\endif

-- Pass the values through session settings so the DO block can read them (psql doesn't
-- interpolate inside dollar quotes). Nothing secret is echoed.
select length(set_config('lsr.processor_url', :'url', false)) > 0    as url_set,
       length(set_config('lsr.processor_secret', :'secret', false)) > 0 as secret_set;

do $$
declare
  v_url    text := current_setting('lsr.processor_url');
  v_secret text := current_setting('lsr.processor_secret');
  v_id     uuid;
begin
  if btrim(v_url) = '' or btrim(v_secret) = '' then
    raise exception 'url and secret must both be non-empty';
  end if;

  select id into v_id from vault.secrets where name = 'processor_url';
  if v_id is null then
    perform vault.create_secret(v_url, 'processor_url', 'process-run URL for the pg_cron tick');
  else
    perform vault.update_secret(v_id, v_url);
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name = 'processor_secret';
  if v_id is null then
    perform vault.create_secret(v_secret, 'processor_secret', 'x-processor-secret header for process-run');
  else
    perform vault.update_secret(v_id, v_secret);
  end if;
end $$;

select set_config('lsr.processor_url', '', false) is not null as cleared,
       set_config('lsr.processor_secret', '', false) is not null as cleared_secret;

select name, length(decrypted_secret) as length
from vault.decrypted_secrets where name in ('processor_url', 'processor_secret') order by name;
