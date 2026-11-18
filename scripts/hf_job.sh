#!/usr/bin/env bash
# Measure both sites on a Hugging Face Jobs machine (Linux, no GPU). Billed by the minute.
#
#   SITE=smoke|editors|viewer|both|probe|retake  (retake: RETAKE_FROM=<date> V_ENGINES=… E_ENGINES=…)
#    RUNS=<n> (not for smoke and probe)  PROBE_URLS="<url> …" (probe only)  HF_TOKEN=<token with write access>
#
# Run as the job's command, in the python:3.12 image, as root, on the flavor the published figures
# name, and with a timeout: Hugging Face stops a job after 30 minutes unless told otherwise.
#   hf jobs run --flavor cpu-upgrade --timeout 6h --secrets HF_TOKEN -e SITE=both -e RUNS=3 python:3.12 \
#     bash -c 'curl -fsSL https://raw.githubusercontent.com/arthrod/open-docs/<commit>/scripts/hf_job.sh -o /tmp/job.sh && bash /tmp/job.sh'
# (download, then run: piped into bash, a download that fails still ends the job as a success).
# Timeouts that fit: smoke and probe 15m, viewer 3h, editors 4h, both 6h, retake 90m.
# Result files are uploaded after every measuring step to the private dataset
# arthrod/open-docs-measurements, under <date>/<site>/, so a step that runs out of time loses only
# itself. Every upload is a commit there, so a later job on the same day does not destroy an
# earlier one's files (retake builds on them on purpose). Probe mode only prints to the log.
# The job ends with a non-zero status when a step timed out or failed, or an upload did not arrive.
set -uo pipefail
case "${SITE:-}" in
  smoke|probe) ;;
  editors|viewer|both|retake) [[ "${RUNS:-}" =~ ^[1-9][0-9]*$ ]] || { echo "RUNS must be a positive number for SITE=$SITE"; exit 2; } ;;
  *) echo "unknown SITE=${SITE:-}"; exit 2 ;;
esac
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq git xvfb procps curl >/dev/null || { echo "apt failed"; exit 1; }
pip install -q uv || exit 1
D=$(date +%F)
export OD_CHROME_ARGS="--no-sandbox --disable-dev-shm-usage"
export OD_TIMEOUT_S=600
# What the job was given, as far as the container can see it (cgroup v2). A quota other than the
# 8 vCPU the description below names stops the job: the figures would be published under a wrong label.
CPUS=$(awk '$1 != "max" { printf "%g", $1 / $2 }' /sys/fs/cgroup/cpu.max 2>/dev/null)
echo "cpu quota: ${CPUS:-not readable}; memory limit: $(cat /sys/fs/cgroup/memory.max 2>/dev/null || echo not readable)"
[ -z "$CPUS" ] || [ "$CPUS" = 8 ] || [ -n "${ANY_FLAVOR:-}" ] || { echo "this is not cpu-upgrade (8 vCPU): start the job with --flavor cpu-upgrade"; exit 2; }
HW="a Hugging Face Jobs cpu-upgrade machine (8 vCPU, 32 GB, Linux x86-64, no GPU: Chrome draws in software; the load average and core count recorded with each run are the shared host's), Chrome under Xvfb with --no-sandbox --disable-dev-shm-usage"
# The curl timings start no Chrome: their description names the machine only.
HW_CURL="a Hugging Face Jobs cpu-upgrade machine (8 vCPU, 32 GB, Linux x86-64; the load average and core count recorded with each run are the shared host's)"
cat > /tmp/up.py <<'PY'
import sys
from huggingface_hub import HfApi
a = HfApi()
a.create_repo("arthrod/open-docs-measurements", repo_type="dataset", private=True, exist_ok=True)
if not a.repo_info("arthrod/open-docs-measurements", repo_type="dataset").private:
    sys.exit("the dataset is public: nothing is uploaded")  # exist_ok keeps an existing repo's visibility
