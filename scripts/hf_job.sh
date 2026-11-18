#!/usr/bin/env bash
# Measure both sites on a Hugging Face Jobs machine (Linux, no GPU). Billed by the minute.
#
#   SITE=smoke|editors|viewer  RUNS=<n>  HF_TOKEN=<token with write access>
#
# Run as the job's command, in the python:3.12 image, as root:
#   curl -fsSL https://raw.githubusercontent.com/arthrod/open-docs/<ref>/scripts/hf_job.sh | bash
# Result files are uploaded after every step to the private dataset arthrod/open-docs-measurements,
# under <date>/<site>/, so a step that runs out of time loses only itself.
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq git xvfb procps curl >/dev/null || { echo "apt failed"; exit 1; }
pip install -q uv || exit 1
D=$(date +%F)
export OD_CHROME_ARGS="--no-sandbox --disable-dev-shm-usage"
export OD_TIMEOUT_S=600
HW="a Hugging Face Jobs cpu-upgrade machine (8 vCPU, 32 GB, Linux x86-64, no GPU: Chrome draws in software), Chrome under Xvfb with --no-sandbox --disable-dev-shm-usage"
cat > /tmp/up.py <<'PY'
import sys
from huggingface_hub import HfApi
a = HfApi()
a.create_repo("arthrod/open-docs-measurements", repo_type="dataset", private=True, exist_ok=True)
a.upload_folder(folder_path=sys.argv[1], path_in_repo=sys.argv[2], repo_id="arthrod/open-docs-measurements", repo_type="dataset")
print("uploaded", sys.argv[1], "->", sys.argv[2], flush=True)
PY
up() { uv run -q --with huggingface_hub python /tmp/up.py "$1" "$2" || echo "UPLOAD FAILED $1"; }
mkdir -p /tmp/probe && echo "started $(date -u +%FT%TZ) $SITE" > /tmp/probe/started.txt && uv run -q --with huggingface_hub python /tmp/up.py /tmp/probe "$D/$SITE/probe" || { echo "cannot upload: stopping before measuring"; exit 1; }
git clone -q --depth 1 -b measure-linux https://github.com/arthrod/open-docs.git /w/editors || exit 1
git clone -q --depth 1 -b measure-linux https://github.com/arthrod/open-docs-viewer.git /w/viewer || exit 1
cd /w/editors && echo "editors $(git rev-parse HEAD)"; cd /w/viewer && echo "viewer $(git rev-parse HEAD)"
uv run -q --with playwright python -m playwright install --with-deps chrome >/tmp/pw.log 2>&1 || { tail -20 /tmp/pw.log; exit 1; }
google-chrome --version; nproc; free -g | sed -n 2p; cat /proc/loadavg
Xvfb :99 -screen 0 1600x1200x24 >/dev/null 2>&1 &
export DISPLAY=:99
sleep 2
step() { local t=$1; shift; echo "== $(date -u +%T) $*"; timeout "$t" "$@"; local rc=$?; echo "== rc=$rc $(cat /proc/loadavg)"; return 0; }
PW="uv run -q --with playwright python -I"
if [ "$SITE" = smoke ]; then
  mkdir -p /tmp/out
  cd /w/editors; export MEASURE_WHERE="$HW"
  step 6m $PW scripts/measure_samples.py docxodus,onlyoffice redline 1 --out /tmp/out/editors.json --latest /tmp/out/editors-latest.json --shots /tmp/out/shots 2>&1 | tail -4 | cut -c1-900
  cd /w/viewer; export MEASURE_WHERE="from $HW"
  step 6m $PW scripts/measure.py docxodus,betteroffice 1 --doc redline --samples /tmp/out/viewer-samples.json --raw /tmp/out/viewer-raw.json 2>&1 | tail -6 | cut -c1-900
  ls -la /tmp/out; up /tmp/out "$D/smoke"
elif [ "$SITE" = editors ]; then
  cd /w/editors; export MEASURE_WHERE="$HW"
  for S in showcase redline lorem-500; do
    T=55m; [ "$S" = lorem-500 ] && T=90m
    step $T $PW scripts/measure_samples.py all $S "$RUNS" --out "docs/samples/$D-$S.json" --latest docs/samples/latest.json --shots shots 2>/tmp/$S.log
    grep -c '"engine"' /tmp/$S.log; grep -o '"error": "[^"]*' /tmp/$S.log | sort | uniq -c | head -20
    cp /tmp/$S.log docs/samples/ 2>/dev/null; up docs/samples "$D/editors/samples"
  done
  up shots "$D/editors/shots"
elif [ "$SITE" = viewer ]; then
  cd /w/viewer; export MEASURE_WHERE="from $HW"
  step 25m $PW scripts/measure.py all "$RUNS" --results results/browser.json --raw "results/raw/$D-browser-showcase.json" >/dev/null 2>/tmp/b1.log; tail -2 /tmp/b1.log | cut -c1-300; up results "$D/viewer/results"
  step 25m $PW scripts/measure.py all "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-browser-redline.json" >/dev/null 2>/tmp/b2.log; tail -2 /tmp/b2.log | cut -c1-300; up results "$D/viewer/results"
  step 35m $PW scripts/measure.py all "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-browser-lorem-500.json" >/dev/null 2>/tmp/b3.log; tail -2 /tmp/b3.log | cut -c1-300; up results "$D/viewer/results"
  step 5m python3 -I scripts/measure_server.py all "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-server-redline.json" >/dev/null
  step 8m python3 -I scripts/measure_server.py all "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-server-lorem-500.json" >/dev/null
  up results "$D/viewer/results"
  step 40m $PW scripts/measure_server_client.py all showcase,redline,lorem-500 "$RUNS" --out results/server-client.json --raw "results/raw/$D-server-client.json" >/dev/null 2>/tmp/sc.log; tail -2 /tmp/sc.log | cut -c1-300
  mkdir -p results/logs; cp /tmp/*.log results/logs/; up results "$D/viewer/results"
fi
echo "done $(date -u +%T)"
