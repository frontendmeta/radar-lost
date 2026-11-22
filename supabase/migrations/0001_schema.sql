-- Lost Sale Radar: tables, enums, RLS on (no policies).
-- One brand set, no workspace column. Nothing is hard-deleted: setup rows carry archived_at.

create extension if not exists pgcrypto;

-- Enums ---------------------------------------------------------------------
create type run_status    as enum ('queued','processing','done','partial','failed','cancelled');
create type run_trigger   as enum ('manual','live');
create type fixes_status  as enum ('pending','running','done','failed');
create type task_status   as enum ('pending','answering','answered','extracting','done','failed','cancelled');
create type failure_class as enum ('retryable','model','config','unknown');
create type source_type   as enum ('brand_site','marketplace','listicle','review','other');
create type brand_outcome as enum ('picked','mentioned_lost','found_not_mentioned','not_found');
create type loss_reason   as enum ('over_budget','delivery_unclear_or_slow','size_or_stock','missing_details','weaker_reviews','better_fit_elsewhere','not_found');
create type tri           as enum ('yes','no','unknown');
create type fix_type      as enum ('listing','content','marketplace','pr','site','pricing');

-- Setup tables ----------------------------------------------------------------
create table settings (
  id                 int primary key default 1 check (id = 1),
  city               text not null default 'Mumbai',
  region             text not null default 'Maharashtra',
  country            text not null default 'IN',
  timezone           text not null default 'Asia/Kolkata',
  lat                double precision not null default 19.076,
  lng                double precision not null default 72.8777,
  default_attempts   int not null default 3 check (default_attempts between 1 and 5),
  extractor_provider text,
  extractor_model    text,
  fixes_model        text,
  updated_at         timestamptz,
  updated_by_email   text,
  created_at         timestamptz not null default now()
);

create table assistants (
  id            text primary key check (id in ('openai','anthropic','gemini')),
  label         text not null,
  enabled       boolean not null default true,
  model         text,                       -- null = env default
  max_in_flight int not null default 2 check (max_in_flight between 1 and 10),
  key_present   boolean not null default false,  -- written by process-run only
  created_at    timestamptz not null default now()
);

create table brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  aliases     text[] not null default '{}',
  domains     text[] not null default '{}',
  is_primary  boolean not null default false,
  archived_at timestamptz,
  updated_at  timestamptz,
  created_at  timestamptz not null default now()
);
-- Exactly one active primary brand.
create unique index brands_one_primary on brands ((true)) where is_primary and archived_at is null;

create table marketplaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domains     text[] not null default '{}',
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create table products (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null,
  brand_id           uuid not null references brands(id),
  name               text not null,
  url                text not null,
  price_inr          int not null check (price_inr >= 0),
  mrp_inr            int check (mrp_inr is null or mrp_inr >= 0),
  sizes              text[] not null default '{}',
  fabric             text not null default '',
  style              text not null default '',
  delivery_days      int check (delivery_days is null or delivery_days >= 0),
  delivery_is_sample boolean not null default true,
  archived_at        timestamptz,
  created_at         timestamptz not null default now()
);
create unique index products_code_active on products (code) where archived_at is null;

create table queries (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  text          text not null,
  product_id    uuid not null references products(id),
  budget_inr    int not null,
  city          text not null,
  deadline_days int not null,
  attributes    jsonb not null default '{}',
  replaces_id   uuid references queries(id),   -- wording is frozen; edits create a new version
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index queries_code_active on queries (code) where archived_at is null;

-- Run tables --------------------------------------------------------------------
create table runs (
  id               uuid primary key default gen_random_uuid(),
  label            text,
  trigger          run_trigger not null default 'manual',
  status           run_status not null default 'queued',
  fixes_status     fixes_status not null default 'pending',
  assistants       text[] not null,
  attempts         int not null check (attempts between 1 and 5),
  query_ids        uuid[] not null,
  city             text not null default 'Mumbai',
  created_by       uuid,
  created_by_email text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index runs_created_at on runs (created_at desc);

create table tasks (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references runs(id) on delete cascade,
  query_id        uuid not null references queries(id),
  assistant       text not null references assistants(id),
  model           text not null,          -- snapshot at create_run
  attempt         int not null,
  prompt_text     text not null,          -- snapshot at create_run
  status          task_status not null default 'pending',
  tries           int not null default 0,
  locked_until    timestamptz,
  call_started_at timestamptz,
  failure_class   failure_class,
  error           text,
  answered_at     timestamptz,
  done_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (run_id, query_id, assistant, attempt)
);
create index tasks_run_status on tasks (run_id, status);
create index tasks_status_open on tasks (status) where status in ('pending','answering','answered','extracting');

create table answers (
  task_id      uuid primary key references tasks(id) on delete cascade,
  answer_text  text not null default '',
  web_searched boolean not null default false,
  raw          jsonb,
  usage        jsonb,
  latency_ms   int,
  created_at   timestamptz not null default now()
);

create table searches (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  ord        int not null,
  query      text not null,
  created_at timestamptz not null default now()
);
create index searches_task on searches (task_id);

create table sources (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references tasks(id) on delete cascade,
  ord            int not null,
  url            text not null,
  title          text,
  domain         text,
  root_domain    text,
  source_type    source_type not null default 'other',
  brand_id       uuid references brands(id),
  marketplace_id uuid references marketplaces(id),
  cited          boolean not null default false,
  created_at     timestamptz not null default now()
);
create index sources_task on sources (task_id);
create index sources_brand on sources (brand_id) where brand_id is not null;

create table decisions (
  task_id             uuid primary key references tasks(id) on delete cascade,
  mentioned_brand_ids uuid[] not null default '{}',
  shortlist_brand_ids uuid[] not null default '{}',
  pick_brand_id       uuid references brands(id),
  pick_brand_name     text,
  pick_product        text,
  pick_price_inr      int,
  pick_channel        text,               -- 'brand_site' | marketplace name | 'unknown'
  pick_url            text,
  pick_delivery_days  int,
  fits_budget         tri not null default 'unknown',
  fits_deadline       tri not null default 'unknown',
  reasoning_excerpt   text,
  extractor_model     text,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);

create table decision_rejections (
  task_id    uuid not null references tasks(id) on delete cascade,
  brand_id   uuid not null references brands(id),
  reason     loss_reason not null,
  note       text,
  created_at timestamptz not null default now(),
  primary key (task_id, brand_id)
);

create table run_fixes (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references runs(id) on delete cascade,
  ord        int not null check (ord between 1 and 3),
  title      text not null,
  why        text not null,
  action     text not null,
  fix_type   fix_type not null,
  evidence   jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (run_id, ord)
);

create table model_prices (
  model             text primary key,
  input_usd_per_m   numeric not null,
  output_usd_per_m  numeric not null,
  search_usd_per_1k numeric not null default 0,
  created_at        timestamptz not null default now()
);

create table app_config (
  key        text primary key,   -- lease_until, last_kick_at, last_kick_status, breaker_until_<assistant>, fails_in_row_<assistant>
  value      text,
  created_at timestamptz not null default now()
);

-- RLS on every table, no policies: only the service role reads or writes.
do $$
declare t text;
begin
  foreach t in array array['settings','assistants','brands','marketplaces','products','queries','runs','tasks',
                           'answers','searches','sources','decisions','decision_rejections','run_fixes',
                           'model_prices','app_config']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
