#!/usr/bin/env bash
# Runs inside the emulator job: install the release APK, run the Maestro flows, then prove the app
# never touches the network (per-app traffic counters stay at zero) and still works with networking
# switched off. Any app crash fails the run.
set -euo pipefail
APK="$1"
PKG=com.gymtracker.app
OUT=e2e-out
mkdir -p "$OUT"
adb install -r "$APK"
adb logcat -c
# Offline by design: the app is built without Android's INTERNET permission.
if adb shell dumpsys package "$PKG" | grep -q "android.permission.INTERNET: granted=true"; then
  echo "The app holds the INTERNET permission; it must not"; exit 1
fi
echo "INTERNET permission: not held (the OS blocks all network access for the app)"
export PATH="$PATH:$HOME/.maestro/bin"

# On any failure: print what was on screen and the app's logs into the job log (readable without
# downloading artifacts).
diagnose() {
  echo "::group::Diagnostics: screen text (maestro hierarchy)"
  maestro hierarchy 2>/dev/null | grep -oE '"(text|accessibilityText|resource-id)" *: *"[^"]+"' | head -120 || true
  echo "::endgroup::"
  echo "::group::Diagnostics: app log (ReactNativeJS / crashes)"
  adb logcat -d -s ReactNativeJS:V ReactNative:W AndroidRuntime:E DEBUG:F libc:F | tail -150 || true
  echo "::endgroup::"
  echo "::group::Diagnostics: last Maestro steps"
  find "$OUT" -name 'maestro.log' -newer "$OUT/.start" -print0 2>/dev/null | xargs -0 -r tail -n 40 | cut -c1-300 || true
  echo "::endgroup::"
  echo "::group::Diagnostics: current activity"
  adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | head -5 || true
  echo "::endgroup::"
}
trap 'diagnose' ERR

# Run each flow on its own so the diagnostics show the screen at the moment that flow failed.
run_flows() {
  local tag="$1" failed=0
  for f in ${FLOWS:-.maestro/smoke.yaml .maestro/workout.yaml}; do
    touch "$OUT/.start"
    if ! maestro test --format junit --output "$OUT/report-$tag-$(basename "$f" .yaml).xml" --test-output-dir "$OUT/$tag" --debug-output "$OUT/$tag-debug" "$f"; then
      echo "FAILED: $f ($tag)"; diagnose; failed=1
    fi
  done
  return $failed
}

echo "== Run 1: network ON (any request would show up in the app's traffic counters)"
trap - ERR
run_flows online || { echo "Online run failed"; exit 1; }
trap 'diagnose' ERR
adb shell dumpsys netstats detail > "$OUT/netstats.txt" || true
APP_UID=$(adb shell dumpsys package "$PKG" | grep -m1 -o 'userId=[0-9]*' | cut -d= -f2)
echo "app uid: $APP_UID"
# netstats: lines "ident=... uid=<uid> set=..." followed by bucket lines "st=... rb=<rx bytes> ... tb=<tx bytes>"
awk -v u="uid=$APP_UID" '$0 ~ u {f=1; next} /uid=/ {f=0} f && /rb=/ {for(i=1;i<=NF;i++){if($i ~ /^rb=/){split($i,a,"=");r+=a[2]} if($i ~ /^tb=/){split($i,b,"=");t+=b[2]}}} END {print "app network bytes: rx=" r+0 " tx=" t+0; if (r+t>0) exit 1}' "$OUT/netstats.txt"

echo "== Run 2: network OFF (airplane mode): the app must work fully offline"
adb shell cmd connectivity airplane-mode enable || adb shell settings put global airplane_mode_on 1
adb shell svc wifi disable || true
adb shell svc data disable || true
trap - ERR
run_flows offline || { echo "Offline run failed"; exit 1; }

adb logcat -d > "$OUT/logcat.txt"
if grep -E "FATAL EXCEPTION|AndroidRuntime: Process: $PKG|ReactNativeJS: .*(TypeError|ReferenceError|Unhandled)" "$OUT/logcat.txt"; then
  echo "Crash or fatal JS error found in logcat"; exit 1
fi
echo "All flows passed, no crashes, no network use."
