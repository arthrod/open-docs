#!/usr/bin/env bash
# Measure both sites on a Hugging Face Jobs machine (Linux, no GPU). Billed by the minute.
#
#   SITE=smoke|editors|viewer|both|probe|retake  (retake: RETAKE_FROM=<date> V_ENGINES=… E_ENGINES=…)
#    RUNS=<n> (not for smoke and probe)  PROBE_URLS="<url> …" (probe only)  HF_TOKEN=<token with write access>
#
# Run as the job's command, in the python:3.12 image, as root, on the flavor the published figures
# name, and with a timeout: Hugging Face stops a job after 30 minutes unless told otherwise.
#   hf jobs run --flavor cpu-upgrade --timeout 48h --secrets HF_TOKEN -e SITE=both -e RUNS=3 -e TAG=pass1 python:3.12 \
#     bash -c 'curl -fsSL https://raw.githubusercontent.com/arthrod/open-docs/<commit>/scripts/hf_job.sh -o /tmp/job.sh && bash /tmp/job.sh'
# (download, then run: piped into bash, a download that fails still ends the job as a success).
#
# The machine is a slice of a shared host, and the host is often busy with other people's work.
# Nothing is timed on a busy host: every run of every script waits until the host's 1-minute load
# average is under MAX_LOAD (48 unless given; scripts/measure_lib.py quiet_host), for as long as
# long as WAIT_MIN minutes (45 unless given; smoke and probe 3). When that runs out the job ends
# with status 3, so that the next one can land on another host. Timeouts that fit: smoke and
# probe 30m, anything else 12h.
#
# A pass can be made by several jobs. With TAG given, result files go to the private dataset
# arthrod/open-docs-measurements under <date>-<TAG>/<site>/ after every step that finished, with
# the list of finished steps beside them; a later job with the same TAG (and DAY=<that date>, when
# the date has changed) takes the files up and runs only the steps that are left. A step that did
# not finish uploads nothing and is run again from its start. Probe mode only prints to the log.
# The job ends with a non-zero status when a step did not finish or an upload did not arrive, and
# prints PASS COMPLETE when every step has.
set -uo pipefail
case "${SITE:-}" in
  smoke|probe) ;;
  editors|viewer|both|retake) [[ "${RUNS:-}" =~ ^[1-9][0-9]*$ ]] || { echo "RUNS must be a positive number for SITE=$SITE"; exit 2; } ;;
  *) echo "unknown SITE=${SITE:-}"; exit 2 ;;
esac
# Step headers go to the job log even where a step's own output is sent to a file.
exec 3>&1
# The load a run may start under, and how long a step may wait for it in all (minutes), on top
# of the time its runs take. Read by the measuring scripts (measure_lib.quiet_host).
export OD_MAX_LOAD=${MAX_LOAD:-48}
case "$SITE" in smoke|probe) WAIT_MIN=${WAIT_MIN:-3} ;; *) WAIT_MIN=${WAIT_MIN:-45} ;; esac
export OD_LOAD_WAIT_S=$((WAIT_MIN * 60))
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq git xvfb procps curl >/dev/null || { echo "apt failed"; exit 1; }
pip install -q uv || exit 1
D=${DAY:-$(date +%F)}
# Where the files go in the dataset: the date, and TAG when given, so that one try's files are
# never mistaken for another's (a skipped step uploads nothing, and an older file would stand in).
P="$D${TAG:+-$TAG}"
export OD_CHROME_ARGS="--no-sandbox --disable-dev-shm-usage"
# 600 s was too little for docen on the 500 pages: it loads, then holds the main thread for
# minutes, and nothing can be read from the page until it lets go (2026-11-21).
export OD_TIMEOUT_S=1800
# What the job was given, as far as the container can see it (cgroup v2). FLAVOR names the machine
# type the job was started with; a quota other than that type's vCPU stops the job: the figures
# would be published under a wrong label.
FLAVOR=${FLAVOR:-cpu-upgrade}
case "$FLAVOR" in
  cpu-upgrade) VCPU=8; RAM=32 ;;
  cpu-xl) VCPU=16; RAM=124 ;;
  *) echo "FLAVOR $FLAVOR is not one this script can describe (cpu-upgrade, cpu-xl)"; exit 2 ;;
