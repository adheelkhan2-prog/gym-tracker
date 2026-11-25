#!/usr/bin/env bash
# A long-lived emulator test session (see .github/workflows/android-e2e.yml).
#
# The emulator stays up. Every 20 s the session reads .maestro/session.txt on the branch:
#   line 1: a request id (change it to send a new request; "stop" ends the session)
#   line 2: quick | full
#   line 3: flows to run for "quick", e.g. "swap finish" (default: all, once)
# For a new request it checks out the latest commit, rebuilds ONLY if app code changed (an
# incremental Gradle build; a full prebuild only when app.json, plugins or packages changed),
# reinstalls, runs the flows, and pushes the results to the e2e-results branch
# (results.txt + fail-N.png screenshots) so they can be read while the session keeps running.
#
# "full" is the crash test: flows/full.yaml (every flow, 10 times) with the network ON (the app's
# traffic counters must stay at zero), then again in airplane mode, plus a logcat crash check.
set -uo pipefail
PKG=com.gymtracker.app
BRANCH="${E2E_BRANCH:-round-7}"
APK=android/app/build/outputs/apk/release/app-release.apk
export PATH="$PATH:$HOME/.maestro/bin"
RES=$(mktemp -d)
END=$((SECONDS + ${E2E_MINUTES:-320} * 60))

adb shell settings put global hide_error_dialogs 1 || true
built=$(git rev-parse HEAD)
last=""

log() { echo "$*" | tee -a "$RES/results.txt"; }

# Functions (build, run flows, diagnose, publish) live in session-lib.sh and are re-read for every
# request from the commit being tested.
# shellcheck source=/dev/null
source .maestro/session-lib.sh

while [ $SECONDS -lt $END ]; do
  git fetch -q origin "$BRANCH" || { sleep 20; continue; }
  req=$(git show "origin/$BRANCH:.maestro/session.txt" 2>/dev/null || true)
  id=$(echo "$req" | sed -n 1p); mode=$(echo "$req" | sed -n 2p); flows=$(echo "$req" | sed -n 3p)
  if [ -n "$id" ] && [ "$id" != "$last" ]; then
    last="$id"
    [ "$id" = stop ] && { echo "stop requested"; break; }
    rm -f "$RES"/fail-*.png; : >"$RES/results.txt"
    want=$(git rev-parse "origin/$BRANCH"); git checkout -q -f "$want"
    # The test logic comes from the commit under test, so fixing it never needs a new emulator.
    # shellcheck source=/dev/null
    source .maestro/session-lib.sh
    log "request $id ($mode) at $(git rev-parse --short "$want"), session up $((SECONDS / 60)) min"
    status=OK
    if ! build_if_needed "$want"; then
      status=BUILD-FAILED
    elif [ "$mode" = full ]; then
      adb shell dumpsys package "$PKG" | grep -q "android.permission.INTERNET: granted=true" && { log "FAIL: the app holds INTERNET"; status=FAILED; }
      adb logcat -c
      before=$(network_bytes)
      run_flows online full || status=FAILED
      after=$(network_bytes)
      if [[ "$before" =~ ^[0-9]+$ && "$after" =~ ^[0-9]+$ ]]; then
        log "app network bytes during the online run: $((after - before))"
        [ "$((after - before))" -gt 0 ] && status=FAILED
      else
        log "FAIL: could not read the app's traffic counters ($before / $after)"; status=FAILED
      fi
      adb shell cmd connectivity airplane-mode enable || true
      adb shell svc wifi disable || true; adb shell svc data disable || true
      run_flows airplane full || status=FAILED
      adb shell cmd connectivity airplane-mode disable || true
      adb shell svc wifi enable || true; adb shell svc data enable || true
      crashes || status=FAILED
    else
      adb logcat -c
      # shellcheck disable=SC2086
      run_flows quick ${flows:-nav start log scroll page swap finish} || status=FAILED
      crashes || status=FAILED
    fi
    log "RESULT $id: $status"
    publish "$id $status"
  fi
  sleep 20
done
