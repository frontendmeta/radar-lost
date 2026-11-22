-- Settings writes that must be atomic.

-- Query wording is frozen: an edit archives the old row and inserts a new version with the
-- same code and replaces_id = old id, in one transaction. Old tasks keep their prompt_text
-- and still point at the old (archived) row. Returns the new version.
create or replace function settings_replace_query(
  p_old_id        uuid,
  p_text          text,
  p_product_id    uuid,
  p_budget_inr    int,
  p_city          text,
  p_deadline_days int
) returns queries
language plpgsql
set search_path = public
as $$
declare
  v_old queries;
  v_new queries;
begin
  select * into v_old from queries where id = p_old_id and archived_at is null for update;
  if not found then
    raise exception 'not_found: query % is unknown or archived', p_old_id;
  end if;
  if not exists (select 1 from products where id = p_product_id and archived_at is null) then
    raise exception 'bad_query: product % is unknown or archived', p_product_id;
  end if;

  -- Archive first: queries_code_active allows one active row per code.
  update queries set archived_at = now() where id = v_old.id;

  insert into queries (code, text, product_id, budget_inr, city, deadline_days, attributes, replaces_id)
  values (v_old.code, p_text, p_product_id, p_budget_inr, p_city, p_deadline_days, v_old.attributes, v_old.id)
  returning * into v_new;

  return v_new;
end $$;

revoke all on function settings_replace_query(uuid, text, uuid, int, text, int) from public, anon, authenticated;
grant execute on function settings_replace_query(uuid, text, uuid, int, text, int) to service_role;