esac
CPUS=$(awk '$1 != "max" { printf "%g", $1 / $2 }' /sys/fs/cgroup/cpu.max 2>/dev/null)
echo "cpu quota: ${CPUS:-not readable}; memory limit: $(cat /sys/fs/cgroup/memory.max 2>/dev/null || echo not readable)"
[[ -z "$CPUS" || "$CPUS" == "$VCPU" ]] || { echo "this is not $FLAVOR ($VCPU vCPU): start the job with --flavor $FLAVOR and -e FLAVOR=$FLAVOR"; exit 2; }
HW="a Hugging Face Jobs $FLAVOR machine ($VCPU vCPU, $RAM GB, Linux x86-64, no GPU: Chrome draws in software; the load average and core count recorded with each run are the shared host's), Chrome under Xvfb with --no-sandbox --disable-dev-shm-usage"
# The curl timings start no Chrome: their description names the machine only.
HW_CURL="a Hugging Face Jobs $FLAVOR machine ($VCPU vCPU, $RAM GB, Linux x86-64; the load average and core count recorded with each run are the shared host's)"
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
mkdir -p /tmp/probe && echo "started $(date -u +%FT%TZ) $SITE" > /tmp/probe/started.txt && uv run -q --with huggingface_hub python /tmp/up.py /tmp/probe "$P/$SITE/probe" || { echo "cannot upload: stopping before measuring"; exit 1; }
REF=${REF:-main}
get() { git clone -q --depth 1 -b "$REF" "https://github.com/arthrod/$1.git" "/w/$2" && echo "$2 $(git -C "/w/$2" rev-parse HEAD)" || exit 1; }
case "$SITE" in viewer) ;; *) get open-docs editors ;; esac
# The clone's dated sample files are earlier passes: left in the folder, they were uploaded as this one's.
case "$SITE" in editors|both) rm -f /w/editors/docs/samples/20[0-9][0-9]-*.json ;; esac
case "$SITE" in editors|probe) ;; *) get open-docs-viewer viewer ;; esac
uv run -q --with playwright python -m playwright install --with-deps chrome >/tmp/pw.log 2>&1 || { tail -20 /tmp/pw.log; exit 1; }
google-chrome --version; nproc; free -g | sed -n 2p; cat /proc/loadavg
Xvfb :99 -screen 0 1600x1200x24 >/dev/null 2>&1 &
export DISPLAY=:99
sleep 2
# step <name> <minutes> <command…>. A step that fails, is stopped by a host that stayed busy, or
# runs out of time does not stop the job (the next one may still measure), but it is written
# down, and the job ends with a non-zero status. One that finished is named in $STATE, which is
# uploaded with its files: a later job of the same pass does not run it again ("-": never kept).
# On 2026-11-20 the host's load was 100 to 300 on 64 cores for hours (5 to 15 on the earlier
# passes), a page took twice to five times as long, and one step began at 38 and ended at 98.
# At about 44 a page took 20 to 40 % longer than at 5 to 15, which is accepted: every row carries
# the load it was taken at.
# /tmp/ran: the last step finished. /tmp/ran-any: some step of this job did. Files, not
# variables: a step whose output is piped runs in a subshell.
STATE=/dev/null
ran() { [[ -e /tmp/ran ]]; }
step() {
  local name=$1 t=$2; shift 2; rm -f /tmp/ran
  if [[ $name != - ]] && grep -qxF "$name" "$STATE" 2>/dev/null; then echo "== $(date -u +%T) finished in an earlier job: $name" >&3; return 0; fi
  echo "== $(date -u +%T) load $(cut -d' ' -f1 /proc/loadavg): $*" >&3
  timeout "$(((t + WAIT_MIN) * 60))" "$@"; local rc=$?
  echo "== rc=$rc $(cat /proc/loadavg)" >&3
  if [[ $rc = 0 ]]; then touch /tmp/ran /tmp/ran-any; [[ $name = - ]] || echo "$name" >> "$STATE"; else echo "rc=$rc $name: $*" >> /tmp/failed; fi
  # Status 4: a run waited WAIT_MIN minutes and the host never went quiet. The job ends here
  # (status 3) instead of waiting as long before every step that is left: the next job lands on
  # another host, or at another time, and takes up from the steps that finished.
  if [[ $rc = 4 && $name != - ]]; then echo "BUSY HOST: $(cat /proc/loadavg) on $(nproc) cores for $WAIT_MIN minutes; ending this job" >&3; exit 3; fi
  return 0
}
echo "starting under load $(cat /proc/loadavg); a run starts under $OD_MAX_LOAD, a step may wait $WAIT_MIN minutes in all"
# The files of an earlier job of this pass, when there is one.
if [[ -n "${TAG:-}" && "$SITE" =~ ^(editors|viewer|both)$ ]]; then
  cat > /tmp/down.py <<'PY'
