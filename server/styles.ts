/** Shared chrome stylesheet. Editor pages only. Landing imports DS_ROOT. */

export const FONT_SANS_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/libre-franklin@5.3.0/files/libre-franklin-latin-wght-normal.woff2";
export const FONT_MONO_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/roboto-mono@5.3.0/files/roboto-mono-latin-wght-normal.woff2";

/** benchmarks.law v2 tokens. Pinned jsDelivr faces; Val Town cannot host the woff2 files. */
export const DS_ROOT = `
@font-face{font-family:"Libre Franklin";font-style:normal;font-weight:100 900;font-display:swap;src:url("${FONT_SANS_URL}") format("woff2")}
@font-face{font-family:"Roboto Mono";font-style:normal;font-weight:100 700;font-display:swap;src:url("${FONT_MONO_URL}") format("woff2")}
:root{
  color-scheme:light;
  --bg:#FAFAF8; --surface:#FFFFFF; --hover:#F2F2EE; --row-hover:#FCFCF6; --code-bg:#F1F1EE;
  --ink:#0A0A0A; --ink-prose:#1E1E1E; --ink-soft:#2A2A2A; --ink-body:#333333; --ink-quiet:#444444;
  --muted:#6B6B6B; --link-rule:#B5B5B0; --faint:#E8E8E5; --mark:#FFD400; --mark-text:var(--ink);
  --del:#B4232F; --ins:#2A6FDB; --green-ink:#166B43;
  --on-dark:#C9C9C4; --on-dark-muted:#9A9A96; --footer-text:#8C8C88;
  --disclaimer:#A3A39E; --disclaimer-strong:#D6D6D1; --dark-rule:#222222; --dark-border:#333333;
  --shadow-offset:7px 7px 0 #FFD400;
  --radius-0:0; --border-ink:1px solid #0A0A0A; --border-faint:1px solid #E8E8E5; --bar-mark:3px solid #FFD400;
  --font-sans:"Libre Franklin",system-ui,-apple-system,sans-serif;
  --font-mono:"Roboto Mono",ui-monospace,monospace;
  --page-max:1180px;
}
`;

/** SiteNav wordmark and crumb. Scoped under `.site-nav` so it cannot reach a vendor editor. */
export const WORDMARK_CSS = `
.site-nav .wm {
  display: inline-flex; align-items: center; gap: 6px; flex: none;
  font-family: var(--font-mono); font-weight: 700; font-size: 13px; line-height: 1.4;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink);
  text-decoration: none; white-space: nowrap;
}
.site-nav .wm:hover .ins {
  background-image: linear-gradient(var(--mark), var(--mark));
  background-repeat: no-repeat; background-size: 100% 0.55em; background-position: 0 78%;
}
.site-nav .wm:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.site-nav .logo { display: inline-flex; align-items: center; gap: 6px; }
.site-nav .wm .dot { color: color-mix(in srgb, var(--ink) 35%, transparent); }
.site-nav .del {
  color: var(--del); text-decoration: line-through; text-decoration-thickness: 2px;
  text-decoration-color: var(--del);
}
.site-nav .ins {
  color: var(--ins); text-decoration: underline double; text-decoration-color: var(--ins);
  text-underline-offset: 3px;
}
.site-nav .crumb {
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted); white-space: nowrap; flex: none;
}
`;

