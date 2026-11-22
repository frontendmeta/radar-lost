-- Lost Sale Radar seed: setup data only, written as idempotent upserts (safe to re-run, also on hosted).
-- No secrets here: processor URL/secret go to Vault via supabase/scripts/processor-secrets.sql.
-- Brands and marketplaces use fixed UUIDs so every environment shares the same ids.
-- Products were copied from libas.in on 22 Nov 2026 (prices change daily; refresh before the demo).
-- Re-running: settings rows and assistant choices (enabled/model/max_in_flight/key_present) are kept;
-- brands, marketplaces and products are reset to the values below; a query whose wording was edited
-- (new version) is never overwritten.

-- Settings ----------------------------------------------------------------------
insert into settings (id, city, region, country, timezone, lat, lng, default_attempts,
                      extractor_provider, extractor_model, fixes_model)
values (1, 'Mumbai', 'Maharashtra', 'IN', 'Asia/Kolkata', 19.076, 72.8777, 3, null, null, null)
on conflict (id) do nothing;

-- Assistants (model null = env default) -------------------------------------------
insert into assistants (id, label, enabled, model, max_in_flight, key_present) values
  ('openai',    'ChatGPT', true, null, 2, false),
  ('anthropic', 'Claude',  true, null, 2, false),
  ('gemini',    'Gemini',  true, null, 2, false)
on conflict (id) do update set label = excluded.label;

-- Brands --------------------------------------------------------------------------
insert into brands (id, name, aliases, domains, is_primary) values
  ('b1000000-0000-4000-8000-000000000001', 'Libas',        '{Libas}',                      '{libas.in}',           true),
  ('b1000000-0000-4000-8000-000000000002', 'Jaipur Kurti', '{"Jaipur Kurti",JaipurKurti}', '{jaipurkurti.com}',    false),
  ('b1000000-0000-4000-8000-000000000003', 'Janasya',      '{Janasya}',                    '{janasya.com}',        false),
  ('b1000000-0000-4000-8000-000000000004', 'Biba',         '{Biba,BIBA}',                  '{biba.in}',            false),
  ('b1000000-0000-4000-8000-000000000005', 'Aurelia',      '{Aurelia}',                    '{shopforaurelia.com}', false),
  ('b1000000-0000-4000-8000-000000000006', 'Kalini',       '{Kalini}',                     '{}',                   false)  -- sold mostly on Myntra
on conflict (id) do update set
  name = excluded.name, aliases = excluded.aliases, domains = excluded.domains,
  is_primary = excluded.is_primary, updated_at = now();

-- Marketplaces ----------------------------------------------------------------------
insert into marketplaces (id, name, domains) values
  ('a1000000-0000-4000-8000-000000000001', 'Myntra',        '{myntra.com}'),
  ('a1000000-0000-4000-8000-000000000002', 'Ajio',          '{ajio.com}'),
  ('a1000000-0000-4000-8000-000000000003', 'Amazon',        '{amazon.in}'),
  ('a1000000-0000-4000-8000-000000000004', 'Flipkart',      '{flipkart.com}'),
  ('a1000000-0000-4000-8000-000000000005', 'Nykaa Fashion', '{nykaafashion.com}')
on conflict (id) do update set name = excluded.name, domains = excluded.domains;

-- Products (Libas inventory; from libas.in, 22 Nov 2026) -------------------------------
-- delivery_days 1 + delivery_is_sample true: the next-day Mumbai promise is not confirmed.
insert into products (code, brand_id, name, url, price_inr, mrp_inr, sizes, fabric, style, delivery_days, delivery_is_sample) values
  ('P1', 'b1000000-0000-4000-8000-000000000001',
   'Libas Off White Printed Cotton Straight Kurta',
   'https://www.libas.in/products/off-white-printed-cotton-straight-kurta-43083',
   699, 1299, '{S,M,L,XL}', 'Cotton',
   'Straight calf-length kurta, V-neckline, floral print yoke; casual and daily wear', 1, true),
  ('P2', 'b1000000-0000-4000-8000-000000000001',
   'Libas Lavender Printed Cotton Straight Suit Set With Dupatta',
   'https://www.libas.in/products/lavender-printed-cotton-straight-suit-set-with-dupatta-401256h',
   1249, 3799, '{XS,S,M,L,XL,XXL}', 'Cotton',
   '3-piece set: straight floral-print kurta, straight pants with pockets, printed dupatta; work and casual wear', 1, true),
  ('P3', 'b1000000-0000-4000-8000-000000000001',
   'Libas Green Printed Cotton A-Line Short Kurti',
   'https://www.libas.in/products/green-printed-cotton-a-line-short-kurti-43007h',
   679, 2149, '{XS,S,M,L,XL,XXL}', 'Cotton',
   'A-line short kurti, printed; casual and daily wear', 1, true)
on conflict (code) where archived_at is null do update set
  brand_id = excluded.brand_id, name = excluded.name, url = excluded.url, price_inr = excluded.price_inr,
  mrp_inr = excluded.mrp_inr, sizes = excluded.sizes, fabric = excluded.fabric, style = excluded.style,
  delivery_days = excluded.delivery_days, delivery_is_sample = excluded.delivery_is_sample;

-- Queries (all Mumbai, deadline 1 day) ------------------------------------------------
insert into queries (code, text, product_id, budget_inr, city, deadline_days)
select v.code, v.text, p.id, v.budget, 'Mumbai', 1
from (values
  ('q01', 'Find me a pure cotton kurta for office under ₹1,500 that can be delivered in Mumbai by tomorrow. Which one should I buy, and where?', 'P1', 1500),
  ('q02', 'I need a white cotton straight kurta under ₹1,000, delivered to Andheri, Mumbai within a day. What''s the best option?', 'P1', 1000),
  ('q03', 'Cotton kurta set with dupatta under ₹1,500, delivered in Mumbai in 1 day. Pick one for me.', 'P2', 1500),
  ('q04', 'Best A-line cotton kurti under ₹800 for daily wear, delivered to Mumbai tomorrow.', 'P3', 800),
  ('q05', 'I''m in Bandra, Mumbai. I need a festive-looking cotton kurta under ₹1,500 by tomorrow evening. What should I order?', 'P2', 1500),
  ('q06', 'XL size cotton kurta under ₹1,200 with next-day delivery in Mumbai. Which brand and which product?', 'P1', 1200),
  ('q07', 'Pure cotton kurta pant set for summer, under ₹1,500, must reach Mumbai by tomorrow. Recommend one.', 'P2', 1500),
  ('q08', 'Mumbai mein kal tak delivery chahiye, cotton kurti under 1000, best kaunsi hai?', 'P3', 1000),
  ('q09', 'Gift for my mom: a cotton kurta under ₹1,500, delivered in Mumbai within 24 hours. What''s the best pick?', 'P2', 1500),
  ('q10', 'Compare the options and choose the best printed cotton kurta under ₹1,500 with 1-day delivery to Powai, Mumbai.', 'P1', 1500)
) as v(code, text, product_code, budget)
join products p on p.code = v.product_code and p.archived_at is null
on conflict (code) where archived_at is null do update set
  product_id = excluded.product_id, budget_inr = excluded.budget_inr,
  city = excluded.city, deadline_days = excluded.deadline_days
where queries.text = excluded.text;   -- an edited (new-version) query keeps its own values
