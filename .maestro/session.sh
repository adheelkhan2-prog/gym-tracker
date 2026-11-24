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
BRANCH="${E2E_BRANCH:-round-6}"
APK=android/app/build/outputs/apk/release/app-release.apk
export PATH="$PATH:$HOME/.maestro/bin"
RES=$(mktemp -d)
END=$((SECONDS + ${E2E_MINUTES:-320} * 60))

adb shell settings put global hide_error_dialogs 1 || true
built=$(git rev-parse HEAD)
last=""

log() { echo "$*" | tee -a "$RES/results.txt"; }

build_if_needed() {
  local want="$1" changed
  changed=$(git diff --name-only "$built" "$want")
  if echo "$changed" | grep -qE '^(app\.json|plugins/|package(-lock)?\.json|metro\.config\.js|babel\.config\.js)'; then
    log "rebuild: native config changed -> prebuild + build"
    npm ci --no-audit --no-fund >/dev/null && npx expo prebuild --platform android --no-install >/dev/null || return 1
  elif echo "$changed" | grep -qE '^(src/|assets/|demo/)'; then
    log "rebuild: app code changed -> incremental build"
  else
    log "no app change since $(git rev-parse --short "$built"): reusing the installed build"
    return 0
  fi
  (cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64 -q) >"$RES/build.log" 2>&1 || { tail -40 "$RES/build.log" | tee -a "$RES/results.txt"; return 1; }
  adb install -r "$APK" >/dev/null || return 1
  built="$want"
}

diagnose() {
  local n="$1"
  log "--- screen ---"
  maestro hierarchy 2>/dev/null | grep -oE '"(text|accessibilityText|resource-id)" *: *"[^"]+"' | grep -v 'systemui\|inputmethod' | head -80 >>"$RES/results.txt"
  log "--- app log ---"
  adb logcat -d -s ReactNativeJS:V AndroidRuntime:E DEBUG:F | tail -60 >>"$RES/results.txt"
  log "--- last steps ---"
  find "$HOME/.maestro/tests" -name maestro.log -newer "$RES/.start" -print0 2>/dev/null | xargs -0 -r grep -h "onCommandFinished" | tail -25 | cut -c1-200 >>"$RES/results.txt"
  adb exec-out screencap -p >"$RES/fail-$n.png" 2>/dev/null || true
}

run_flows() {
  local tag="$1"; shift
  local ok=0 n=0
  for f in "$@"; do
    n=$((n + 1)); touch "$RES/.start"
    if maestro test ".maestro/flows/$f.yaml" >"$RES/maestro.out" 2>&1; then
      log "PASS $tag $f"
    else
      log "FAIL $tag $f: $(grep -E '\[Failed\]|Assertion|not found' "$RES/maestro.out" | head -3 | tr '\n' ' ')"
      diagnose "$tag-$f"; ok=1
    fi
  done
  return $ok
}

crashes() {
  if adb logcat -d | grep -E "FATAL EXCEPTION|AndroidRuntime: Process: $PKG|ReactNativeJS: .*(TypeError|ReferenceError|Unhandled)" | head -20 >"$RES/crash.txt" && [ -s "$RES/crash.txt" ]; then
    log "CRASH found in logcat:"; cat "$RES/crash.txt" >>"$RES/results.txt"; return 1
  fi
  return 0
}

network_bytes() {
  local uid
  uid=$(adb shell dumpsys package "$PKG" | grep -m1 -o 'userId=[0-9]*' | cut -d= -f2)
  adb shell dumpsys netstats detail | awk -v u="uid=$uid" '$0 ~ u {f=1; next} /uid=/ {f=0} f && /rb=/ {for(i=1;i<=NF;i++){if($i ~ /^rb=/){split($i,a,"=");r+=a[2]} if($i ~ /^tb=/){split($i,b,"=");t+=b[2]}}} END {print r+t}'
}

publish() {
  (cd "$RES" && rm -rf .git && git init -q && git checkout -q -b e2e-results && git add results.txt fail-*.png 2>/dev/null; git -c user.name=e2e-session -c user.email=e2e@localhost commit -qm "e2e results: $1" && git push -qf "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" e2e-results) || echo "publish failed"
}

while [ $SECONDS -lt $END ]; do
  git fetch -q origin "$BRANCH" || { sleep 20; continue; }
  req=$(git show "origin/$BRANCH:.maestro/session.txt" 2>/dev/null || true)
  id=$(echo "$req" | sed -n 1p); mode=$(echo "$req" | sed -n 2p); flows=$(echo "$req" | sed -n 3p)
  if [ -n "$id" ] && [ "$id" != "$last" ]; then
    last="$id"
    [ "$id" = stop ] && { echo "stop requested"; break; }
    rm -f "$RES"/fail-*.png; : >"$RES/results.txt"
    want=$(git rev-parse "origin/$BRANCH"); git checkout -q -f "$want"
    log "request $id ($mode) at $(git rev-parse --short "$want"), session up $((SECONDS / 60)) min"
    status=OK
    if ! build_if_needed "$want"; then
      status=BUILD-FAILED
    elif [ "$mode" = full ]; then
      adb shell dumpsys package "$PKG" | grep -q "android.permission.INTERNET: granted=true" && { log "FAIL: the app holds INTERNET"; status=FAILED; }
      adb logcat -c
      before=$(network_bytes); before=${before:-0}
      run_flows online full || status=FAILED
      after=$(network_bytes); after=${after:-0}
      log "app network bytes during the online run: $((after - before))"
      [ "$((after - before))" -gt 0 ] && status=FAILED
      adb shell cmd connectivity airplane-mode enable || true
      adb shell svc wifi disable || true; adb shell svc data disable || true
      run_flows airplane full || status=FAILED
      adb shell cmd connectivity airplane-mode disable || true
      adb shell svc wifi enable || true; adb shell svc data enable || true
      crashes || status=FAILED
    else
      adb logcat -c
      # shellcheck disable=SC2086
      run_flows quick ${flows:-nav start log scroll swap finish} || status=FAILED
      crashes || status=FAILED
    fi
    log "RESULT $id: $status"
    publish "$id $status"
  fi
  sleep 20
done
