export const DASHBOARD_TZ = "UTC";
export const RANGES = { today: 1, "7d": 7, "30d": 30, all: null };

const TOP = 20;
const num = (v) => Number(v ?? 0);

// Dimension tables: [key, select/group expression columns, extra where]
const since = "created_at >= $1::date::timestamp AT TIME ZONE $2";

function topQuery(columns, where = "true", table = "pageviews") {
  const cols = columns.join(", ");
  return `select ${cols}, count(*) as n from ${table}
          where ${since} and ${where}
          group by ${cols} order by n desc, ${cols} limit ${TOP}`;
}

export async function getStats(query, range, now = new Date()) {
  if (!Object.hasOwn(RANGES, range)) throw new Error(`bad range: ${range}`);
  const days = RANGES[range];

  const [bounds] = await query(
    `select to_char(d, 'YYYY-MM-DD') as today,
            to_char(case when $3::int is null
                         then coalesce((select min(created_at) at time zone $2 from pageviews)::date, d)
                         else d - ($3::int - 1) end, 'YYYY-MM-DD') as since
     from (select ($1::timestamptz at time zone $2)::date as d) t`,
    [now.toISOString(), DASHBOARD_TZ, days],
  );
  const p = [bounds.since, DASHBOARD_TZ];

  const [totals, series, referrers, campaigns, countries, cities, devices, browsers, os, events, engagement, recent] =
    await Promise.all([
      query(
        `select count(*) as views, count(distinct visitor_id) as visitors, count(distinct session_id) as sessions
         from pageviews where ${since}`, p),
      query(
        `select to_char(g.day, 'YYYY-MM-DD') as day, count(p.id) as views, count(distinct p.visitor_id) as visitors
         from generate_series($1::date, $3::date, '1 day') as g(day)
         left join pageviews p on (p.created_at at time zone $2)::date = g.day::date
         group by g.day order by g.day`, [...p, bounds.today]),
      query(topQuery(["referrer_domain"], "referrer_domain is not null"), p),
      query(topQuery(["utm_source", "utm_medium", "utm_campaign"],
        "(utm_source is not null or utm_medium is not null or utm_campaign is not null)"), p),
      query(topQuery(["country"], "country is not null"), p),
      query(topQuery(["country", "region", "city"], "city is not null"), p),
      query(topQuery(["device"], "device is not null"), p),
      query(topQuery(["browser"], "browser is not null"), p),
      query(topQuery(["os"], "os is not null"), p),
      query(topQuery(["name", "label"], "true", "events"), p),
      query(
        `select avg(engaged_ms) filter (where engaged_ms > 0) as ms,
                avg(max_scroll_pct) filter (where engaged_ms > 0) as scroll
         from pageviews where ${since}`, p),
      query(
        `select created_at, path, referrer_domain, country, city, device, browser, os,
                host(ip) as ip, utm_campaign
         from pageviews order by created_at desc, id desc limit 50`),
    ]);

  const eng = engagement[0] ?? {};
  return {
    range,
    totals: { views: num(totals[0].views), visitors: num(totals[0].visitors), sessions: num(totals[0].sessions) },
    series: series.map((r) => ({ day: r.day, views: num(r.views), visitors: num(r.visitors) })),
    referrers: referrers.map((r) => ({ domain: r.referrer_domain, views: num(r.n) })),
    campaigns: campaigns.map((r) => ({ source: r.utm_source, medium: r.utm_medium, campaign: r.utm_campaign, views: num(r.n) })),
    countries: countries.map((r) => ({ country: r.country, views: num(r.n) })),
    cities: cities.map((r) => ({ country: r.country, region: r.region, city: r.city, views: num(r.n) })),
    devices: devices.map((r) => ({ device: r.device, views: num(r.n) })),
    browsers: browsers.map((r) => ({ browser: r.browser, views: num(r.n) })),
    os: os.map((r) => ({ os: r.os, views: num(r.n) })),
    events: events.map((r) => ({ name: r.name, label: r.label, count: num(r.n) })),
    engagement: { avgEngagedMs: Math.round(num(eng.ms)), avgScrollPct: Math.round(num(eng.scroll)) },
    recent: recent.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })),
  };
}
