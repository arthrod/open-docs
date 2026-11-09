/**
 * Ship browser errors to the server so they land in the val's logs.
 *
 * Loaded as a CLASSIC script at the very top of <head>, so it is listening
 * before any stylesheet, module, or CDN import can fail. No imports/exports on
 * purpose — it must run as a plain script.
 */
(() => {
  const seen = new Set<string>();
  const slug = () => document.body?.dataset.slug ?? location.pathname;

  function send(kind: string, msg: unknown, extra?: unknown) {
    const text = String(msg ?? "").slice(0, 2000);
    const key = `${kind}:${text}`;
    if (seen.has(key) || seen.size > 60) return;
    seen.add(key);
    fetch("/api/log", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: slug(),
        kind,
        msg: text,
        extra: String(extra ?? "").slice(0, 4000),
        w: innerWidth,
        h: innerHeight,
      }),
    }).catch(() => {});
  }

  const fmt = (a: unknown) => {
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    if (typeof a === "string") return a;
    try {
      return JSON.stringify(a)?.slice(0, 500);
    } catch {
      return String(a);
    }
  };

  // Capture phase also catches <script>/<link>/<img> load failures.
  addEventListener("error", (e) => {
    const t = e.target as HTMLScriptElement & HTMLLinkElement;
    if (t && (t as unknown) !== window && (t.src || t.href)) {
      send("resource", `failed to load <${t.tagName.toLowerCase()}> ${t.src || t.href}`);
    } else {
      const ev = e as ErrorEvent;
      send("error", `${ev.message} @ ${ev.filename}:${ev.lineno}`, ev.error?.stack);
    }
  }, true);

  addEventListener("unhandledrejection", (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    send("rejection", fmt(r), r?.stack);
  });

  for (const level of ["error", "warn"] as const) {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      orig(...args);
      const err = args.find((a) => a instanceof Error) as Error | undefined;
      send(level, args.map(fmt).join(" "), err?.stack);
    };
  }

  (window as unknown as { __odlog: typeof send }).__odlog = send;
  addEventListener("DOMContentLoaded", () => send("load", "page loaded"));
})();
