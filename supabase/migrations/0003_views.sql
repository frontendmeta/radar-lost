-- Lost Sale Radar: metric view + analysis functions behind /api/analysis/*.
-- Every function takes the lens (p_run_id, p_focus, p_assistants, p_product_ids, p_query_ids; null = all;
-- products and queries combine by AND) and returns COUNTS only. Rates are computed in TypeScript from
-- summed counts, never averaged. Safe to re-apply (create or replace / drop if exists).

-- v_task_brand ----------------------------------------------------------------
-- One row per done task x brand that existed when the task finished (created before done_at and not
-- archived before it). A brand added after a run has no rows there, so its rates are null, not 0.
-- mentioned includes picked, so "mentioned" = picked + mentioned_lost exactly.
create or replace view public.v_task_brand with (security_invoker = on) as
select
  t.id                            as task_id,
  t.run_id,
  t.query_id,
  q.product_id,
  t.assistant,
  b.id                            as brand_id,
  coalesce(a.web_searched, false) as web_searched,
  x.found,
  x.mentioned,
  x.picked,
  case when x.picked    then 'picked'::brand_outcome
       when x.mentioned then 'mentioned_lost'::brand_outcome
       when x.found     then 'found_not_mentioned'::brand_outcome
       else 'not_found'::brand_outcome end                                          as outcome,
  case when x.picked    then null::loss_reason
       when x.mentioned then coalesce(r.reason, 'better_fit_elsewhere'::loss_reason)
       when x.found     then null::loss_reason
       else 'not_found'::loss_reason end                                            as reason,
  case when x.mentioned and not x.picked then r.note end                            as note,
  t.done_at
from public.tasks t
join public.decisions d on d.task_id = t.id
join public.queries q   on q.id = t.query_id
left join public.answers a on a.task_id = t.id
join public.brands b
  on b.created_at <= coalesce(t.done_at, t.created_at)
 and (b.archived_at is null or b.archived_at > coalesce(t.done_at, t.created_at))
left join public.decision_rejections r on r.task_id = t.id and r.brand_id = b.id
cross join lateral (
  select
    coalesce(d.pick_brand_id = b.id, false)                                          as picked,
    (b.id = any (d.mentioned_brand_ids) or coalesce(d.pick_brand_id = b.id, false))  as mentioned,
    exists (select 1 from public.sources s where s.task_id = t.id and s.brand_id = b.id) as found
) x
where t.status = 'done';

revoke all on public.v_task_brand from public, anon, authenticated;
grant select on public.v_task_brand to service_role;

-- Drop old signatures so re-applying never leaves overloads behind.
drop function if exists public.analysis_lens_tasks(uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_focus_rows(uuid, uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_summary(uuid, uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_by_assistant(uuid, uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_wins(uuid, uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_loss_reasons(uuid, uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_sources(uuid, uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_queries(uuid, uuid, text[], uuid[], uuid[]);
drop function if exists public.analysis_lost_sales(uuid, uuid, text[], uuid[], uuid[], int);
drop function if exists public.analysis_compare(uuid, uuid, uuid, text[], uuid[], uuid[]);

-- Helpers -----------------------------------------------------------------------
-- Tasks of a run inside the lens (any status).
create function public.analysis_lens_tasks(p_run_id uuid, p_assistants text[], p_product_ids uuid[], p_query_ids uuid[])
returns table (task_id uuid, query_id uuid, product_id uuid, assistant text, status task_status, done_at timestamptz)
language sql stable as $$
  select t.id, t.query_id, q.product_id, t.assistant, t.status, t.done_at
  from public.tasks t
  join public.queries q on q.id = t.query_id
  where t.run_id = p_run_id
    and (p_assistants  is null or t.assistant  = any (p_assistants))
    and (p_product_ids is null or q.product_id = any (p_product_ids))
    and (p_query_ids   is null or t.query_id   = any (p_query_ids))
$$;

-- v_task_brand rows for the focus brand inside the lens.
create function public.analysis_focus_rows(p_run_id uuid, p_focus uuid, p_assistants text[], p_product_ids uuid[], p_query_ids uuid[])
returns table (task_id uuid, query_id uuid, product_id uuid, assistant text, web_searched boolean, found boolean,
               mentioned boolean, picked boolean, outcome brand_outcome, reason loss_reason, note text, done_at timestamptz)
language sql stable as $$
  select v.task_id, v.query_id, v.product_id, v.assistant, v.web_searched, v.found, v.mentioned, v.picked,
         v.outcome, v.reason, v.note, v.done_at
  from public.v_task_brand v
  where v.run_id = p_run_id
    and v.brand_id = p_focus
    and (p_assistants  is null or v.assistant  = any (p_assistants))
    and (p_product_ids is null or v.product_id = any (p_product_ids))
    and (p_query_ids   is null or v.query_id   = any (p_query_ids))
$$;

-- analysis_summary ---------------------------------------------------------------
-- done/failed: tasks in the lens. focus_of: done tasks where the focus brand existed (denominator for
-- mentioned and picked). found_of: those that searched. Budget misses are brand-neutral (any pick).
create function public.analysis_summary(p_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                        p_product_ids uuid[] default null, p_query_ids uuid[] default null)
returns table (done int, failed int, focus_of int, found_n int, found_of int, mentioned_n int, picked_n int,
               budget_miss_n int, budget_known_of int)
language sql stable set search_path = public as $$
  with lt as (select * from analysis_lens_tasks(p_run_id, p_assistants, p_product_ids, p_query_ids)),
  f as (select * from analysis_focus_rows(p_run_id, p_focus, p_assistants, p_product_ids, p_query_ids)),
  d as (select dd.* from decisions dd join lt on lt.task_id = dd.task_id where lt.status = 'done')
  select
    (select count(*) from lt where lt.status = 'done')::int,
    (select count(*) from lt where lt.status = 'failed')::int,
    (select count(*) from f)::int,
    (select count(*) from f where f.found and f.web_searched)::int,
    (select count(*) from f where f.web_searched)::int,
    (select count(*) from f where f.mentioned)::int,
    (select count(*) from f where f.picked)::int,
    (select count(*) from d where d.pick_price_inr is not null and d.fits_budget = 'no')::int,
    (select count(*) from d where d.pick_price_inr is not null)::int
$$;

-- analysis_by_assistant -------------------------------------------------------------
create function public.analysis_by_assistant(p_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                             p_product_ids uuid[] default null, p_query_ids uuid[] default null)
returns table (assistant text, done int, focus_of int, found_n int, found_of int, mentioned_n int, picked_n int)
language sql stable set search_path = public as $$
  with lt as (select * from analysis_lens_tasks(p_run_id, p_assistants, p_product_ids, p_query_ids)),
  f as (select * from analysis_focus_rows(p_run_id, p_focus, p_assistants, p_product_ids, p_query_ids)),
  ta as (select lt.assistant as a, count(*) filter (where lt.status = 'done') as n from lt group by lt.assistant),
  fa as (
    select f.assistant as a,
           count(*)                                          as focus_of,
           count(*) filter (where f.found and f.web_searched) as found_n,
           count(*) filter (where f.web_searched)            as found_of,
           count(*) filter (where f.mentioned)               as mentioned_n,
           count(*) filter (where f.picked)                  as picked_n
    from f group by f.assistant
  )
  select ta.a, ta.n::int, coalesce(fa.focus_of, 0)::int, coalesce(fa.found_n, 0)::int, coalesce(fa.found_of, 0)::int,
         coalesce(fa.mentioned_n, 0)::int, coalesce(fa.picked_n, 0)::int
  from ta left join fa on fa.a = ta.a
  order by ta.a
$$;

-- analysis_wins ---------------------------------------------------------------------
-- One row per winner. Tracked winners by brand id; unknown winners grouped by name (case/space-insensitive)
-- with a null id (the UI shows them as "Other"). The focus brand is always listed, with 0 picks if needed.
-- done = done tasks in the lens (win-share denominator).
create function public.analysis_wins(p_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                     p_product_ids uuid[] default null, p_query_ids uuid[] default null)
returns table (brand_id uuid, brand_name text, is_primary boolean, picks int, done int)
language sql stable set search_path = public as $$
  with lt as (select * from analysis_lens_tasks(p_run_id, p_assistants, p_product_ids, p_query_ids)),
  d as (select dd.* from decisions dd join lt on lt.task_id = dd.task_id where lt.status = 'done'),
  tot as (select count(*)::int as n from lt where lt.status = 'done'),
  w as (
    -- display name: prefer a capitalised spelling ("Anouk" over "anouk"), then the alphabetically first
    select d.pick_brand_id as bid,
           (array_agg(btrim(d.pick_brand_name)
                      order by (btrim(d.pick_brand_name) = lower(btrim(d.pick_brand_name))), btrim(d.pick_brand_name)))[1] as raw_name,
           count(*)::int as picks
    from d
    where d.pick_brand_id is not null or nullif(btrim(d.pick_brand_name), '') is not null
    group by d.pick_brand_id, case when d.pick_brand_id is null then lower(btrim(d.pick_brand_name)) end
  ),
  rows_ as (
    select w.bid, coalesce(b.name, w.raw_name) as name, coalesce(b.is_primary, false) as is_primary, w.picks
    from w left join brands b on b.id = w.bid
    union all
    select b.id, b.name, b.is_primary, 0
    from brands b
    where b.id = p_focus and not exists (select 1 from w where w.bid = p_focus)
  )
  select r.bid, r.name, r.is_primary, r.picks, tot.n
  from rows_ r cross join tot
  where tot.n > 0
  order by r.picks desc, (r.bid is null), r.name
$$;

-- analysis_loss_reasons ----------------------------------------------------------------
-- Over done tasks where the focus wasn't picked: mentioned_lost rows by their rejection reason, not_found as
-- 'not_found', and found_not_mentioned as its own row. total = done tasks not picked (share denominator).
create function public.analysis_loss_reasons(p_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                             p_product_ids uuid[] default null, p_query_ids uuid[] default null)
returns table (reason text, n int, total int)
language sql stable set search_path = public as $$
  with f as (
    select * from analysis_focus_rows(p_run_id, p_focus, p_assistants, p_product_ids, p_query_ids) f where not f.picked
  )
  select coalesce(f.reason::text, f.outcome::text) as reason, count(*)::int, (select count(*) from f)::int
  from f
  group by 1
  order by 2 desc, 1
$$;

-- analysis_sources -------------------------------------------------------------------
-- kind = 'type'    : source rows by source_type (key = type)
-- kind = 'domain'  : top 10 root domains by source rows; source_type = the domain's most common type;
--                    focus_present = some source on it carries the focus brand
-- kind = 'channel' : focus picks per pick_channel (key = channel)
create function public.analysis_sources(p_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                        p_product_ids uuid[] default null, p_query_ids uuid[] default null)
returns table (kind text, key text, source_type source_type, n int, focus_present boolean)
language sql stable set search_path = public as $$
  with lt as (select * from analysis_lens_tasks(p_run_id, p_assistants, p_product_ids, p_query_ids) where status = 'done'),
  s as (
    select coalesce(nullif(s.root_domain, ''), nullif(s.domain, ''), 'unknown') as dom, s.source_type as st, s.brand_id
    from sources s join lt on lt.task_id = s.task_id
  ),
  by_type as (
    select 'type'::text as kind, s.st::text as key, s.st, count(*)::int as n,
           coalesce(bool_or(s.brand_id = p_focus), false) as fp
    from s group by s.st
  ),
  by_domain as (
    select 'domain'::text as kind, s.dom as key, mode() within group (order by s.st) as st, count(*)::int as n,
           coalesce(bool_or(s.brand_id = p_focus), false) as fp
    from s group by s.dom
    order by 4 desc, 2
    limit 10
  ),
  by_channel as (
    select 'channel'::text as kind, coalesce(nullif(btrim(d.pick_channel), ''), 'unknown') as key, null::source_type as st,
           count(*)::int as n, true as fp
    from decisions d join lt on lt.task_id = d.task_id
    where d.pick_brand_id = p_focus
    group by 2
  )
  select * from (
    select * from by_type union all select * from by_domain union all select * from by_channel
  ) x
  order by case x.kind when 'type' then 1 when 'domain' then 2 else 3 end, x.n desc, x.key
$$;

-- analysis_queries -------------------------------------------------------------------
-- One row per query x assistant in the lens: done attempts, focus counts, most frequent winner
-- (ties broken by name). focus_of = attempts where the focus brand existed (picked-rate denominator).
create function public.analysis_queries(p_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                        p_product_ids uuid[] default null, p_query_ids uuid[] default null)
returns table (query_id uuid, query_code text, query_text text, product_id uuid, assistant text, attempts int,
               focus_of int, found_n int, mentioned_n int, picked_n int, top_winner text)
language sql stable set search_path = public as $$
  with lt as (select * from analysis_lens_tasks(p_run_id, p_assistants, p_product_ids, p_query_ids)),
  f as (select * from analysis_focus_rows(p_run_id, p_focus, p_assistants, p_product_ids, p_query_ids)),
  base as (
    select lt.query_id as qid, lt.assistant as a, count(*) filter (where lt.status = 'done')::int as attempts
    from lt group by 1, 2
  ),
  fa as (
    select f.query_id as qid, f.assistant as a, count(*)::int as focus_of,
           count(*) filter (where f.found and f.web_searched)::int as found_n,
           count(*) filter (where f.mentioned)::int as mentioned_n,
           count(*) filter (where f.picked)::int as picked_n
    from f group by 1, 2
  ),
  wins as (
    -- tracked winners by id, unknown winners by case/space-insensitive name (as in analysis_wins)
    select lt.query_id as qid, lt.assistant as a,
           coalesce(max(b.name),
                    (array_agg(btrim(d.pick_brand_name)
                               order by (btrim(d.pick_brand_name) = lower(btrim(d.pick_brand_name))), btrim(d.pick_brand_name)))[1]) as winner,
           count(*) as c
    from decisions d
    join lt on lt.task_id = d.task_id and lt.status = 'done'
    left join brands b on b.id = d.pick_brand_id
    where d.pick_brand_id is not null or nullif(btrim(d.pick_brand_name), '') is not null
    group by lt.query_id, lt.assistant, d.pick_brand_id,
             case when d.pick_brand_id is null then lower(btrim(d.pick_brand_name)) end
  ),
  top_ as (
    select distinct on (wins.qid, wins.a) wins.qid, wins.a, wins.winner
    from wins order by wins.qid, wins.a, wins.c desc, wins.winner
  )
  select base.qid, q.code, q.text, q.product_id, base.a, base.attempts,
         coalesce(fa.focus_of, 0), coalesce(fa.found_n, 0), coalesce(fa.mentioned_n, 0), coalesce(fa.picked_n, 0),
         top_.winner
  from base
  join queries q on q.id = base.qid
  left join fa   on fa.qid = base.qid and fa.a = base.a
  left join top_ on top_.qid = base.qid and top_.a = base.a
  order by q.code, base.a
$$;

-- analysis_lost_sales ------------------------------------------------------------------
-- Done tasks where the focus wasn't picked, ranked: mentioned_lost, then found_not_mentioned, then not_found;
-- then our product (the query's product) cheaper than the winner's price; then the biggest price gap
-- (winner price - our price); then newest.
create function public.analysis_lost_sales(p_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                           p_product_ids uuid[] default null, p_query_ids uuid[] default null,
                                           p_limit int default 10)
returns table (task_id uuid, query_code text, query_text text, assistant text, outcome brand_outcome, winner text,
               winner_price_inr int, reason loss_reason, product_name text, product_price_inr int,
               product_delivery_days int, product_delivery_is_sample boolean, done_at timestamptz)
language sql stable set search_path = public as $$
  select f.task_id, q.code, q.text, f.assistant, f.outcome,
         coalesce(b.name, nullif(btrim(d.pick_brand_name), '')), d.pick_price_inr, f.reason,
         p.name, p.price_inr, p.delivery_days, p.delivery_is_sample, f.done_at
  from analysis_focus_rows(p_run_id, p_focus, p_assistants, p_product_ids, p_query_ids) f
  join decisions d on d.task_id = f.task_id
  join queries q   on q.id = f.query_id
  left join products p on p.id = q.product_id
  left join brands b   on b.id = d.pick_brand_id
  where not f.picked
  order by case f.outcome when 'mentioned_lost' then 1 when 'found_not_mentioned' then 2 else 3 end,
           (p.price_inr < d.pick_price_inr) desc nulls last,
           (d.pick_price_inr - p.price_inr) desc nulls last,
           f.done_at desc nulls last,
           f.task_id
  limit greatest(1, least(coalesce(p_limit, 10), 50))
$$;

-- analysis_compare -----------------------------------------------------------------------
-- Like-for-like: only (query, assistant) pairs with focus rows in BOTH runs count. Returns the number of
-- shared pairs and each run's counts over those pairs (cur_* = p_run_id, prev_* = p_compare_run_id).
create function public.analysis_compare(p_run_id uuid, p_compare_run_id uuid, p_focus uuid, p_assistants text[] default null,
                                        p_product_ids uuid[] default null, p_query_ids uuid[] default null)
returns table (shared_pairs int,
               cur_of int, cur_found_n int, cur_found_of int, cur_mentioned_n int, cur_picked_n int,
               prev_of int, prev_found_n int, prev_found_of int, prev_mentioned_n int, prev_picked_n int)
language sql stable set search_path = public as $$
  with a as (select * from analysis_focus_rows(p_run_id, p_focus, p_assistants, p_product_ids, p_query_ids)),
  b as (select * from analysis_focus_rows(p_compare_run_id, p_focus, p_assistants, p_product_ids, p_query_ids)),
  pairs as (
    select a.query_id, a.assistant from a
    intersect
    select b.query_id, b.assistant from b
  ),
  a2 as (select a.* from a join pairs p on p.query_id = a.query_id and p.assistant = a.assistant),
  b2 as (select b.* from b join pairs p on p.query_id = b.query_id and p.assistant = b.assistant)
  select
    (select count(*) from pairs)::int,
    (select count(*) from a2)::int,
    (select count(*) from a2 where a2.found and a2.web_searched)::int,
    (select count(*) from a2 where a2.web_searched)::int,
    (select count(*) from a2 where a2.mentioned)::int,
    (select count(*) from a2 where a2.picked)::int,
    (select count(*) from b2)::int,
    (select count(*) from b2 where b2.found and b2.web_searched)::int,
    (select count(*) from b2 where b2.web_searched)::int,
    (select count(*) from b2 where b2.mentioned)::int,
    (select count(*) from b2 where b2.picked)::int
$$;

-- Execute for service_role only.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'analysis\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
