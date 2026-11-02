try {
  const lib = await import("/analytics/lib.js");
  const { isOptedOut, getConsent, getIds, parseUtm, scrollPercent } = lib;

  if (!isOptedOut(localStorage) && !location.pathname.startsWith("/dashboard")) {
    const pageId = crypto.randomUUID();

    const ids = () => {
      if (getConsent(localStorage) !== "accepted") return {};
      try { return getIds(localStorage, Date.now(), () => crypto.randomUUID()); } catch { return {}; }
    };

    function send(payload) {
      try {
        const body = JSON.stringify(payload);
        if (navigator.sendBeacon && navigator.sendBeacon("/api/collect", body)) return;
        fetch("/api/collect", { method: "POST", body, keepalive: true }).catch(() => {});
      } catch {}
    }

    function base(type) {
      const accepted = getConsent(localStorage) === "accepted";
      return { type, pageId, consent: accepted, ...ids() };
    }

    function track(name, label) {
      try {
        const p = { ...base("event"), name };
        if (label) p.label = label;
        send(p);
        if (typeof window.gtag === "function") window.gtag("event", name, label ? { label } : {});
      } catch {}
    }

    send({
      ...base("pageview"),
      path: location.pathname,
      referrer: document.referrer || "",
      utm: parseUtm(location.search),
      screen: { w: screen.width, h: screen.height },
      viewport: { w: innerWidth, h: innerHeight },
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    document.addEventListener("click", (e) => {
      try {
        const t = e.target;
        if (!t || !t.closest) return;
        const a = t.closest("[data-analytics]");
        if (a) track("footer_click", a.getAttribute("data-analytics"));
        else if (t.closest("#openModalBtn")) track("modal_open");
      } catch {}
    });
    document.addEventListener("ace:contact-submitted", () => track("contact_submit"));

    // Engagement: visible time and deepest scroll.
    let engagedMs = 0;
    let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
    let maxScroll = 0;
    const measureScroll = () => {
      try {
        const de = document.documentElement;
        maxScroll = Math.max(maxScroll, scrollPercent(scrollY, innerHeight, de.scrollHeight));
      } catch {}
    };
    measureScroll();
    addEventListener("scroll", measureScroll, { passive: true });
    const pause = () => {
      if (visibleSince !== null) { engagedMs += performance.now() - visibleSince; visibleSince = null; }
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") pause();
      else if (visibleSince === null) visibleSince = performance.now();
    });
    let sent = false;
    addEventListener("pagehide", () => {
      try {
        if (sent) return;
        sent = true;
        pause();
        measureScroll();
        send({ type: "engagement", pageId, engagedMs: Math.round(engagedMs), scrollPct: maxScroll });
      } catch {}
    });
  }
} catch {}