export const SHELL_CSS = DS_ROOT + WORDMARK_CSS + `
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  height: 100dvh; margin: 0; background: var(--bg);
  display: flex; flex-direction: column; overflow: hidden;
  /* Size only, and a generic sans. The previous chrome set 13px on body, and
     several editors size off that. Libre Franklin, ink, and tracking stay on
     our own classes so they do not paint the vendor mount or a node portaled
     to body. */
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px; line-height: 1.45;
}
/* Brand type and color live on our chrome, not on body. */
.od-bar, .od-sub, .od-aside, .od-dialog, .od-loading, .od-error {
  font-family: var(--font-sans); font-size: 13px; line-height: 1.45; color: var(--ink);
  letter-spacing: -0.01em; -webkit-font-smoothing: antialiased;
}
.od-bar ::selection, .od-sub ::selection, .od-aside ::selection, .od-dialog ::selection,
.od-loading ::selection, .od-error ::selection { background: var(--mark); color: var(--mark-text); }

/* ------------------------------ top bar ------------------------------ */
.od-bar {
  position: sticky; top: 0; z-index: 60; display: flex; align-items: center; gap: 10px 14px;
  flex: none; flex-wrap: nowrap; min-height: 52px; height: auto; padding: 8px 12px; min-width: 0;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  -webkit-backdrop-filter: saturate(140%) blur(10px); backdrop-filter: saturate(140%) blur(10px);
  border-bottom: 1px solid var(--ink);
}
.od-spacer { flex: 1; min-width: 4px; }
.od-switch { position: relative; display: inline-flex; align-items: center; flex: none; min-width: 0; }
.od-switch::after {
  content: "↓"; position: absolute; right: 8px; pointer-events: none;
  font-family: var(--font-mono); font-size: 11px; color: var(--muted);
}
.od-switch select {
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
  color: var(--ink); max-width: 180px; height: 32px; padding: 0 28px 0 10px;
  border: 1px solid var(--ink); border-radius: 0; background: var(--surface);
  appearance: none; cursor: pointer;
}
.od-switch select:hover { background: var(--hover); }
.od-switch-ico { display: none; }
.od-switch select:focus, .od-switch select:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

.od-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-family: var(--font-mono); font-size: 11px; font-weight: 400; letter-spacing: 0.04em;
  text-transform: uppercase; line-height: 1.2; height: 32px; padding: 0 10px;
  border-radius: var(--radius-0); border: 1px solid var(--ink); background: var(--surface); color: var(--ink);
  cursor: pointer; white-space: nowrap; text-decoration: none;
}
.od-btn:hover:not([disabled]) { background: var(--mark); color: var(--ink); }
.od-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.od-btn[disabled] { opacity: .45; cursor: progress; }
.od-btn.primary { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.od-btn.primary:hover:not([disabled]) { background: var(--mark); color: var(--ink); }
.od-btn.primary .arr { color: var(--mark); }
.od-btn.primary:hover .arr { color: var(--ink); }
.od-btn.icon { width: 32px; padding: 0; }
#od-toggle-agent[aria-pressed="true"], .od-menu-btn[aria-expanded="true"] {
  background: var(--mark); color: var(--ink); border-color: var(--ink);
}
.od-menu-btn { flex: none; }
.od-burger {
  display: inline-flex; flex-direction: column; justify-content: space-between;
  width: 14px; height: 11px; flex: none;
}
.od-burger i { display: block; height: 1px; background: currentColor; width: 100%; }
.od-menu-wrap { position: relative; }
.od-menu {
  position: absolute; right: 0; top: 40px; min-width: 290px; max-height: calc(100dvh - 64px);
  overflow: auto; background: var(--surface); border: 1px solid var(--ink); border-radius: var(--radius-0);
  box-shadow: var(--shadow-offset); padding: 6px; display: flex; flex-direction: column; z-index: 50;
}
.od-menu[hidden] { display: none; }
.od-menu > button, .od-menu > a {
  font-family: var(--font-sans); font-size: 14px; letter-spacing: -0.01em; text-transform: none;
  text-align: left; padding: 8px 10px; border: 0; background: none; border-radius: var(--radius-0);
  color: var(--ink); text-decoration: none; cursor: pointer;
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
}
.od-menu > button:hover, .od-menu > a:hover { background: var(--mark); }
.od-menu > button:focus-visible, .od-menu > a:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.od-menu kbd {
  margin-left: auto; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--muted);
}
.od-menu small { flex-basis: 100%; margin-top: -2px; font-size: 12px; color: var(--muted); }
.od-menu-label {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px 2px;
  font-family: var(--font-mono); font-size: 11px; font-weight: 400; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--muted);
}
.od-menu-label .sq { width: 9px; height: 9px; background: var(--mark); display: inline-block; flex: none; }
.od-menu hr { border: 0; border-top: 1px solid var(--faint); margin: 4px 2px; }
.od-menu-note { font-size: 12.5px; color: var(--ink-quiet); padding: 4px 10px 8px; max-width: 290px; line-height: 1.45; }

.od-metrics {
  display: flex; align-items: stretch; gap: 0; height: 36px; border: 1px solid var(--ink);
  border-radius: var(--radius-0); background: var(--surface); padding: 0; cursor: pointer; color: var(--ink);
  overflow: hidden; font: inherit; box-shadow: inset 3px 0 0 var(--faint);
}
.od-metrics:hover { background: var(--mark); }
.od-metrics:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.od-metrics .m {
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  padding: 0 10px; line-height: 1.1;
}
.od-metrics .m + .m { border-left: 1px solid var(--faint); }
.od-metrics b {
  font-family: var(--font-sans); font-weight: 700; font-size: 12.5px;
  font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 5px;
}
.od-metrics .m:first-child { position: relative; padding-left: 18px; }
.od-metrics .dot {
  position: absolute; left: 7px; top: 50%; width: 6px; height: 6px; margin-top: -3px;
  border-radius: var(--radius-0); background: var(--muted);
}
.od-metrics.ok { box-shadow: inset 3px 0 0 var(--mark); }
.od-metrics.ok .dot { background: var(--green-ink); }
.od-metrics.err { box-shadow: inset 3px 0 0 var(--del); }
.od-metrics.err .dot { background: var(--del); }
.od-metrics.loading { box-shadow: inset 3px 0 0 var(--mark); }
.od-metrics.loading .dot { background: var(--mark); animation: od-pulse 1s infinite; }
.od-metrics small {
  font-family: var(--font-mono); font-size: 10px; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px;
}
@keyframes od-pulse { 50% { opacity: .35; } }

.od-sub {
  display: flex; align-items: center; gap: 10px; padding: 6px 12px; min-height: 32px;
  background: var(--bg); border-bottom: 1px solid var(--faint); color: var(--ink-quiet);
}
.od-sub code {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0; color: var(--ink);
  background: var(--code-bg); border: 1px solid var(--faint); border-radius: var(--radius-0); padding: 1px 5px;
}
.od-lic, .od-viewonly {
  font-family: var(--font-mono); font-size: 10.5px; font-weight: 400; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--ink); border: 1px solid var(--ink); border-radius: var(--radius-0);
  padding: 2px 7px; white-space: nowrap; background: var(--surface);
}
.od-viewonly { background: var(--mark); }
.od-blurb { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.od-status {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--muted); max-width: 52ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.od-status.err { color: var(--del); } .od-status.ok { color: var(--green-ink); }

/* ------------------------------ layout ------------------------------ */
.od-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 10px; padding: 10px; }
.od-layout.no-agent { grid-template-columns: minmax(0, 1fr); }
.od-layout.no-agent .od-aside { display: none; }
.od-aside-close { display: none; }
@media (max-width: 1100px) { .od-blurb { display: none; } }
@media (max-width: 900px) {
  .od-layout, .od-layout.no-agent { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 6px; }
  .od-aside {
    position: fixed; z-index: 60; left: 8px; right: 8px; bottom: 8px; height: min(78dvh, 600px);
    box-shadow: var(--shadow-offset); border: 1px solid var(--ink);
  }
  .od-layout.no-agent .od-aside { display: none; }
  .od-aside-close { display: inline-flex; height: 28px; width: 28px; }
  .od-pkg { display: none; }
}
/* One row always. The spacer pushes dropdown, metrics, AI, and MENU right. Under 1180px the crumb drops. */
@media (max-width: 1180px) { .od-bar .crumb { display: none; } }
/* Phones: the editor dropdown is a boxed numpad icon (the native select sits over it, transparent, so a tap opens the platform picker) and MENU is the boxed burger alone. */
@media (max-width: 760px) {
  .od-metrics { display: none; }
  .od-switch { width: 32px; height: 32px; justify-content: center; border: 1px solid var(--ink); background: var(--surface); }
  .od-switch:hover { background: var(--hover); }
  .od-switch::after { content: none; }
  .od-switch-ico { display: block; pointer-events: none; }
  .od-switch select { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; padding: 0; opacity: 0; }
  .od-menu-lbl { display: none; }
  .od-menu-btn { width: 32px; height: 32px; padding: 0; justify-content: center; }
}
@media (max-width: 640px) {
  .od-bar { gap: 6px; padding: 6px 8px; }
  .od-menu-wrap { position: static; }
  .od-menu { position: absolute; left: 8px; right: 8px; top: 100%; min-width: 0; width: auto; }
  .od-sub { padding: 4px 10px; min-height: 0; }
  .od-sub .od-lic { display: none; }
}
/* The stage needs a definite height. Paged editors virtualise against their scroll parent. */
.od-stage {
  position: relative; height: 100%; min-height: 0; background: var(--surface);
  border: 1px solid var(--ink); border-radius: var(--radius-0); overflow: hidden;
  display: flex; flex-direction: column;
}
.od-stage > *:not(.od-loading):not(.od-error) { flex: 1 1 auto; min-height: 0; }
.od-loading {
  position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; gap: 14px;
  background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(2px); color: var(--muted);
}
.od-loading[hidden] { display: none; }
.od-loading strong {
  display: block; color: var(--ink); font-size: 15px; font-weight: 650; letter-spacing: -0.015em; margin-bottom: 2px;
}
.od-loading .spinner {
  width: 18px; height: 18px; border-radius: var(--radius-0);
  border: 2px solid var(--faint); border-top-color: var(--mark); animation: od-spin .8s linear infinite;
}
@keyframes od-spin { to { transform: rotate(360deg); } }
.od-error { position: absolute; inset: 0; z-index: 25; overflow: auto; padding: 28px; background: var(--surface); }
.od-error h3 { margin: 0 0 6px; font-size: 16px; font-weight: 650; letter-spacing: -0.02em; color: var(--del); }
.od-error p { margin: 0 0 12px; color: var(--ink-quiet); }
.od-error pre {
  font-family: var(--font-mono); font-size: 12px; line-height: 1.55; letter-spacing: 0; color: var(--ink);
  background: var(--bg); border: 1px solid var(--ink); border-left: var(--bar-mark); border-radius: var(--radius-0);
  padding: 14px; white-space: pre-wrap; word-break: break-word;
}

/* ------------------------------ assistant ------------------------------ */
.od-aside {
  min-height: 0; background: var(--surface); border: 1px solid var(--ink); border-radius: var(--radius-0);
  display: flex; flex-direction: column; overflow: hidden;
}
.od-aside-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--ink);
}
.od-aside h2 {
  display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 12px;
  font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0;
}
.od-aside h2 .sq { width: 9px; height: 9px; background: var(--mark); display: inline-block; flex: none; }
.od-model {
  display: block; margin-top: 4px; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted);
}
.od-auto {
  display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); cursor: pointer; user-select: none;
}
.od-auto input { accent-color: var(--ink); margin: 0; }
.od-log { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 10px; padding: 14px; min-height: 80px; }
.od-msg {
  border-radius: var(--radius-0); padding: 8px 11px; line-height: 1.5; white-space: pre-wrap;
  word-break: break-word; font-size: 13.5px; max-width: 94%;
}
.od-msg.user { background: var(--ink); color: var(--bg); align-self: flex-end; }
.od-msg.bot { background: var(--surface); border: 1px solid var(--faint); align-self: flex-start; color: var(--ink-prose); }
.od-msg.err { background: var(--surface); border: 1px solid var(--del); color: var(--del); }
.od-msg .who {
  display: block; font-family: var(--font-mono); font-size: 10.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 3px;
}
.od-msg.user .who { color: color-mix(in srgb, var(--bg) 72%, transparent); }
.od-msg.thinking .who::after { content: " · thinking"; }
.od-msg.thinking span.dots::after { content: "…"; animation: od-pulse 1s infinite; }
.od-edit {
  border: 1px solid var(--ink); border-left: var(--bar-mark); background: var(--surface);
  border-radius: var(--radius-0); padding: 10px 11px; font-size: 13px;
  display: flex; flex-direction: column; gap: 7px; align-self: stretch;
}
.od-edit strong { font-size: 14px; font-weight: 650; letter-spacing: -0.01em; }
.od-edit .diff { color: var(--muted); font-size: 12.5px; }
.od-edit .diff b { color: var(--green-ink); font-weight: 650; }
.od-edit .diff i { color: var(--del); font-style: normal; font-weight: 650; }
.od-edit details summary { cursor: pointer; color: var(--ink); font-size: 12.5px; }
.od-edit pre {
  white-space: pre-wrap; font-family: var(--font-mono); font-size: 12px; line-height: 1.5; letter-spacing: 0;
  max-height: 200px; overflow: auto; margin: 6px 0 0; background: var(--bg);
  border: 1px solid var(--faint); border-radius: var(--radius-0); padding: 8px; color: var(--ink);
}
.od-edit .row { display: flex; gap: 6px; align-items: center; }
.od-edit .state { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--green-ink); margin-left: auto; }
.od-edit.applied { background: var(--surface); border-color: var(--green-ink); border-left-color: var(--green-ink); }
.od-edit.undone { background: var(--bg); border-color: var(--faint); border-left-color: var(--muted); opacity: .85; }
.od-edit .od-btn { height: 28px; font-size: 11px; }
.od-suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 10px; }
.od-suggestions button {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase;
  padding: 6px 8px; border-radius: var(--radius-0); border: 1px solid var(--ink);
  background: var(--surface); cursor: pointer; color: var(--ink);
}
.od-suggestions button:hover { background: var(--mark); }
.od-suggestions button:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.od-input { display: flex; gap: 6px; align-items: flex-end; padding: 10px 12px 12px; border-top: 1px solid var(--ink); }
.od-input textarea {
  flex: 1; resize: none; min-height: 40px; max-height: 140px;
  font-family: var(--font-sans); font-size: 14px; line-height: 1.45; letter-spacing: -0.01em; color: var(--ink);
  padding: 8px 10px; border: 1px solid var(--ink); border-radius: var(--radius-0); background: var(--surface);
}
.od-input textarea:focus { outline: 2px solid var(--ink); outline-offset: 3px; }
.od-input .od-btn { height: 40px; width: 40px; padding: 0; }

/* ------------------------------ metrics dialog ------------------------------ */
.od-dialog {
  border: 1px solid var(--ink); border-radius: var(--radius-0); padding: 0;
  width: min(640px, 94vw); max-width: 94vw; background: var(--surface);
  box-shadow: var(--shadow-offset); color: var(--ink);
}
.od-dialog::backdrop { background: color-mix(in srgb, var(--ink) 40%, transparent); }
.od-dialog header {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 16px; border-bottom: 1px solid var(--ink);
}
.od-dialog h3 { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }
.od-dialog footer { padding: 12px 16px; border-top: 1px solid var(--faint); text-align: right; }
.od-dialog footer a {
  font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--ink); text-decoration: none; padding-bottom: 2px;
  background-image: linear-gradient(var(--mark), var(--mark)); background-repeat: no-repeat;
  background-size: 0% 42%; background-position: 0 88%; transition: background-size .25s ease;
}
.od-dialog footer a:hover { background-size: 100% 42%; }
.od-dialog footer a:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.od-name-dialog { width: min(420px, 94vw); }
.od-name-dialog .od-name-body {
  display: flex; flex-direction: column; gap: 8px; padding: 16px;
}
.od-name-dialog label {
  font-family: var(--font-mono); font-size: 11px; font-weight: 400;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
}
.od-name-dialog input {
  font-family: var(--font-sans); font-size: 14px; font-weight: 600; letter-spacing: -0.01em;
  color: var(--ink); width: 100%; height: 36px; padding: 0 10px;
  border: 1px solid var(--ink); border-radius: var(--radius-0); background: var(--surface);
}
.od-name-dialog input:focus, .od-name-dialog input:focus-visible {
  outline: 2px solid var(--ink); outline-offset: 3px;
}
.od-name-dialog footer { display: flex; justify-content: flex-end; gap: 8px; }
#od-metrics-body { padding: 16px; max-height: 64vh; overflow: auto; }
#od-metrics-body h4 {
  font-family: var(--font-mono); font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--muted); font-size: 11px;
}
.od-kpis {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--faint);
  border: 1px solid var(--ink); margin-bottom: 14px;
}
.od-kpi { background: var(--surface); padding: 12px; border-radius: var(--radius-0); }
.od-kpi b {
  display: block; font-size: 22px; font-weight: 700; letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums; line-height: 1;
}
.od-kpi small {
  display: block; margin-top: 6px; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted);
}
.od-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.od-table th, .od-table td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--faint); }
.od-table th {
  font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--muted); border-bottom-color: var(--ink); background: var(--bg);
}
.od-table td.n { text-align: right; font-family: var(--font-mono); font-size: 12px; font-variant-numeric: tabular-nums; }
.od-note { font-family: var(--font-sans); font-size: 12.5px; color: var(--muted); margin: 10px 0 0; line-height: 1.5; }
.od-note code { font-family: var(--font-mono); font-size: 0.92em; background: var(--code-bg); padding: 0 3px; }
@media (max-width: 520px) { .od-kpis { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) {
  .od-loading .spinner, .od-metrics.loading .dot, .od-msg.thinking span.dots::after { animation: none; }
  .od-dialog footer a { transition: none; }
}

/* ---- embed mode ---- */
/* ?embed=1 renders no header and no .od-sub. The stage fills the iframe.
   The arena's slot header is the only bar. Scoped to body.od-embed.
   The menu panel hangs from the top-right; the arena's MENU button toggles it. */
body.od-embed .od-layout, body.od-embed .od-layout.no-agent { gap: 0; padding: 0; }
body.od-embed .od-stage { border: 0; }
.od-embed .od-embed-menu { position: fixed; top: 6px; right: 8px; z-index: 50; }
.od-embed .od-embed-menu #od-menu {
  top: 0; right: 0; left: auto; width: auto; min-width: 290px;
  max-height: calc(100vh - 12px); overflow: auto;
}
`;
