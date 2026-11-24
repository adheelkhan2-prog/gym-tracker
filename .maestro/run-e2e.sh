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
export PATH="$PATH:$HOME/.maestro/bin"

echo "== Run 1: network ON (any request would show up in the app's traffic counters)"
maestro test --format junit --output "$OUT/report-online.xml" --test-output-dir "$OUT/online" ${FLOWS:-.maestro/smoke.yaml .maestro/workout.yaml}
adb shell dumpsys netstats detail > "$OUT/netstats.txt" || true
APP_UID=$(adb shell dumpsys package "$PKG" | grep -m1 -o 'userId=[0-9]*' | cut -d= -f2)
echo "app uid: $APP_UID"
# netstats: lines "ident=... uid=<uid> set=..." followed by bucket lines "st=... rb=<rx bytes> ... tb=<tx bytes>"
awk -v u="uid=$APP_UID" '$0 ~ u {f=1; next} /uid=/ {f=0} f && /rb=/ {for(i=1;i<=NF;i++){if($i ~ /^rb=/){split($i,a,"=");r+=a[2]} if($i ~ /^tb=/){split($i,b,"=");t+=b[2]}}} END {print "app network bytes: rx=" r+0 " tx=" t+0; if (r+t>0) exit 1}' "$OUT/netstats.txt"

echo "== Run 2: network OFF (airplane mode): the app must work fully offline"
adb shell cmd connectivity airplane-mode enable || adb shell settings put global airplane_mode_on 1
adb shell svc wifi disable || true
adb shell svc data disable || true
maestro test --format junit --output "$OUT/report-offline.xml" --test-output-dir "$OUT/offline" ${FLOWS:-.maestro/smoke.yaml .maestro/workout.yaml}

adb logcat -d > "$OUT/logcat.txt"
if grep -E "FATAL EXCEPTION|AndroidRuntime: Process: $PKG|ReactNativeJS: .*(TypeError|ReferenceError|Unhandled)" "$OUT/logcat.txt"; then
  echo "Crash or fatal JS error found in logcat"; exit 1
fi
echo "All flows passed, no crashes, no network use."
