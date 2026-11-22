-- Lost Sale Radar: run lifecycle functions (create, claim, save, retry, sweep, finish, fixes, health).
-- Safe to re-apply: every function is `create or replace`. Execute is granted to service_role only.
-- Refusals raise '<code>: <message>'; the Next.js layer maps the prefix to a 400 with that code.
--
-- app_config keys used here (values are text; timestamps are ISO 8601):
--   lease_until, breaker_until_<assistant>, fails_in_row_<assistant>, env_model_<assistant>,
--   fixes_started_<run_id> (set by claim_fixes, cleared by sweep_stuck), last_kick_* (0004_cron.sql).
--
-- Task lifecycle: pending -> answering -> answered -> extracting -> done; failed / cancelled are terminal.
-- tries counts claims since the last saved answer (save_answer resets it); 3 tries -> failed.

-- Helpers ---------------------------------------------------------------------

create or replace function _iso(p_ts timestamptz) returns text
language sql stable set search_path = public as $$
  select to_jsonb(p_ts) #>> '{}'
$$;

-- Lenient text -> timestamptz; garbage gives null instead of an error.
create or replace function _ts(p_value text) returns timestamptz
language plpgsql stable set search_path = public as $$
begin
  if p_value is null or btrim(p_value) = '' then return null; end if;
  return p_value::timestamptz;
exception when others then
  return null;
end $$;

create or replace function _cfg(p_key text) returns text
language sql stable set search_path = public as $$
  select value from app_config where key = p_key
$$;

create or replace function _cfg_set(p_key text, p_value text) returns void
language sql set search_path = public as $$
  insert into app_config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value
$$;

