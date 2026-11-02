// Full IPs are kept for 90 days, then masked: IPv4 to /24, IPv6 to /48.
const RETENTION_INTERVAL = "90 days";

// Returns the number of rows anonymised by this run.
export async function anonymizeOldIps(query, now = new Date()) {
  const rows = await query(
    `UPDATE pageviews SET ip = host(network(set_masklen(ip, CASE WHEN family(ip)=4 THEN 24 ELSE 48 END)))::inet, ip_anonymized = true
     WHERE ip IS NOT NULL AND NOT ip_anonymized AND created_at < $1::timestamptz - interval '${RETENTION_INTERVAL}'
     RETURNING id`,
    [now.toISOString()],
  );
  return rows.length;
}
