// Minimal hand-rolled user-agent parsing. Order matters: Edge, Samsung and
// Opera all also contain "Chrome"; Chrome also contains "Safari".

const BOT_RE = /bot|crawl|spider|slurp|headless|curl|wget|python-requests|python-urllib|httpclient|go-http-client|axios|node-fetch|postman|lighthouse|facebookexternalhit|preview|monitor|uptime|phantomjs|puppeteer|playwright/i;

export function isBot(ua) {
  if (typeof ua !== "string" || ua.trim() === "") return true;
  return BOT_RE.test(ua);
}

const BROWSERS = [
  ["Edge", /\b(?:Edg|EdgA|EdgiOS|Edge)\/([\d.]+)/],
  ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
  ["Opera", /\b(?:OPR|OPiOS)\/([\d.]+)/],
  ["Chrome", /\b(?:Chrome|CriOS)\/([\d.]+)/],
  ["Firefox", /\b(?:Firefox|FxiOS)\/([\d.]+)/],
  ["Safari", /\bVersion\/([\d.]+).*Safari\//],
];

function detectOs(ua) {
  let m;
  if ((m = ua.match(/\b(?:iPhone|CPU) OS ([\d_]+)/)) && /iPhone|iPad|iPod/.test(ua)) return ["iOS", m[1].replace(/_/g, ".")];
  if (/iPhone|iPad|iPod/.test(ua)) return ["iOS", ""];
  if ((m = ua.match(/Android ([\d.]+)/))) return ["Android", m[1]];
  if (/Android/.test(ua)) return ["Android", ""];
  if ((m = ua.match(/Windows NT ([\d.]+)/))) return ["Windows", m[1]];
  if ((m = ua.match(/Mac OS X ([\d_.]+)/))) return ["macOS", m[1].replace(/_/g, ".")];
  if (/CrOS/.test(ua)) return ["ChromeOS", ""];
  if (/Linux|X11/.test(ua)) return ["Linux", ""];
  return ["", ""];
}

function detectDevice(ua, os) {
  if (/iPad|Tablet/i.test(ua) || (os === "Android" && !/Mobile/.test(ua))) return "tablet";
  if (/iPhone|iPod|Mobile/.test(ua)) return "mobile";
  if (os) return "desktop";
  return "unknown";
}

export function parseUserAgent(ua) {
  const s = typeof ua === "string" ? ua : "";
  let browser = "";
  let browserVersion = "";
  for (const [name, re] of BROWSERS) {
    const m = s.match(re);
    if (m) {
      browser = name;
      browserVersion = m[1];
      break;
    }
  }
  const [os, osVersion] = detectOs(s);
  return { device: detectDevice(s, os), browser, browserVersion, os, osVersion };
}