-- JSON field readers that never throw on a wrong type.
create or replace function _jint(p_value jsonb) returns int
language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(p_value) = 'number' then round((p_value #>> '{}')::numeric)::int
    when jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^\s*-?\d+(\.\d+)?\s*$'
      then round((p_value #>> '{}')::numeric)::int
    else null end
$$;

create or replace function _juuids(p_value jsonb) returns uuid[]
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p_value) = 'array'
    then coalesce((select array_agg(distinct x::uuid) from jsonb_array_elements_text(p_value) x
                   where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'), '{}'::uuid[])
    else '{}'::uuid[] end
$$;

create or replace function _jtri(p_value text) returns tri
language sql immutable set search_path = public as $$
  select case when p_value in ('yes', 'no', 'unknown') then p_value::tri else 'unknown'::tri end
$$;

-- 1. create_run -----------------------------------------------------------------
create or replace function create_run(
  p_assistants     text[],
  p_attempts       int,
  p_query_ids      uuid[]      default null,
  p_label          text        default null,
  p_trigger        run_trigger default 'manual',
  p_user_id        uuid        default null,
  p_user_email     text        default null,
  p_default_models jsonb       default '{}'
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_settings   settings;
  v_assistants text[];
  v_attempts   int;
  v_query_ids  uuid[];
  v_a          text;
  v_row        assistants;
  v_model      text;
  v_models     jsonb := '{}';
  v_bad        uuid;
  v_n          int;
  v_run_id     uuid;
begin
  select * into v_settings from settings where id = 1;
  if not found then
    raise exception 'not_seeded: settings row is missing; run supabase/seed.sql';
  end if;

  v_attempts := coalesce(p_attempts, v_settings.default_attempts);
  if v_attempts < 1 or v_attempts > 5 then
    raise exception 'bad_attempts: attempts must be between 1 and 5 (got %)', v_attempts;
  end if;

  -- Assistants: null = every enabled one. Order kept, duplicates dropped.
  if p_assistants is null then
    select array_agg(id order by array_position(array['openai','anthropic','gemini'], id))
      into v_assistants from assistants where enabled;
    if v_assistants is null then
      raise exception 'assistant_disabled: no assistant is enabled';
    end if;
  else
    select array_agg(x order by o) into v_assistants
    from (select x, min(o) o from unnest(p_assistants) with ordinality u(x, o) group by x) d;
    if v_assistants is null then
      raise exception 'bad_assistant: choose at least one assistant';
    end if;
  end if;

  foreach v_a in array v_assistants loop
    select * into v_row from assistants where id = v_a;
    if not found then
      raise exception 'bad_assistant: unknown assistant "%" (allowed: openai, anthropic, gemini)', v_a;
    end if;
    if not v_row.enabled then
      raise exception 'assistant_disabled: % is disabled in Settings', v_a;
    end if;
    if not v_row.key_present then
      raise exception 'key_missing: % has no API key', v_a;
    end if;
    v_model := coalesce(nullif(btrim(v_row.model), ''),
                        nullif(btrim(_cfg('env_model_' || v_a)), ''),
                        nullif(btrim(coalesce(p_default_models, '{}'::jsonb) ->> v_a), ''));
    if v_model is null then
      raise exception 'model_unknown: no model configured for %', v_a;
    end if;
    v_models := v_models || jsonb_build_object(v_a, v_model);
  end loop;

  -- Queries: null = every active one. Order kept, duplicates dropped.
  if p_query_ids is null then
    select array_agg(id order by code) into v_query_ids from queries where archived_at is null;
    if v_query_ids is null then
      raise exception 'bad_query: there are no active queries';
    end if;
  else
    select x into v_bad from unnest(p_query_ids) x
    where x is null or not exists (select 1 from queries q where q.id = x and q.archived_at is null)
    limit 1;
    if found then
      raise exception 'bad_query: query % is unknown or archived', coalesce(v_bad::text, 'null');
    end if;
    select array_agg(x order by o) into v_query_ids
    from (select x, min(o) o from unnest(p_query_ids) with ordinality u(x, o) group by x) d;
    if v_query_ids is null then
      raise exception 'bad_query: choose at least one query';
    end if;
  end if;

  v_n := cardinality(v_query_ids) * cardinality(v_assistants) * v_attempts;
  if v_n > 300 then
    raise exception 'too_many_tasks: % tasks requested; the limit is 300', v_n;
  end if;

  insert into runs (label, trigger, assistants, attempts, query_ids, city, created_by, created_by_email)
  values (nullif(btrim(p_label), ''), coalesce(p_trigger, 'manual'), v_assistants, v_attempts, v_query_ids,
          v_settings.city, p_user_id, p_user_email)
  returning id into v_run_id;

  insert into tasks (run_id, query_id, assistant, model, attempt, prompt_text)
  select v_run_id, q.id, a.x, v_models ->> a.x, g.n, q.text
  from unnest(v_query_ids) qi(id)
  join queries q on q.id = qi.id
  cross join unnest(v_assistants) a(x)
  cross join generate_series(1, v_attempts) g(n);

  return v_run_id;
end $$;

-- 9. finish_run_if_done (defined early: other functions call it) ----------------
create or replace function finish_run_if_done(p_run_id uuid) returns bool
language plpgsql set search_path = public as $$
declare
  v_open int; v_done int; v_failed int; v_cancelled int; v_total int;
  v_closed uuid;
begin
  -- Serialize closers of the same run, then count with a fresh snapshot.
  perform 1 from runs where id = p_run_id and status in ('queued', 'processing') for update;
  if not found then return false; end if;

  select count(*) filter (where status in ('pending', 'answering', 'answered', 'extracting')),
         count(*) filter (where status = 'done'),
         count(*) filter (where status = 'failed'),
         count(*) filter (where status = 'cancelled'),
         count(*)
    into v_open, v_done, v_failed, v_cancelled, v_total
  from tasks where run_id = p_run_id;

  if v_open > 0 then return false; end if;

  update runs set
    status = case
      when v_done = v_total and v_total > 0 then 'done'::run_status
      when v_done = 0 and v_cancelled = 0 then 'failed'::run_status      -- every task failed
      when v_done = 0 then 'cancelled'::run_status                       -- stopped before anything finished
      else 'partial'::run_status end,
    finished_at = now()
  where id = p_run_id and status in ('queued', 'processing')
  returning id into v_closed;

  return v_closed is not null;
end $$;

-- 2. claim_tasks -----------------------------------------------------------------
create or replace function claim_tasks(p_limit int, p_lease_seconds int) returns setof tasks
language plpgsql set search_path = public as $$
declare
  v_lease   interval := make_interval(secs => greatest(coalesce(p_lease_seconds, 180), 1));
  v_room    jsonb;
  v_open    text[];
  v_ids     uuid[] := '{}';
  v_room_a  int;
  v_runs    uuid[];
  v_run     uuid;
  r         record;
begin
  if coalesce(p_limit, 0) <= 0 then return; end if;

  -- Pending tasks of an assistant disabled since the run began are cancelled.
  with c as (
    update tasks t set status = 'cancelled', error = 'assistant_disabled', locked_until = null
    from assistants a
    where a.id = t.assistant and not a.enabled and t.status = 'pending'
    returning t.run_id
  )
  select array_agg(distinct run_id) into v_runs from c;
  if v_runs is not null then
    foreach v_run in array v_runs loop perform finish_run_if_done(v_run); end loop;
  end if;

  -- Free answering slots per assistant (live leases only).
  select coalesce(jsonb_object_agg(a.id, a.max_in_flight - coalesce(f.n, 0)), '{}'::jsonb) into v_room
  from assistants a
  left join (select assistant, count(*)::int n from tasks
             where status = 'answering' and locked_until > now() group by assistant) f on f.assistant = a.id;

  -- Open breakers.
  select coalesce(array_agg(substr(key, length('breaker_until_') + 1)), '{}') into v_open
  from app_config where key like 'breaker\_until\_%' and _ts(value) > now();

  for r in
    select t.id, t.status, t.assistant
    from tasks t
    join runs ru on ru.id = t.run_id
    join assistants a on a.id = t.assistant
    where t.status in ('answered', 'pending')
      and ru.status in ('queued', 'processing')
      and (t.locked_until is null or t.locked_until <= now())
      and (t.status = 'answered' or (a.enabled and not (t.assistant = any (v_open))))
    order by (t.status = 'pending'),                                         -- answered (extract) first
             cardinality(ru.query_ids) * cardinality(ru.assistants) * ru.attempts,  -- small runs first
             ru.created_at, t.attempt, t.created_at, t.id                    -- oldest first
    for update of t skip locked
  loop
    if r.status = 'pending' then
      v_room_a := coalesce((v_room ->> r.assistant)::int, 0);
      continue when v_room_a <= 0;
      v_room := jsonb_set(v_room, array[r.assistant], to_jsonb(v_room_a - 1));
    end if;
    v_ids := v_ids || r.id;
    exit when cardinality(v_ids) >= p_limit;
  end loop;

  if cardinality(v_ids) = 0 then return; end if;

  update runs set status = 'processing', started_at = coalesce(started_at, now())
  where status = 'queued' and id in (select run_id from tasks where id = any (v_ids));

  return query
  update tasks t set
    status          = case when t.status = 'answered' then 'extracting'::task_status else 'answering'::task_status end,
    tries           = t.tries + 1,
    locked_until    = now() + v_lease,
    call_started_at = null
  where t.id = any (v_ids)
  returning t.*;
end $$;

-- 3. take_lease / release_lease --------------------------------------------------
create or replace function take_lease(p_seconds int) returns bool
language plpgsql set search_path = public as $$
declare v_ok bool;
begin
  insert into app_config (key, value)
  values ('lease_until', _iso(now() + make_interval(secs => greatest(coalesce(p_seconds, 150), 1))))
  on conflict (key) do update set value = excluded.value
  where _ts(app_config.value) is null or _ts(app_config.value) <= now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

create or replace function release_lease() returns void
language sql set search_path = public as $$
  update app_config set value = null where key = 'lease_until'
$$;

-- 4. sweep_stuck -------------------------------------------------------------------
create or replace function sweep_stuck() returns int
language plpgsql set search_path = public as $$
declare
  v_total int := 0;
  v_n     int;
  v_run   uuid;
begin
  -- a. Answer already saved: forward to answered, never call the provider again.
  update tasks t set status = 'answered', answered_at = coalesce(t.answered_at, now()),
         tries = 0, locked_until = null, call_started_at = null
  where t.status = 'answering' and (t.locked_until is null or t.locked_until <= now())
    and exists (select 1 from answers a where a.task_id = t.id);
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- b. Out of tries: failed.
  update tasks t set status = 'failed', failure_class = 'unknown',
         error = case when t.status = 'answering' and t.call_started_at is not null then 'worker_lost'
                      else coalesce(t.error, 'lease_expired') || ' (3 tries)' end,
         locked_until = null, call_started_at = null
  where t.status in ('answering', 'extracting') and (t.locked_until is null or t.locked_until <= now())
    and t.tries >= 3;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- c. Lost mid-call (maybe paid): resend once, then worker_lost.
  update tasks t set
    status        = case when coalesce(t.error, '') like 'worker_lost_resend%' then 'failed'::task_status else 'pending'::task_status end,
    failure_class = case when coalesce(t.error, '') like 'worker_lost_resend%' then 'unknown'::failure_class else t.failure_class end,
    error         = case when coalesce(t.error, '') like 'worker_lost_resend%' then 'worker_lost'
                         else 'worker_lost_resend: lease expired mid-call; resent once' end,
    locked_until = null, call_started_at = null
  where t.status = 'answering' and (t.locked_until is null or t.locked_until <= now())
    and t.call_started_at is not null;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- d. Lost before the call started: back to pending.
  update tasks t set status = 'pending', locked_until = null
  where t.status = 'answering' and (t.locked_until is null or t.locked_until <= now())
    and t.call_started_at is null;
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- e. Lost during extraction: back to answered (the answer is kept).
  update tasks t set status = 'answered', locked_until = null
  where t.status = 'extracting' and (t.locked_until is null or t.locked_until <= now());
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- f. Fixes stuck in 'running' for more than 5 minutes go back to pending.
  update runs r set fixes_status = 'pending'
  where r.fixes_status = 'running'
    and coalesce(_ts(_cfg('fixes_started_' || r.id)), r.finished_at, r.created_at) < now() - interval '5 minutes';
  delete from app_config c
  where c.key like 'fixes\_started\_%'
    and not exists (select 1 from runs r where 'fixes_started_' || r.id = c.key and r.fixes_status = 'running');

  -- g. Safety net: close open runs that have no open task left (e.g. last task failed).
  for v_run in
    select r.id from runs r
    where r.status in ('queued', 'processing')
      and not exists (select 1 from tasks t where t.run_id = r.id
                      and t.status in ('pending', 'answering', 'answered', 'extracting'))
  loop
    perform finish_run_if_done(v_run);
  end loop;

  return v_total;
end $$;

-- 5. save_answer -------------------------------------------------------------------
create or replace function save_answer(p_task_id uuid, p_answer jsonb, p_searches text[], p_sources jsonb)
returns void
language plpgsql set search_path = public as $$
declare
  v_task tasks;
  v_new  int;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'not_found: task % does not exist', p_task_id;
  end if;

  insert into answers (task_id, answer_text, web_searched, raw, usage, latency_ms)
  values (p_task_id,
          coalesce(p_answer ->> 'answer_text', ''),
          coalesce(case when jsonb_typeof(p_answer -> 'web_searched') = 'boolean'
                        then (p_answer ->> 'web_searched')::boolean end, false),
          nullif(p_answer -> 'raw', 'null'::jsonb),
          nullif(p_answer -> 'usage', 'null'::jsonb),
          _jint(p_answer -> 'latency_ms'))
  on conflict (task_id) do nothing;            -- never overwrite a paid answer
  get diagnostics v_new = row_count;

  -- Searches and sources belong to the first saved answer only.
  if v_new > 0 then
    insert into searches (task_id, ord, query)
    select p_task_id, s.n, btrim(s.q)
    from unnest(coalesce(p_searches, '{}'::text[])) with ordinality s(q, n)   -- ord = 1-based array index
    where nullif(btrim(s.q), '') is not null;

    if jsonb_typeof(p_sources) = 'array' then
      insert into sources (task_id, ord, url, title, domain, root_domain, source_type, brand_id, marketplace_id, cited)
      select p_task_id, coalesce(x.ord, e.n::int), x.url, x.title, x.domain, x.root_domain,
             case when x.source_type = any (enum_range(null::source_type)::text[])
                  then x.source_type::source_type else 'other'::source_type end,
             x.brand_id, x.marketplace_id, coalesce(x.cited, false)
      from jsonb_array_elements(p_sources) with ordinality e(j, n)
      cross join lateral jsonb_to_record(e.j) as x(ord int, url text, title text, domain text, root_domain text,
                                                   source_type text, brand_id uuid, marketplace_id uuid, cited boolean)
      where jsonb_typeof(e.j) = 'object' and nullif(btrim(x.url), '') is not null;
    end if;
  end if;

  -- Late answers still count (e.g. swept back to pending while the call finished); closed runs stay closed.
  update tasks t set status = 'answered', answered_at = now(), tries = 0, locked_until = null,
         call_started_at = null, error = null, failure_class = null
  where t.id = p_task_id
    and (t.status in ('pending', 'answering')
         or (t.status = 'failed' and exists (select 1 from runs r where r.id = t.run_id and r.status in ('queued', 'processing'))));

  perform _cfg_set('fails_in_row_' || v_task.assistant, '0');
end $$;

-- 6. save_decision -----------------------------------------------------------------
create or replace function save_decision(p_task_id uuid, p_decision jsonb, p_rejections jsonb) returns uuid
language plpgsql set search_path = public as $$
declare
  v_task tasks;
  d      jsonb := coalesce(p_decision, '{}'::jsonb);
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'not_found: task % does not exist', p_task_id;
  end if;

  insert into decisions (task_id, mentioned_brand_ids, shortlist_brand_ids, pick_brand_id, pick_brand_name,
                         pick_product, pick_price_inr, pick_channel, pick_url, pick_delivery_days,
                         fits_budget, fits_deadline, reasoning_excerpt, extractor_model, raw)
  values (p_task_id,
          _juuids(d -> 'mentioned_brand_ids'),
          _juuids(d -> 'shortlist_brand_ids'),
          (select b.id from brands b where b.id::text = d ->> 'pick_brand_id'),
          d ->> 'pick_brand_name',
          d ->> 'pick_product',
          _jint(d -> 'pick_price_inr'),
          d ->> 'pick_channel',
          d ->> 'pick_url',
          _jint(d -> 'pick_delivery_days'),
          _jtri(d ->> 'fits_budget'),
          _jtri(d ->> 'fits_deadline'),
          d ->> 'reasoning_excerpt',
          d ->> 'extractor_model',
          nullif(d -> 'raw', 'null'::jsonb))
  on conflict (task_id) do update set
    mentioned_brand_ids = excluded.mentioned_brand_ids, shortlist_brand_ids = excluded.shortlist_brand_ids,
    pick_brand_id = excluded.pick_brand_id, pick_brand_name = excluded.pick_brand_name,
    pick_product = excluded.pick_product, pick_price_inr = excluded.pick_price_inr,
    pick_channel = excluded.pick_channel, pick_url = excluded.pick_url,
    pick_delivery_days = excluded.pick_delivery_days, fits_budget = excluded.fits_budget,
    fits_deadline = excluded.fits_deadline, reasoning_excerpt = excluded.reasoning_excerpt,
    extractor_model = excluded.extractor_model, raw = excluded.raw, created_at = now();

  delete from decision_rejections where task_id = p_task_id;
  if jsonb_typeof(p_rejections) = 'array' then
    insert into decision_rejections (task_id, brand_id, reason, note)
    select distinct on (x.brand_id) p_task_id, x.brand_id,
           case when x.reason = any (enum_range(null::loss_reason)::text[])
                then x.reason::loss_reason else 'better_fit_elsewhere'::loss_reason end,
           x.note
    from jsonb_array_elements(p_rejections) e(j)
    cross join lateral jsonb_to_record(e.j) as x(brand_id uuid, reason text, note text)
    where jsonb_typeof(e.j) = 'object' and x.brand_id is not null
    order by x.brand_id
    on conflict do nothing;
  end if;

  update tasks t set status = 'done', done_at = now(), locked_until = null, error = null, failure_class = null
  where t.id = p_task_id
    and (t.status in ('answered', 'extracting', 'done')
         or (t.status = 'failed' and exists (select 1 from runs r where r.id = t.run_id and r.status in ('queued', 'processing'))));

  return v_task.run_id;
end $$;

-- 7. retry_task -------------------------------------------------------------------
create or replace function retry_task(p_task_id uuid, p_error text, p_retry_after_seconds int default null,
                                      p_count_breaker bool default true) returns task_status
language plpgsql set search_path = public as $$
declare
  v_task  tasks;
  v_new   task_status;
  v_fails int;
  v_key   text;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'not_found: task % does not exist', p_task_id;
  end if;
  -- Only in-flight tasks move; anything else (swept, stopped, finished) is left alone.
  if v_task.status not in ('answering', 'extracting') then
    return v_task.status;
  end if;

  if v_task.tries >= 3 then
    v_new := 'failed';
    update tasks set status = v_new, failure_class = 'retryable', error = left(coalesce(p_error, 'retryable error'), 2000),
           locked_until = null, call_started_at = null
    where id = p_task_id;
  else
    v_new := case when v_task.status = 'answering' then 'pending'::task_status else 'answered'::task_status end;
    update tasks set status = v_new, failure_class = 'retryable', error = left(coalesce(p_error, 'retryable error'), 2000),
           locked_until = now() + make_interval(secs => least(greatest(coalesce(p_retry_after_seconds, 5), 1), 300)),
           call_started_at = null
    where id = p_task_id;
  end if;

  if coalesce(p_count_breaker, true) then
    v_key := 'fails_in_row_' || v_task.assistant;
    insert into app_config (key, value) values (v_key, '1')
    on conflict (key) do update
      set value = (coalesce(case when app_config.value ~ '^\d+$' then app_config.value::int end, 0) + 1)::text
    returning value::int into v_fails;
    if v_fails >= 3 then
      perform _cfg_set('breaker_until_' || v_task.assistant, _iso(now() + interval '60 seconds'));
      perform _cfg_set(v_key, '0');
    end if;
  end if;

  return v_new;
end $$;

-- 8. fail_task ---------------------------------------------------------------------
create or replace function fail_task(p_task_id uuid, p_class failure_class, p_error text) returns void
language plpgsql set search_path = public as $$
begin
  update tasks set status = 'failed', failure_class = coalesce(p_class, 'unknown'),
         error = left(coalesce(p_error, 'failed'), 2000), locked_until = null, call_started_at = null
  where id = p_task_id and status not in ('done', 'cancelled');
end $$;

-- 10. claim_fixes ------------------------------------------------------------------
create or replace function claim_fixes(p_limit int default 1) returns setof uuid
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  for v_id in
    update runs set fixes_status = 'running'
    where id in (select id from runs
                 where status in ('done', 'partial') and trigger = 'manual' and fixes_status = 'pending'
                 order by finished_at nulls last, created_at
                 limit greatest(coalesce(p_limit, 1), 0)
                 for update skip locked)
    returning id
  loop
    perform _cfg_set('fixes_started_' || v_id, _iso(now()));
    return next v_id;
  end loop;
end $$;

-- 11. stop_run ---------------------------------------------------------------------
create or replace function stop_run(p_run_id uuid) returns void
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from runs where id = p_run_id) then
    raise exception 'not_found: run % does not exist', p_run_id;
  end if;
  -- Waiting tasks are cancelled; in-flight and answered (already paid) tasks finish.
  update tasks set status = 'cancelled', error = 'stopped', locked_until = null
  where run_id = p_run_id and status = 'pending';
  perform finish_run_if_done(p_run_id);
end $$;

-- 12. run_counts -------------------------------------------------------------------
create or replace function run_counts(p_run_ids uuid[])
returns table (run_id uuid, assistant text, total int, done int, failed int, in_flight int)
language sql stable set search_path = public as $$
  select t.run_id, t.assistant,
         count(*)::int,
         (count(*) filter (where t.status = 'done'))::int,
         (count(*) filter (where t.status in ('failed', 'cancelled')))::int,
         (count(*) filter (where t.status in ('answering', 'extracting')))::int
  from tasks t
  where t.run_id = any (p_run_ids)
  group by t.run_id, t.assistant
  order by t.run_id, array_position(array['openai','anthropic','gemini'], t.assistant)
$$;

-- 13. health_info ------------------------------------------------------------------
create or replace function health_info() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'lastKickAt',        _iso(_ts(_cfg('last_kick_at'))),
    'lastKickStatus',    _cfg('last_kick_status'),
    'leaseUntil',        _iso(_ts(_cfg('lease_until'))),
    'queuedTasks',       (select count(*)::int from tasks where status in ('pending', 'answered')),
    'oldestQueuedAgeSec',(select floor(extract(epoch from now() - min(created_at)))::int
                          from tasks where status in ('pending', 'answered')),
    'openBreakers',      coalesce((select jsonb_agg(substr(key, length('breaker_until_') + 1) order by key)
                                   from app_config
                                   where key like 'breaker\_until\_%' and _ts(value) > now()), '[]'::jsonb),
    'keysPresent',       jsonb_build_object(
                           'openai',    coalesce((select key_present from assistants where id = 'openai'), false),
                           'anthropic', coalesce((select key_present from assistants where id = 'anthropic'), false),
                           'gemini',    coalesce((select key_present from assistants where id = 'gemini'), false))
  )
$$;

-- Grants: service_role only --------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('_iso', '_ts', '_cfg', '_cfg_set', '_jint', '_juuids', '_jtri',
                        'create_run', 'claim_tasks', 'take_lease', 'release_lease', 'sweep_stuck',
                        'save_answer', 'save_decision', 'retry_task', 'fail_task', 'finish_run_if_done',
                        'claim_fixes', 'stop_run', 'run_counts', 'health_info')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
