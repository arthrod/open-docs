/** The shared chrome's stylesheet. Kept in its own module so router.ts stays readable. */
export const SHELL_CSS = `
:root {
  color-scheme: light;
  --bg: #eef1f5; --surface: #fff; --surface-2: #f7f8fa; --line: #e3e6ec; --line-2: #d4d8e0;
  --text: #161b26; --muted: #5d6676; --subtle: #8b93a3;
  --accent: #2557d6; --accent-ink: #fff; --accent-soft: #e8eefc;
  --ok: #0f7a4f; --warn: #a15c07; --err: #b42318;
  --radius: 10px; --shadow: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08);
  --font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { height: 100dvh; }
body { margin: 0; font: 13px/1.45 var(--font); color: var(--text); background: var(--bg);
  display: flex; flex-direction: column; overflow: hidden; -webkit-font-smoothing: antialiased; }
svg.ic { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex: none; }
svg.ic circle { fill: currentColor; stroke: none; }

/* ------------------------------ top bar ------------------------------ */
.od-bar { position: relative; z-index: 30; display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 12px; min-width: 0;
  background: var(--surface); border-bottom: 1px solid var(--line); }
.od-brand { display: flex; align-items: center; gap: 8px; font-weight: 650; letter-spacing: -.01em; color: var(--text); text-decoration: none; font-size: 14px; }
.od-logo { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #1e3a8a, #2557d6);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); position: relative; }
.od-logo::after { content: ""; position: absolute; inset: 5px 6px; border-radius: 1.5px; background:
  linear-gradient(#fff 0 0) 0 0/100% 1.5px no-repeat, linear-gradient(#fff 0 0) 0 4px/70% 1.5px no-repeat,
  linear-gradient(#fff 0 0) 0 8px/90% 1.5px no-repeat; }
.od-sep { width: 1px; height: 24px; background: var(--line); margin: 0 4px; }
.od-spacer { flex: 1; }
.od-switch select { font: inherit; font-weight: 600; font-size: 13px; padding: 6px 28px 6px 10px; border: 1px solid transparent;
  border-radius: 8px; background: var(--surface-2) url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M6 8l4 4 4-4' fill='none' stroke='%235d6676' stroke-width='1.6'/></svg>") right 8px center/14px no-repeat;
  appearance: none; cursor: pointer; color: var(--text); }
.od-switch select:hover { border-color: var(--line-2); }
.od-docname { font: inherit; font-size: 13.5px; color: var(--text); border: 1px solid transparent; background: transparent;
  border-radius: 7px; padding: 5px 8px; flex: 0 1 260px; width: 260px; min-width: 70px; text-overflow: ellipsis; }
.od-switch { flex: none; min-width: 0; }
.od-docname:hover { border-color: var(--line); }
.od-docname:focus { outline: none; border-color: var(--accent); background: #fff; }
.od-actions { display: flex; align-items: center; gap: 6px; }
.od-btn { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12.5px; font-weight: 550;
  height: 32px; padding: 0 11px; border-radius: 8px; border: 1px solid var(--line-2); background: #fff; color: var(--text);
  cursor: pointer; white-space: nowrap; text-decoration: none; transition: background .12s, border-color .12s, box-shadow .12s; }
.od-btn:hover { background: var(--surface-2); border-color: #c5cad4; }
.od-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.od-btn[disabled] { opacity: .5; cursor: progress; }
.od-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); box-shadow: 0 1px 2px rgba(37,87,214,.3); }
.od-btn.primary:hover { background: #1d47b5; border-color: #1d47b5; }
.od-btn.icon { width: 32px; padding: 0; justify-content: center; }
.od-btn.icon[aria-pressed="true"] { background: var(--accent-soft); border-color: #c7d5f7; color: var(--accent); }
.od-menu-wrap { position: relative; }
.od-menu { position: absolute; right: 0; top: 38px; min-width: 290px; max-height: calc(100dvh - 64px); overflow: auto; background: #fff; border: 1px solid var(--line);
  border-radius: 10px; box-shadow: 0 12px 32px rgba(16,24,40,.16); padding: 5px; display: flex; flex-direction: column; z-index: 50; }
.od-menu[hidden] { display: none; }
.od-menu > button, .od-menu > a { font: inherit; text-align: left; padding: 8px 10px; border: 0; background: none; border-radius: 6px;
  color: var(--text); text-decoration: none; cursor: pointer; display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.od-menu > button svg.ic, .od-menu > a svg.ic { color: var(--muted); }
.od-menu kbd { margin-left: auto; font: 11px var(--mono); color: var(--subtle); }
.od-menu small { flex-basis: 100%; padding-left: 25px; margin-top: -3px; font-size: 11px; color: var(--subtle); }
.od-menu-label { padding: 6px 10px 2px; font-size: 10.5px; font-weight: 650; text-transform: uppercase; letter-spacing: .06em; color: var(--subtle); }
.od-menu-btn[aria-expanded="true"] { background: var(--accent-soft); border-color: #c7d5f7; color: var(--accent); }
.od-menu > button:hover, .od-menu > a:hover { background: var(--surface-2); }
.od-menu hr { border: 0; border-top: 1px solid var(--line); margin: 4px 2px; }

.od-metrics { display: flex; align-items: stretch; gap: 0; font: inherit; height: 36px; border: 1px solid var(--line);
  border-radius: 9px; background: var(--surface-2); padding: 0; cursor: pointer; color: var(--text); overflow: hidden; }
.od-metrics:hover { border-color: var(--line-2); background: #fff; }
.od-metrics .m { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 10px; line-height: 1.1; }
.od-metrics .m + .m { border-left: 1px solid var(--line); }
.od-metrics b { font-weight: 650; font-size: 12.5px; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 5px; }
.od-metrics .m:first-child { flex-direction: column; position: relative; padding-left: 20px; }
.od-metrics .dot { position: absolute; left: 9px; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; background: var(--subtle); }
.od-metrics.ok .dot { background: #12b76a; } .od-metrics.err .dot { background: var(--err); }
.od-metrics.loading .dot { background: #f79009; animation: od-pulse 1s infinite; }
.od-metrics small { font-size: 10px; color: var(--subtle); text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
@keyframes od-pulse { 50% { opacity: .3; } }

.od-sub { display: flex; align-items: center; gap: 10px; padding: 6px 14px; background: var(--surface); border-bottom: 1px solid var(--line);
  font-size: 12px; color: var(--muted); min-height: 30px; }
.od-sub code { font: 11.5px var(--mono); color: #334155; background: var(--surface-2); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; }
.od-lic { font-size: 11px; font-weight: 600; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; }
.od-viewonly { font-size: 11px; font-weight: 650; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 999px; padding: 0 8px; white-space: nowrap; }
.od-menu-note { font-size: 11.5px; color: var(--muted); padding: 4px 10px 8px; max-width: 290px; line-height: 1.4; }
.od-blurb { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.od-status { font-size: 12px; color: var(--muted); max-width: 52ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.od-status.err { color: var(--err); } .od-status.ok { color: var(--ok); }

/* ------------------------------ layout ------------------------------ */
.od-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; padding: 12px; }
.od-layout.no-agent { grid-template-columns: minmax(0, 1fr); }
.od-layout.no-agent .od-aside { display: none; }
.od-aside-close { display: none; }
@media (max-width: 1100px) { .od-blurb { display: none; } }
/* Narrow screens: one column, and the assistant becomes a sheet over the editor. */
@media (max-width: 900px) {
  .od-layout, .od-layout.no-agent { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 6px; }
  .od-aside { position: fixed; z-index: 60; left: 6px; right: 6px; bottom: 6px; height: min(78dvh, 600px);
    box-shadow: 0 -8px 40px rgba(16,24,40,.28); border-color: var(--line-2); }
  .od-layout.no-agent .od-aside { display: none; }
  .od-aside-close { display: inline-flex; height: 28px; width: 28px; }
  .od-pkg { display: none; }
}
@media (max-width: 760px) { .od-metrics { display: none; } .od-sep { display: none; } }
@media (max-width: 640px) {
  .od-bar { gap: 6px; padding: 0 8px; }
  .od-brand span:not(.od-logo) { display: none; }
  .od-menu-btn span { display: none; } .od-menu-btn { width: 32px; padding: 0; justify-content: center; }
  .od-switch select { max-width: 130px; padding-right: 24px; text-overflow: ellipsis; }
  .od-docname { flex: 1 1 auto; width: auto; }
  .od-menu { position: fixed; left: 8px; right: 8px; top: 52px; min-width: 0; }
  .od-sub { padding: 4px 10px; min-height: 0; }
  .od-sub .od-lic { display: none; }
}
/* Paged editors virtualise against their scroll container, so the stage needs a
   DEFINITE height — min-height alone lets it grow forever and nothing scrolls. */
.od-stage { position: relative; height: 100%; min-height: 0; background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.od-stage > *:not(.od-loading):not(.od-error) { flex: 1 1 auto; min-height: 0; }
.od-loading { position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; gap: 14px;
  background: rgba(247,248,250,.92); backdrop-filter: blur(2px); font-size: 13px; color: var(--muted); }
.od-loading[hidden] { display: none; }
.od-loading strong { display: block; color: var(--text); font-size: 14px; margin-bottom: 2px; }
.od-loading .spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #d7deea; border-top-color: var(--accent); animation: od-spin .8s linear infinite; }
@keyframes od-spin { to { transform: rotate(360deg); } }
.od-error { position: absolute; inset: 0; z-index: 25; overflow: auto; padding: 28px; background: #fff; }
.od-error h3 { margin: 0 0 6px; font-size: 15px; color: var(--err); }
.od-error p { margin: 0 0 12px; color: var(--muted); }
.od-error pre { font: 12px/1.6 var(--mono); color: #7a271a; background: #fef3f2; border: 1px solid #fecdca; border-radius: 8px; padding: 14px; white-space: pre-wrap; word-break: break-word; }

/* ------------------------------ assistant ------------------------------ */
.od-aside { min-height: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow);
  display: flex; flex-direction: column; overflow: hidden; }
.od-aside-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.od-aside h2 { font-size: 13.5px; margin: 0; font-weight: 650; }
.od-model { font-size: 11px; color: var(--subtle); font-family: var(--mono); }
.od-auto { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); cursor: pointer; user-select: none; }
.od-auto input { accent-color: var(--accent); margin: 0; }
.od-log { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 10px; padding: 14px; min-height: 80px; }
.od-msg { border-radius: 10px; padding: 8px 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; font-size: 13px; max-width: 94%; }
.od-msg.user { background: var(--accent); color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }
.od-msg.bot { background: var(--surface-2); border: 1px solid var(--line); align-self: flex-start; border-bottom-left-radius: 3px; }
.od-msg.err { background: #fef3f2; border-color: #fecdca; color: #7a271a; }
.od-msg .who { display: block; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; opacity: .6; margin-bottom: 2px; }
.od-msg.thinking .who::after { content: " · thinking"; }
.od-msg.thinking span.dots::after { content: "…"; animation: od-pulse 1s infinite; }
.od-edit { border: 1px solid #c7d5f7; background: #f5f8ff; border-radius: 10px; padding: 10px 11px; font-size: 12.5px; display: flex; flex-direction: column; gap: 7px; align-self: stretch; }
.od-edit strong { font-size: 13px; }
.od-edit .diff { color: var(--muted); font-size: 12px; }
.od-edit .diff b { color: var(--ok); font-weight: 600; } .od-edit .diff i { color: var(--err); font-style: normal; font-weight: 600; }
.od-edit details summary { cursor: pointer; color: var(--accent); font-size: 12px; }
.od-edit pre { white-space: pre-wrap; font: 11.5px/1.5 var(--mono); max-height: 200px; overflow: auto; margin: 6px 0 0; background: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 8px; }
.od-edit .row { display: flex; gap: 6px; align-items: center; }
.od-edit .state { font-size: 11.5px; color: var(--ok); font-weight: 600; margin-left: auto; }
.od-edit.applied { background: #f0fbf6; border-color: #b5e7cf; }
.od-edit.undone { background: var(--surface-2); border-color: var(--line); opacity: .8; }
.od-edit .od-btn { height: 28px; font-size: 12px; }
.od-suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 10px; }
.od-suggestions button { font: inherit; font-size: 11.5px; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--line-2); background: #fff; cursor: pointer; color: var(--muted); }
.od-suggestions button:hover { border-color: var(--accent); color: var(--accent); }
.od-input { display: flex; gap: 6px; align-items: flex-end; padding: 10px 12px 12px; border-top: 1px solid var(--line); }
.od-input textarea { flex: 1; resize: none; min-height: 40px; max-height: 140px; font: inherit; font-size: 13px; padding: 9px 10px; border: 1px solid var(--line-2); border-radius: 9px; }
.od-input textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.od-input .od-btn { height: 40px; width: 40px; padding: 0; justify-content: center; }

/* ------------------------------ metrics dialog ------------------------------ */
.od-dialog { border: 0; border-radius: 14px; padding: 0; width: min(620px, 94vw); box-shadow: 0 24px 64px rgba(16,24,40,.28); color: var(--text); }
.od-dialog::backdrop { background: rgba(15,23,42,.35); }
.od-dialog header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.od-dialog h3 { margin: 0; font-size: 15px; }
.od-dialog footer { padding: 12px 18px; border-top: 1px solid var(--line); text-align: right; }
.od-dialog footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
#od-metrics-body { padding: 16px 18px; max-height: 64vh; overflow: auto; }
.od-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.od-kpi { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: var(--surface-2); }
.od-kpi b { display: block; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.od-kpi small { color: var(--muted); font-size: 11.5px; }
.od-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.od-table th, .od-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
.od-table th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--subtle); font-weight: 600; }
.od-table td.n { text-align: right; font-variant-numeric: tabular-nums; font-family: var(--mono); font-size: 12px; }
.od-note { font-size: 11.5px; color: var(--subtle); margin: 10px 0 0; line-height: 1.5; }
`;
