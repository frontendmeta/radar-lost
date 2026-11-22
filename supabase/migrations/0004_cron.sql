-- Lost Sale Radar: pg_cron tick that POSTs process-run every minute via pg_net.
-- URL and secret come from Vault (names processor_url, processor_secret), set once per environment
-- by supabase/scripts/processor-secrets.sql. Missing secrets never error: the tick records
-- last_kick_status = 'missing_secret' and tasks wait (GET /api/health shows it).
-- Safe to re-apply.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function kick_processor() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url     text;
  v_secret  text;
  v_prev    bigint;
  v_status  text;
  v_req     bigint;
  r         record;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'processor_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'processor_secret' limit 1;

  if coalesce(btrim(v_url), '') = '' or coalesce(btrim(v_secret), '') = '' then
    insert into app_config (key, value) values ('last_kick_status', 'missing_secret')
    on conflict (key) do update set value = excluded.value;
    return;
  end if;

  -- Outcome of the previous kick (pg_net is async, so this one's response isn't in yet).
  select case when value ~ '^\d+$' then value::bigint end into v_prev
  from app_config where key = 'last_kick_request_id';
  if v_prev is not null then
    select status_code, error_msg, timed_out into r from net._http_response where id = v_prev;
    if found then
      v_status := coalesce(r.status_code::text, nullif(r.error_msg, ''),
                           case when r.timed_out then 'timeout' end);
    end if;
  end if;

  v_req := net.http_post(
    url                  := v_url,
    body                 := '{}'::jsonb,
    headers              := jsonb_build_object('content-type', 'application/json', 'x-processor-secret', v_secret),
    timeout_milliseconds := 5000
  );

  insert into app_config (key, value) values
    ('last_kick_at',         to_jsonb(now()) #>> '{}'),
    ('last_kick_status',     coalesce(v_status, 'sent')),
    ('last_kick_request_id', v_req::text)
  on conflict (key) do update set value = excluded.value;
end $$;

revoke all on function kick_processor() from public, anon, authenticated;
grant execute on function kick_processor() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-run-tick') then
    perform cron.unschedule('process-run-tick');
  end if;
end $$;

select cron.schedule('process-run-tick', '* * * * *', 'select public.kick_processor()');
