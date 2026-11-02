try {
  const { getConsent, setConsent, isOptedOut } = await import("/analytics/lib.js");
  const { GA_MEASUREMENT_ID } = await import("/analytics/config.js");

  const STYLE = `
.ace-consent{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:50;
  max-width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px;
  background:var(--bg);color:var(--fg);border:1px solid var(--muted,#888);border-radius:10px;
  font-size:0.78rem;line-height:1.45;font-family:inherit;box-shadow:0 4px 18px rgba(0,0,0,.18)}
.ace-consent p{margin:0 0 10px}
.ace-consent a{color:var(--accent);text-decoration:underline}
.ace-consent-actions{display:flex;gap:8px}
.ace-consent button{font:inherit;cursor:pointer;padding:5px 14px;border-radius:6px;
  border:1px solid var(--accent);background:transparent;color:var(--fg)}
.ace-consent button[data-choice="accepted"]{background:var(--accent);color:var(--accent-fg)}
.ace-consent button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (max-width:480px){.ace-consent{bottom:84px}}`;

  // gtag honours window['ga-disable-<ID>']: true stops it sending anything further.
  function setGADisabled(disabled) {
    try {
      if (GA_MEASUREMENT_ID) window["ga-disable-" + GA_MEASUREMENT_ID] = disabled;
    } catch {}
  }

  let gaLoaded = false;
  function loadGA() {
    try {
      if (!GA_MEASUREMENT_ID || isOptedOut(localStorage)) return;
      if (getConsent(localStorage) !== "accepted") return;
      setGADisabled(false);
      if (gaLoaded) return;
      gaLoaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
      document.head.appendChild(s);
      window.gtag("config", GA_MEASUREMENT_ID);
    } catch {}
  }

  let banner = null;
  function open() {
    try {
      if (banner) return;
      if (!document.getElementById("ace-consent-style")) {
        const st = document.createElement("style");
        st.id = "ace-consent-style";
        st.textContent = STYLE;
        document.head.appendChild(st);
      }
      banner = document.createElement("div");
      banner.className = "ace-consent";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Cookie consent");
      banner.innerHTML =
        "<p>I use cookies to understand how people find this site. " +
        'Anonymous visit counts are recorded either way. <a href="/privacy">Privacy</a></p>' +
        '<div class="ace-consent-actions">' +
        '<button type="button" data-choice="accepted">Accept</button>' +
        '<button type="button" data-choice="declined">Decline</button></div>';
      banner.addEventListener("click", (e) => {
        const btn = e.target.closest && e.target.closest("button[data-choice]");
        if (!btn) return;
        try {
          const choice = btn.getAttribute("data-choice");
          setConsent(localStorage, choice);
          if (choice === "declined") setGADisabled(true);
          banner.remove();
          banner = null;
          window.dispatchEvent(new CustomEvent("ace:consent", { detail: choice }));
          if (choice === "accepted") loadGA();
        } catch {}
      });
      document.body.appendChild(banner);
    } catch {}
  }

  window.aceConsent = { open };
  if (getConsent(localStorage) === null) {
    open();
  } else {
    loadGA();
  }
} catch {}
