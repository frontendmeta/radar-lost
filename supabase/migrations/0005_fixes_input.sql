-- fixes_input(run): the ~10 KB jsonb the fixes call reads, for the primary brand.
-- Built from base tables only (tasks, answers, decisions, decision_rejections, sources, searches, brands, products, queries).
-- Safe to re-apply.

create or replace function public.fixes_input(p_run_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
with
p as (
  select id, name, domains from brands where is_primary and archived_at is null order by created_at limit 1
),
dt as (
  select t.id as task_id, t.assistant, t.query_id, t.done_at,
         coalesce(a.web_searched, false) as web_searched,
         coalesce(d.mentioned_brand_ids, '{}') as mentioned_brand_ids,
         d.pick_brand_id, d.pick_brand_name, d.pick_product, d.pick_price_inr, d.pick_channel, d.pick_url,
         d.pick_delivery_days, d.fits_budget, d.fits_deadline, d.reasoning_excerpt
  from tasks t
  left join answers a on a.task_id = t.id
  left join decisions d on d.task_id = t.id
  where t.run_id = p_run_id and t.status = 'done'
),
o as (
  select dt.*,
         exists (select 1 from sources s where s.task_id = dt.task_id and s.brand_id = (select id from p)) as found,
         case
           when dt.pick_brand_id = (select id from p) then 'picked'
           when (select id from p) = any (dt.mentioned_brand_ids) then 'mentioned_lost'
           when exists (select 1 from sources s where s.task_id = dt.task_id and s.brand_id = (select id from p)) then 'found_not_mentioned'
           else 'not_found'
         end as outcome
  from dt
),
summary as (
  select jsonb_build_object(
    'tasks_total',          (select count(*) from tasks where run_id = p_run_id),
    'tasks_failed',         (select count(*) from tasks where run_id = p_run_id and status = 'failed'),
    'done_tasks',           count(*),
    'web_searched_tasks',   count(*) filter (where web_searched),
    'found',                count(*) filter (where web_searched and found),
    'mentioned',            count(*) filter (where outcome in ('picked', 'mentioned_lost')),
    'picked',               count(*) filter (where outcome = 'picked'),
    'not_picked',           count(*) filter (where outcome <> 'picked'),
    'mentioned_lost',       count(*) filter (where outcome = 'mentioned_lost'),
    'found_not_mentioned',  count(*) filter (where outcome = 'found_not_mentioned'),
    'not_found',            count(*) filter (where outcome = 'not_found'),
    'picks_with_price',     count(*) filter (where pick_price_inr is not null),
    'budget_misses',        count(*) filter (where fits_budget = 'no' and pick_price_inr is not null)
  ) as j
  from o
),
by_assistant as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'assistant', assistant, 'done_tasks', n, 'web_searched_tasks', w, 'found', f, 'mentioned', m, 'picked', pk)
           order by assistant), '[]'::jsonb) as j
  from (
    select assistant, count(*) as n,
           count(*) filter (where web_searched) as w,
           count(*) filter (where web_searched and found) as f,
           count(*) filter (where outcome in ('picked', 'mentioned_lost')) as m,
           count(*) filter (where outcome = 'picked') as pk
    from o group by assistant
  ) x
),
winners as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'brand_id', brand_id, 'name', name, 'tracked', brand_id is not null,
           'is_primary', brand_id is not null and brand_id = (select id from p),
           'wins', wins, 'median_price_inr', med_price, 'top_channel', top_channel, 'task_ids', task_ids)
           order by wins desc, name), '[]'::jsonb) as j
  from (
    select o.pick_brand_id as brand_id,
           coalesce(max(b.name), min(o.pick_brand_name)) as name,
           count(*) as wins,
           percentile_disc(0.5) within group (order by o.pick_price_inr) as med_price,
           mode() within group (order by o.pick_channel) as top_channel,
           (array_agg(o.task_id order by o.done_at desc nulls last))[1:3] as task_ids
    from o
    left join brands b on b.id = o.pick_brand_id
    where o.pick_brand_id is not null or nullif(btrim(o.pick_brand_name), '') is not null
    group by o.pick_brand_id, case when o.pick_brand_id is null then lower(btrim(o.pick_brand_name)) end
    order by count(*) desc, 2
    limit 3
  ) x
),
reasons as (
  select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'tasks', n, 'task_ids', ids)
           order by n desc, reason), '[]'::jsonb) as j
  from (
    select case when o.outcome = 'not_found' then 'not_found'
                else coalesce(dr.reason::text, 'better_fit_elsewhere') end as reason,
           count(*) as n,
           (array_agg(o.task_id order by o.done_at desc nulls last))[1:5] as ids
    from o
    left join decision_rejections dr on dr.task_id = o.task_id and dr.brand_id = (select id from p)
    where o.outcome in ('mentioned_lost', 'not_found')
    group by 1
  ) x
),
domains as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'root_domain', root_domain, 'source_type', stype, 'tasks', tasks, 'uses', uses, 'cited', cited,
           'primary_present', primary_tasks > 0, 'primary_tasks', primary_tasks, 'lost_tasks', lost_tasks,
           'sample_url', sample_url, 'task_ids', ids)
           order by tasks desc, uses desc, root_domain), '[]'::jsonb) as j
  from (
    select coalesce(nullif(s.root_domain, ''), nullif(s.domain, ''), '(unknown)') as root_domain,
           mode() within group (order by s.source_type) as stype,
           count(distinct s.task_id) as tasks,
           count(*) as uses,
           count(*) filter (where s.cited) as cited,
           count(distinct s.task_id) filter (where s.brand_id = (select id from p)) as primary_tasks,
           count(distinct s.task_id) filter (where o.outcome <> 'picked') as lost_tasks,
           (array_agg(s.url order by (s.brand_id is not distinct from (select id from p)) desc, s.cited desc, s.ord))[1] as sample_url,
           (array_agg(distinct s.task_id))[1:3] as ids
    from sources s
    join o on o.task_id = s.task_id
    group by 1
    order by count(distinct s.task_id) desc, count(*) desc, 1
    limit 10
  ) x
),
lost as (
  select row_number() over (
           order by (o.outcome = 'mentioned_lost') desc,
                    (pr.price_inr is not null and o.pick_price_inr is not null and pr.price_inr < o.pick_price_inr) desc,
                    (o.pick_price_inr - pr.price_inr) desc nulls last,
                    o.done_at desc nulls last) as rn,
         o.*, q.code as query_code, q.text as query_text, q.budget_inr, q.deadline_days,
         pr.name as our_product, pr.price_inr as our_price, pr.url as our_url,
         dr.reason as rej_reason, dr.note as rej_note, wb.name as winner_name
  from o
  join queries q on q.id = o.query_id
  left join products pr on pr.id = q.product_id
  left join decision_rejections dr on dr.task_id = o.task_id and dr.brand_id = (select id from p)
  left join brands wb on wb.id = o.pick_brand_id
  where o.outcome in ('mentioned_lost', 'not_found')
),
lost_j as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'task_id', l.task_id,
    'assistant', l.assistant,
    'outcome', l.outcome,
    'reason', case when l.outcome = 'not_found' then 'not_found' else coalesce(l.rej_reason::text, 'better_fit_elsewhere') end,
    'note', left(l.rej_note, 200),
    'query', jsonb_build_object('code', l.query_code, 'text', l.query_text, 'budget_inr', l.budget_inr, 'deadline_days', l.deadline_days),
    'winner', jsonb_build_object('brand', coalesce(l.winner_name, l.pick_brand_name), 'tracked', l.pick_brand_id is not null,
                                 'product', left(l.pick_product, 160), 'price_inr', l.pick_price_inr, 'channel', l.pick_channel,
                                 'url', l.pick_url, 'delivery_days', l.pick_delivery_days,
                                 'fits_budget', l.fits_budget, 'fits_deadline', l.fits_deadline),
    'our_product', jsonb_build_object('name', l.our_product, 'price_inr', l.our_price, 'url', l.our_url),
    'price_gap_inr', l.pick_price_inr - l.our_price,
    'reasoning_excerpt', left(l.reasoning_excerpt, 400),
    'searches', (select coalesce(jsonb_agg(sq.query order by sq.ord), '[]'::jsonb)
                 from (select left(query, 160) as query, ord from searches where task_id = l.task_id order by ord limit 5) sq),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object(
                          'ord', s.ord, 'url', s.url, 'title', left(s.title, 100), 'root_domain', s.root_domain,
                          'source_type', s.source_type, 'cited', s.cited, 'brand', sb.name,
                          'is_primary', s.brand_id is not null and s.brand_id = (select id from p))
                          order by s.cited desc, s.ord), '[]'::jsonb)
                from (select * from sources where task_id = l.task_id order by cited desc, ord limit 6) s
                left join brands sb on sb.id = s.brand_id)
  ) order by l.rn), '[]'::jsonb) as j
  from lost l
  where l.rn <= 3
),
prods as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', code, 'name', name, 'url', url, 'price_inr', price_inr, 'mrp_inr', mrp_inr, 'sizes', sizes,
           'fabric', fabric, 'style', style, 'delivery_days', delivery_days, 'delivery_is_sample', delivery_is_sample)
           order by code), '[]'::jsonb) as j
  from products
  where brand_id = (select id from p) and archived_at is null
)
select jsonb_build_object(
  'run', (select jsonb_build_object('id', r.id, 'label', r.label, 'status', r.status, 'assistants', r.assistants,
                                    'attempts', r.attempts, 'city', r.city, 'created_at', r.created_at, 'finished_at', r.finished_at)
          from runs r where r.id = p_run_id),
  'primary_brand', (select jsonb_build_object('id', id, 'name', name, 'domains', domains) from p),
  'summary', (select j from summary),
  'by_assistant', (select j from by_assistant),
  'top_winners', (select j from winners),
  'loss_reasons', (select j from reasons),
  'top_domains', (select j from domains),
  'top_lost_sales', (select j from lost_j),
  'products', (select j from prods)
);
$$;

revoke all on function public.fixes_input(uuid) from public, anon, authenticated;
grant execute on function public.fixes_input(uuid) to service_role;
