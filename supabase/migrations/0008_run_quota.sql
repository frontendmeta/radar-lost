-- One run per signed-in user, except admins.
-- Admins: comma list in app_config key 'admin_emails' (set per environment with SQL, never committed).
-- Applies only to runs created by a real signed-in user (created_by not null); the AUTH_DISABLED demo
-- user has no id, so local development is unaffected. An advisory lock per email serializes
-- concurrent creates, so parallel requests can't slip a second run through.

create or replace function enforce_run_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email  text := lower(btrim(coalesce(new.created_by_email, '')));
  v_admins text[];
begin
  if new.created_by is null then
    return new;
  end if;

  select coalesce(array_agg(lower(btrim(a))), '{}')
    into v_admins
    from app_config c, unnest(string_to_array(coalesce(c.value, ''), ',')) a
   where c.key = 'admin_emails' and btrim(a) <> '';

  if v_email <> '' and v_email = any(v_admins) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('run_quota:' || coalesce(nullif(v_email, ''), new.created_by::text)));

  if exists (
    select 1 from runs r
     where r.created_by = new.created_by
        or (v_email <> '' and lower(r.created_by_email) = v_email)
  ) then
    raise exception 'run_limit: You have used your one run. Ask the owner if you need another.';
  end if;

  return new;
end $$;

revoke all on function enforce_run_quota() from public, anon, authenticated;

drop trigger if exists runs_enforce_quota on runs;
create trigger runs_enforce_quota
  before insert on runs
  for each row execute function enforce_run_quota();