a.upload_folder(folder_path=sys.argv[1], path_in_repo=sys.argv[2], repo_id="arthrod/open-docs-measurements", repo_type="dataset")
print("uploaded", sys.argv[1], "->", sys.argv[2], flush=True)
PY
: > /tmp/failed
up() {
  for try in 1 2 3; do uv run -q --with huggingface_hub python /tmp/up.py "$1" "$2" && return 0; sleep $((try * 10)); done
  echo "UPLOAD FAILED $1"; echo "upload $1" >> /tmp/failed; return 1
}
mkdir -p /tmp/probe && echo "started $(date -u +%FT%TZ) $SITE" > /tmp/probe/started.txt && uv run -q --with huggingface_hub python /tmp/up.py /tmp/probe "$D/$SITE/probe" || { echo "cannot upload: stopping before measuring"; exit 1; }
REF=${REF:-main}
get() { git clone -q --depth 1 -b "$REF" "https://github.com/arthrod/$1.git" "/w/$2" && echo "$2 $(git -C "/w/$2" rev-parse HEAD)" || exit 1; }
case "$SITE" in viewer) ;; *) get open-docs editors ;; esac
case "$SITE" in editors|probe) ;; *) get open-docs-viewer viewer ;; esac
uv run -q --with playwright python -m playwright install --with-deps chrome >/tmp/pw.log 2>&1 || { tail -20 /tmp/pw.log; exit 1; }
google-chrome --version; nproc; free -g | sed -n 2p; cat /proc/loadavg
Xvfb :99 -screen 0 1600x1200x24 >/dev/null 2>&1 &
export DISPLAY=:99
sleep 2
# A step that fails or runs out of time does not stop the job (the next one may still measure),
# but it is written down, and the job ends with a non-zero status.
step() { local t=$1; shift; echo "== $(date -u +%T) $*"; timeout "$t" "$@"; local rc=$?; echo "== rc=$rc $(cat /proc/loadavg)"; [ $rc = 0 ] || echo "rc=$rc $*" >> /tmp/failed; return 0; }
PW="uv run -q --with playwright python -I"
smoke() {
  mkdir -p /tmp/out
  cd /w/editors; export MEASURE_WHERE="$HW"
  step 6m $PW scripts/measure_samples.py docxodus,onlyoffice redline 1 --out /tmp/out/editors.json --latest /tmp/out/editors-latest.json --shots /tmp/out/shots 2>&1 | tail -4 | cut -c1-900
  up /tmp/out "$D/smoke"
  cd /w/viewer; export MEASURE_WHERE="from $HW"
  step 6m $PW scripts/measure.py docxodus,betteroffice 1 --doc redline --samples /tmp/out/viewer-samples.json --raw /tmp/out/viewer-raw.json 2>&1 | tail -6 | cut -c1-900
  ls -la /tmp/out; up /tmp/out "$D/smoke"
}
editors() {
  cd /w/editors; export MEASURE_WHERE="$HW"
  for S in showcase redline lorem-500; do
    T=55m; [ "$S" = lorem-500 ] && T=90m
    step $T $PW scripts/measure_samples.py all $S "$RUNS" --out "docs/samples/$D-$S.json" --latest docs/samples/latest.json --shots shots 2>/tmp/$S.log
    grep -c '"engine"' /tmp/$S.log; grep -o '"error": "[^"]*' /tmp/$S.log | sort | uniq -c | head -20
    cp /tmp/$S.log docs/samples/ 2>/dev/null; up docs/samples "$D/editors/samples"
  done
  up shots "$D/editors/shots"
}
viewer() {
  cd /w/viewer; export MEASURE_WHERE="from $HW"
  step 25m $PW scripts/measure.py all "$RUNS" --results results/browser.json --raw "results/raw/$D-browser-showcase.json" >/dev/null 2>/tmp/b1.log; tail -2 /tmp/b1.log | cut -c1-300; up results "$D/viewer/results"
  step 25m $PW scripts/measure.py all "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-browser-redline.json" >/dev/null 2>/tmp/b2.log; tail -2 /tmp/b2.log | cut -c1-300; up results "$D/viewer/results"
  step 35m $PW scripts/measure.py all "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-browser-lorem-500.json" >/dev/null 2>/tmp/b3.log; tail -2 /tmp/b3.log | cut -c1-300; up results "$D/viewer/results"
  export MEASURE_WHERE="from $HW_CURL"
  step 5m python3 -I scripts/measure_server.py all "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-server-redline.json" >/dev/null; up results "$D/viewer/results"
  step 8m python3 -I scripts/measure_server.py all "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-server-lorem-500.json" >/dev/null
  up results "$D/viewer/results"
  export MEASURE_WHERE="from $HW"
  step 40m $PW scripts/measure_server_client.py all showcase,redline,lorem-500 "$RUNS" --out results/server-client.json --raw "results/raw/$D-server-client.json" >/dev/null 2>/tmp/sc.log; tail -2 /tmp/sc.log | cut -c1-300
  mkdir -p results/logs; cp /tmp/*.log results/logs/; up results "$D/viewer/results"
}
# Some engines again, on top of the files an earlier job uploaded the same day (RETAKE_FROM: its
# date folder). Each script merges by engine, so the other engines' rows stay as they were.
retake() {
  cat > /tmp/down.py <<'PY'
import sys
from huggingface_hub import snapshot_download
snapshot_download("arthrod/open-docs-measurements", repo_type="dataset", allow_patterns=[sys.argv[1] + "/*"], local_dir="/tmp/prev")
PY
  uv run -q --with huggingface_hub python /tmp/down.py "$RETAKE_FROM" || { echo "cannot read the earlier files"; exit 1; }
  if [ -n "${V_ENGINES:-}" ]; then
    cd /w/viewer; export MEASURE_WHERE="from $HW"
    cp -R "/tmp/prev/$RETAKE_FROM/viewer/results/." results/
    step 12m $PW scripts/measure.py "$V_ENGINES" "$RUNS" --results results/browser.json --raw "results/raw/$D-browser-showcase-retake.json" >/dev/null 2>/tmp/r1.log; tail -3 /tmp/r1.log | cut -c1-400
    step 12m $PW scripts/measure.py "$V_ENGINES" "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-browser-redline-retake.json" >/dev/null 2>/tmp/r2.log; tail -3 /tmp/r2.log | cut -c1-400
    step 15m $PW scripts/measure.py "$V_ENGINES" "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-browser-lorem-500-retake.json" >/dev/null 2>/tmp/r3.log; tail -3 /tmp/r3.log | cut -c1-400
    mkdir -p results/logs; cp /tmp/r?.log results/logs/; up results "$D/viewer/results"
  fi
  if [ -n "${E_ENGINES:-}" ]; then
    cd /w/editors; export MEASURE_WHERE="$HW"
    cp -R "/tmp/prev/$RETAKE_FROM/editors/samples/." docs/samples/
    for S in showcase redline lorem-500; do
      step 15m $PW scripts/measure_samples.py "$E_ENGINES" $S "$RUNS" --out "docs/samples/$D-$S-retake.json" --latest docs/samples/latest.json --shots shots 2>/tmp/$S-retake.log
      grep -o '"error": "[^"]*' /tmp/$S-retake.log | cut -c1-200 | sort | uniq -c | head; cp /tmp/$S-retake.log docs/samples/
    done
    up docs/samples "$D/editors/samples"; up shots "$D/editors/shots"
  fi
}
# "both": one site after the other, never at once. Two Chromes, or two jobs asking the same
# val, would time each other.
case "$SITE" in
  smoke) smoke ;;
  editors) editors ;;
  viewer) viewer ;;
  both) viewer; editors ;;
  retake) retake ;;
  # The first 150 events, then the two summary lines whole: a noisy page must not push them out.
  probe) cd /w/editors; for u in $PROBE_URLS; do echo "### $u"; step 4m $PW scripts/probe_page.py "$u" 100 >/tmp/probe.log 2>&1; grep -v '^state \|^responses by status ' /tmp/probe.log | cut -c1-600 | head -150; grep '^state \|^responses by status ' /tmp/probe.log; done ;;
esac
echo "done $(date -u +%T)"
if [ -s /tmp/failed ]; then echo "FAILED:"; cat /tmp/failed; exit 1; fi