import sys
from huggingface_hub import snapshot_download
snapshot_download("arthrod/open-docs-measurements", repo_type="dataset", allow_patterns=[sys.argv[1] + "/*"], local_dir="/tmp/prev")
PY
  uv run -q --with huggingface_hub python /tmp/down.py "$P" || { echo "cannot read the dataset"; exit 1; }
  [[ -d "/tmp/prev/$P/viewer/results" && -d /w/viewer ]] && cp -R "/tmp/prev/$P/viewer/results/." /w/viewer/results/ && echo "taken up: viewer, steps $(tr '\n' ' ' < /w/viewer/results/steps-done.txt 2>/dev/null)"
  [[ -d "/tmp/prev/$P/editors/samples" && -d /w/editors ]] && cp -R "/tmp/prev/$P/editors/samples/." /w/editors/docs/samples/ && echo "taken up: editors, steps $(tr '\n' ' ' < /w/editors/docs/samples/steps-done.txt 2>/dev/null)"
fi
PW="uv run -q --with playwright python -I"
smoke() {
  mkdir -p /tmp/out
  cd /w/editors; export MEASURE_WHERE="$HW"
  step - 6 $PW scripts/measure_samples.py docxodus,onlyoffice redline 1 --out /tmp/out/editors.json --latest /tmp/out/editors-latest.json --shots /tmp/out/shots 2>&1 | tail -4 | cut -c1-900
  ran && up /tmp/out "$P/smoke"
  cd /w/viewer; export MEASURE_WHERE="from $HW"
  step - 6 $PW scripts/measure.py docxodus,betteroffice 1 --doc redline --samples /tmp/out/viewer-samples.json --raw /tmp/out/viewer-raw.json 2>&1 | tail -6 | cut -c1-900
  ls -la /tmp/out; ran && up /tmp/out "$P/smoke"
}
editors() {
  cd /w/editors; export MEASURE_WHERE="$HW"; STATE=docs/samples/steps-done.txt
  for S in showcase redline lorem-500; do
    # lorem-500: one engine that uses its whole deadline (OD_TIMEOUT_S, 30 minutes) in each of three
    # runs takes 90 minutes by itself; the others took about 40 on 2026-11-20.
    T=55; [ "$S" = lorem-500 ] && T=150
    step "e-$S" $T $PW scripts/measure_samples.py all $S "$RUNS" --out "docs/samples/$D-$S.json" --latest docs/samples/latest.json --shots shots 2>/tmp/$S.log
    grep -c '"engine"' /tmp/$S.log; grep -o '"error": "[^"]*' /tmp/$S.log | sort | uniq -c | head -20
    ran && { cp /tmp/$S.log docs/samples/ 2>/dev/null; up docs/samples "$P/editors/samples"; }
  done
  [[ -d shots ]] && up shots "$P/editors/shots"
}
viewer() {
  cd /w/viewer; export MEASURE_WHERE="from $HW"; STATE=results/steps-done.txt
  step v-showcase 25 $PW scripts/measure.py all "$RUNS" --results results/browser.json --raw "results/raw/$D-browser-showcase.json" >/dev/null 2>/tmp/b1.log; tail -2 /tmp/b1.log | cut -c1-300; ran && up results "$P/viewer/results"
  step v-redline 25 $PW scripts/measure.py all "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-browser-redline.json" >/dev/null 2>/tmp/b2.log; tail -2 /tmp/b2.log | cut -c1-300; ran && up results "$P/viewer/results"
  step v-lorem-500 35 $PW scripts/measure.py all "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-browser-lorem-500.json" >/dev/null 2>/tmp/b3.log; tail -2 /tmp/b3.log | cut -c1-300; ran && up results "$P/viewer/results"
  export MEASURE_WHERE="from $HW_CURL"
  step v-server-redline 5 python3 -I scripts/measure_server.py all "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-server-redline.json" >/dev/null; ran && up results "$P/viewer/results"
  step v-server-lorem-500 8 python3 -I scripts/measure_server.py all "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-server-lorem-500.json" >/dev/null
  ran && up results "$P/viewer/results"
  export MEASURE_WHERE="from $HW"
  step v-client 40 $PW scripts/measure_server_client.py all showcase,redline,lorem-500 "$RUNS" --out results/server-client.json --raw "results/raw/$D-server-client.json" >/dev/null 2>/tmp/sc.log; tail -2 /tmp/sc.log | cut -c1-300
  mkdir -p results/logs; cp /tmp/*.log results/logs/; [[ -e /tmp/ran-any ]] && up results "$P/viewer/results"
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
    step - 12 $PW scripts/measure.py "$V_ENGINES" "$RUNS" --results results/browser.json --raw "results/raw/$D-browser-showcase-retake.json" >/dev/null 2>/tmp/r1.log; tail -3 /tmp/r1.log | cut -c1-400
    step - 12 $PW scripts/measure.py "$V_ENGINES" "$RUNS" --doc redline --samples results/samples.json --raw "results/raw/$D-browser-redline-retake.json" >/dev/null 2>/tmp/r2.log; tail -3 /tmp/r2.log | cut -c1-400
    step - 15 $PW scripts/measure.py "$V_ENGINES" "$RUNS" --doc lorem-500 --samples results/samples.json --raw "results/raw/$D-browser-lorem-500-retake.json" >/dev/null 2>/tmp/r3.log; tail -3 /tmp/r3.log | cut -c1-400
    mkdir -p results/logs; cp /tmp/r?.log results/logs/; up results "$P/viewer/results"
  fi
  if [ -n "${E_ENGINES:-}" ]; then
    cd /w/editors; export MEASURE_WHERE="$HW"
    cp -R "/tmp/prev/$RETAKE_FROM/editors/samples/." docs/samples/
    for S in showcase redline lorem-500; do
      step - 15 $PW scripts/measure_samples.py "$E_ENGINES" $S "$RUNS" --out "docs/samples/$D-$S-retake.json" --latest docs/samples/latest.json --shots shots 2>/tmp/$S-retake.log
      grep -o '"error": "[^"]*' /tmp/$S-retake.log | cut -c1-200 | sort | uniq -c | head; cp /tmp/$S-retake.log docs/samples/
    done
    up docs/samples "$P/editors/samples"; up shots "$P/editors/shots"
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
  probe) cd /w/editors; for u in $PROBE_URLS; do echo "### $u"; step - 4 $PW scripts/probe_page.py "$u" 100 >/tmp/probe.log 2>&1; grep -v '^state \|^responses by status ' /tmp/probe.log | cut -c1-600 | head -150; grep '^state \|^responses by status ' /tmp/probe.log; done ;;
esac
echo "done $(date -u +%T)"
if [[ -s /tmp/failed ]]; then echo "FAILED:"; cat /tmp/failed; exit 1; fi
echo "PASS COMPLETE"
