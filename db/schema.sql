create table if not exists pageviews (
  id bigserial primary key,
  page_id uuid unique not null,
  created_at timestamptz default now(),
  path text,
  referrer text,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  country text,
  region text,
  city text,
  device text,
  browser text,
  browser_version text,
  os text,
  os_version text,
  screen_w int,
  screen_h int,
  viewport_w int,
  viewport_h int,
  language text,
  timezone text,
  visitor_id uuid,
  session_id uuid,
  ip inet,
  ip_anonymized boolean default false,
  engaged_ms int default 0,
  max_scroll_pct smallint default 0
);

create table if not exists events (
  id bigserial primary key,
  created_at timestamptz default now(),
  page_id uuid,
  name text not null,
  label text,
  visitor_id uuid,
  session_id uuid
);

create index if not exists pageviews_created_at_idx on pageviews (created_at);
create index if not exists events_created_at_idx on events (created_at);
create index if not exists pageviews_unanonymized_ip_idx on pageviews (created_at) where ip is not null and not ip_anonymized;
