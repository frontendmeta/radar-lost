-- Provider API keys entered in the Settings UI, encrypted at rest in Supabase Vault.
-- The plaintext never lives in a public table: provider_keys holds only the Vault secret id,
-- the last 4 characters (for display) and who saved it. Only service_role can execute these
-- functions; only process-run calls get_provider_keys(). Keys are workspace-wide (one set),
-- stamped with the saving user's email.

create table if not exists provider_keys (
  assistant        text primary key references assistants(id),
  secret_id        uuid not null,           -- vault.secrets.id
  last4            text not null,
  updated_by_email text,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
alter table provider_keys enable row level security;
revoke all on provider_keys from anon, authenticated;

-- Save (create or replace) one assistant's key. Marks the assistant key_present at once so
-- create_run accepts it without waiting for the processor's next tick.
create or replace function set_provider_key(p_assistant text, p_key text, p_email text default null)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_key text := btrim(coalesce(p_key, ''));
  v_secret uuid;
begin
  if not exists (select 1 from assistants where id = p_assistant) then
    raise exception 'bad_assistant: unknown assistant %', p_assistant;
  end if;
  if length(v_key) < 20 or length(v_key) > 400 or v_key ~ '\s' then
    raise exception 'bad_key: the key looks malformed (20–400 characters, no spaces)';
  end if;

  select secret_id into v_secret from provider_keys where assistant = p_assistant for update;
  if v_secret is not null and exists (select 1 from vault.secrets where id = v_secret) then
    perform vault.update_secret(v_secret, v_key);
  else
    -- Vault secret names are unique; drop a stale one left without a provider_keys row.
    delete from vault.secrets where name = 'provider_key_' || p_assistant;
    v_secret := vault.create_secret(v_key, 'provider_key_' || p_assistant, 'Lost Sale Radar ' || p_assistant || ' API key');
  end if;

  insert into provider_keys (assistant, secret_id, last4, updated_by_email, updated_at)
  values (p_assistant, v_secret, right(v_key, 4), p_email, now())
  on conflict (assistant) do update
    set secret_id = excluded.secret_id, last4 = excluded.last4,
        updated_by_email = excluded.updated_by_email, updated_at = now();

  update assistants set key_present = true where id = p_assistant;
end $$;

-- Remove a UI key. key_present goes false; the processor sets it back to true on its next
-- tick if an env key exists for that provider.
create or replace function delete_provider_key(p_assistant text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare v_secret uuid;
begin
  delete from provider_keys where assistant = p_assistant returning secret_id into v_secret;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
  update assistants set key_present = false where id = p_assistant;
end $$;

-- Display metadata only (never the key).
create or replace function provider_key_info()
returns table (assistant text, last4 text, updated_by_email text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select assistant, last4, updated_by_email, updated_at from provider_keys order by assistant;
$$;

-- Decrypted keys for process-run only.
create or replace function get_provider_keys()
returns table (assistant text, api_key text)
language sql
security definer
set search_path = public, vault
as $$
  select pk.assistant, ds.decrypted_secret
  from provider_keys pk
  join vault.decrypted_secrets ds on ds.id = pk.secret_id;
$$;

revoke all on function set_provider_key(text, text, text) from public, anon, authenticated;
revoke all on function delete_provider_key(text)          from public, anon, authenticated;
revoke all on function provider_key_info()                from public, anon, authenticated;
revoke all on function get_provider_keys()                from public, anon, authenticated;
grant execute on function set_provider_key(text, text, text) to service_role;
grant execute on function delete_provider_key(text)          to service_role;
grant execute on function provider_key_info()                to service_role;
grant execute on function get_provider_keys()                to service_role;
