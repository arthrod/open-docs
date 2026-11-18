# Running measurements on Linux

The editor and viewer benchmarks can run on a Hugging Face Jobs Linux container
using [`scripts/hf_job.sh`](../scripts/hf_job.sh). Existing published tables retain
the environment and date of their original measurements; a job uploads artifacts
and does not publish new tables in this repository.

## Launch a job

Use an authenticated Hugging Face CLI with Jobs access, and export `HF_TOKEN`
with write access to the private `arthrod/open-docs-measurements` dataset.
The script creates that dataset if needed and refuses uploads if it is public.
Run the `python:3.12` image as root on `cpu-upgrade`:

```sh
hf jobs run --flavor cpu-upgrade --timeout 6h --secrets HF_TOKEN \
  -e SITE=both -e RUNS=3 python:3.12 \
  bash -c 'curl -fsSL https://raw.githubusercontent.com/arthrod/open-docs/<commit>/scripts/hf_job.sh -o /tmp/job.sh && bash /tmp/job.sh'
```

Replace `<commit>` with the desired script revision. Download before running so
a failed download fails the job. The benchmark checkouts independently default
to `main`; pass `-e REF=<branch-or-tag>` to select a branch or tag present in
each repository the mode clones. The job logs the checkout commit IDs.
Always set an explicit job timeout, using these budgets from the script:

| `SITE` | Work | Job timeout |
| --- | --- | --- |
| `smoke` | One redline run of Docxodus and OnlyOffice in editors, then Docxodus and BetterOffice in viewer | `15m` |
| `editors` | All editor engines on showcase, redline, and lorem-500 | `4h` |
| `viewer` | Viewer browser, server, and server-client measurements | `3h` |
| `both` | Viewer, then editors, sequentially | `6h` |
| `probe` | Diagnose each URL in `PROBE_URLS`; output goes to the job log | `15m` |
| `retake` | Remeasure selected engines using earlier uploaded results | `90m` |

`RUNS` must be a positive integer for editors, viewer, both, and retake.
Smoke uses one run; probe does not use `RUNS`. Avoid simultaneous measurements
against the same site: competing browsers or jobs affect timings.

The script installs Chrome and dependencies, starts Xvfb, sets
`OD_TIMEOUT_S=600`, and launches headed Chrome with
`--no-sandbox --disable-dev-shm-usage`. Its environment description names
8 vCPU, 32 GB, Linux x86-64 and software drawing without a GPU. A readable
cgroup CPU quota other than 8 stops the job; an unreadable quota does not.
`ANY_FLAVOR` bypasses that check but does not change the hardware description,
so do not use it to produce figures under an incorrect label. Recorded load
averages and core counts describe the shared host.

## Results and failures

A start-marker upload must succeed before measurements begin. Editor results
are uploaded under `<date>/editors/samples` and screenshots under
`<date>/editors/shots`; viewer artifacts go under `<date>/viewer/results`.
Smoke uses `<date>/smoke`. Dates come from the job container.
Completed measurement steps checkpoint results; editor screenshots upload at
the end of editor mode, and retakes upload after each selected site's group.
Probe uploads a start marker but keeps diagnostics in the job log.

Later uploads retry three times. A failed upload, failed step, or timed-out
step is recorded; later steps can continue, and the final job status is nonzero.
Individual engine runs can fail while their measurement script exits zero:
inspect the result files as well as the job status. A hard job deadline can
prevent the current step from checkpointing.

Each upload is a dataset Git commit. Same-day jobs share paths, so the current
folder can mix runs; earlier versions remain in dataset history.

For a retake, add `-e SITE=retake -e RUNS=3 -e RETAKE_FROM=YYYY-MM-DD`
and at least one of `-e V_ENGINES=docxodus,betteroffice` or
`-e E_ENGINES=docxodus,onlyoffice` to the launch command, with `--timeout 90m`.
Use a date containing the selected site's earlier results. Retakes download
that date's files, merge selected engines while preserving other engines, and
upload under the current date. Viewer retakes cover browser measurements;
editor retakes cover all three samples.

## Local Chrome flags and diagnostics

`measure_samples.py`, `measure_pagespeed.py`, and `probe_page.py` accept
`OD_CHROME_ARGS`. It defaults to no extra flags, preserving existing macOS
launches. Values use shell quoting, for example
`OD_CHROME_ARGS='--user-agent="Benchmark Browser"'`. Sample result environment
lines include flags not already named in `MEASURE_WHERE`.
On Linux, run headed Chrome with a display (or Xvfb); root containers need the
container flags used by the job script.

With uv, Playwright, and installed Chrome available:

```sh
uv run --with playwright python -m playwright install --with-deps chrome
OD_CHROME_ARGS="--no-sandbox --disable-dev-shm-usage" xvfb-run -a \
  uv run --with playwright python -I scripts/probe_page.py \
  https://editors.benchmarks.law/e/opendoc 90
```

The optional wait defaults to 90 seconds, ending early on page readiness or
`.od-error`. The probe prints console warnings/errors, page errors, failed
requests, HTTP errors, response-status counts, and final page/iframe state.
Iframe `webgl` is null when inaccessible and otherwise reports WebGL2 support.
For a cloud probe, use `SITE=probe` and space-separated URLs in `PROBE_URLS`.
The job waits up to 100 seconds per URL inside a four-minute step timeout,
prints at most 150 event lines, and preserves the final summary lines whole.

Sample memory measurement follows the browser's complete descendant process
tree, including Linux zygote children. Renderer and GPU RSS are separate;
renderer RSS includes WASM, canvas, DOM, and spare renderer memory, rather than
only JavaScript heap.

Validate the measurement helpers without launching Chrome:

```sh
uv run --with pytest pytest scripts/tests
```
