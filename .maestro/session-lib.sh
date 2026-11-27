# Sourced by session.sh for every request (from the commit under test). Uses: RES, PKG, APK, built.
# npm ci + prebuild when native config changed between two commits (returns 1 on failure).
native_prep() {
  if git diff --name-only "$1" "$2" | grep -qE '^(app\.json|plugins/|modules/|package(-lock)?\.json|metro\.config\.js|babel\.config\.js)'; then
    log "rebuild: native config changed -> prebuild + build"
    npm ci --no-audit --no-fund >/dev/null && npx expo prebuild --platform android --no-install >/dev/null || return 1
    return 0
  fi
  return 2
}

build_if_needed() {
  local want="$1" r
  native_prep "$built" "$want"; r=$?
  [ $r = 1 ] && return 1
  if [ $r = 2 ]; then
    if git diff --name-only "$built" "$want" | grep -qE '^(src/|assets/|demo/)'; then
      log "rebuild: app code changed -> incremental build"
    else
      log "no app change since $(git rev-parse --short "$built"): reusing the installed build"
      return 0
    fi
  fi
  # The perf flag always matches the installed variant (a failed variant switch may have left it set).
  if [ "$VARIANT" = perf ]; then export EXPO_PUBLIC_PERF=1; else unset EXPO_PUBLIC_PERF; fi
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
  log "--- why the app stopped (if it did) ---"
  adb logcat -d | grep -iE "lowmemorykiller|Killing .*gymtracker|ActivityManager: Process com.gymtracker.app|has died|ANR in com.gymtracker|Force stopping com.gymtracker|START u0.*HOME" | tail -12 >>"$RES/results.txt"
  log "--- last steps ---"
  find "$RES/dbg" -name maestro.log -print0 2>/dev/null | xargs -0 -r grep -h "onCommandFinished" | grep -v "Apply configuration" | tail -14 | sed 's/.*onCommandFinished: //' | cut -c1-160 >>"$RES/results.txt"
  log "--- taps ---"
  find "$RES/dbg" -name 'commands-*.json' -print0 2>/dev/null | xargs -0 -r cat | jq -c '.[] | select(.command.tapOnElement != null) | {sel: (.command.tapOnElement.selector.idRegex // .command.tapOnElement.selector.textRegex), status: .metadata.status, ms: .metadata.duration, err: .metadata.error.message}' 2>/dev/null | tail -6 >>"$RES/results.txt"
  find "$RES/dbg" -name maestro.log -print0 2>/dev/null | xargs -0 -r grep -hiE 'tap|bounds|click' | tail -12 | cut -c1-240 >>"$RES/results.txt"
  adb exec-out screencap -p >"$RES/fail-$n.png" 2>/dev/null || true
  [ -f after-swap-tap.png ] && cp after-swap-tap.png "$RES/fail-$n-after-tap.png"
}

# --- Rest alarm checks: "rest-off" (screen off + forced Doze) and "rest-bg" (app in background) ----
# Starts a rest in the app, then measures, from outside the app, when "Rest is over" is posted
# compared with the countdown's own end time (the chronometer's `when`), and checks the countdown is
# an ongoing count-down chronometer visible on the lock screen. Then +15s / Skip are checked.
notif_dump() { adb shell dumpsys notification --noredact 2>/dev/null | tr -d '\r'; }
# The countdown's end (epoch ms) from its notification (id 7311), or empty.
countdown_when() { notif_dump | awk '/pkg=com.gymtracker.app/ && /id=7311/ {f=1} f && /when=/ {match($0, /when=[0-9]+/); if (RSTART) {print substr($0, RSTART+5, RLENGTH-5); exit}}'; }
# (Read into a variable first: with pipefail, grep -q closing the pipe early would read as "not found".)
end_posted() { local d; d=$(notif_dump); grep -qE "channel=rest-end-(alarm|vibrate)" <<<"$d"; }
now_ms() { adb shell date +%s%3N | tr -d '\r'; }
rest_check() {
  local how="$1" end seen late=999999 i
  adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
  adb shell appops set "$PKG" SCHEDULE_EXACT_ALARM allow 2>/dev/null || true
  rm -rf "$RES/dbg"
  maestro test --debug-output "$RES/dbg" .maestro/flows/rest-start.yaml >"$RES/maestro.out" 2>&1 || { log "FAIL $how: could not start a rest"; tail -8 "$RES/maestro.out" >>"$RES/results.txt"; diagnose "$how"; return 1; }
  sleep 2
  local e0; e0=$(countdown_when)
  [ -n "$e0" ] || { log "FAIL $how: no countdown notification"; notif_dump | grep -A30 "pkg=$PKG" | head -60 >>"$RES/results.txt"; return 1; }
  # +15s moves the countdown (and the alarm) 15 s later, straight away.
  maestro test --debug-output "$RES/dbg" .maestro/flows/rest-add.yaml >"$RES/maestro.out" 2>&1 || { log "FAIL $how: +15s"; tail -8 "$RES/maestro.out" >>"$RES/results.txt"; diagnose "$how"; return 1; }
  sleep 1
  end=$(countdown_when)
  if [ -z "$end" ] || [ $((end - e0)) -lt 14000 ] || [ $((end - e0)) -gt 16000 ]; then log "FAIL $how: +15s moved the countdown by $((${end:-0} - e0)) ms"; return 1; fi
  log "PASS $how: +15s moved the countdown by $((end - e0)) ms"
  notif_dump | awk '/pkg=com.gymtracker.app/ && /id=7311/ {f=1} f {print} f && /^ *NotificationRecord/ && !/id=7311/ {exit}' | grep -E "chronometerCountDown|showChronometer|flags=|vis=|channel=" | head -6 >"$RES/countdown.txt"
  grep -qE "chronometerCountDown=(Boolean \\()?true" "$RES/countdown.txt" || { log "FAIL $how: countdown is not an Android count-down chronometer"; cat "$RES/countdown.txt" >>"$RES/results.txt"; return 1; }
  adb shell dumpsys alarm | grep -B2 -A6 "$PKG" | grep -m3 -iE "ALARM_CLOCK|RTC_WAKEUP|alarmClock" >>"$RES/results.txt" || true
  if [ "$how" = rest-off ]; then
    adb shell input keyevent KEYCODE_SLEEP; sleep 1
    adb shell dumpsys deviceidle force-idle >/dev/null 2>&1 || true
  else
    adb shell input keyevent KEYCODE_HOME
  fi
  log "$how: rest ends at $end (in $(( (end - $(now_ms)) / 1000 )) s)"
  for i in $(seq 1 400); do
    if end_posted; then seen=$(now_ms); late=$((seen - end)); break; fi
    sleep 0.5
  done
  adb shell dumpsys deviceidle unforce >/dev/null 2>&1 || true
  adb shell input keyevent KEYCODE_WAKEUP; adb shell wm dismiss-keyguard 2>/dev/null || true
  [ -n "$(countdown_when)" ] && { log "FAIL $how: the countdown was still showing after the end"; return 1; }
  if [ "$late" -gt 1500 ] || [ "$late" -lt -1500 ]; then
    log "FAIL $how: Rest is over posted ${late} ms from the end time"
    { echo "--- channels ---"; notif_dump | grep -E "NotificationChannel\{.*(rest|mId=)" | grep -i rest | cut -c1-300 | head -8
      echo "--- app notifications ---"; notif_dump | grep -A3 "pkg=$PKG" | cut -c1-300 | head -20
      echo "--- log ---"; adb logcat -d | grep -iE "notif|channel|expo|alarm" | grep -iE "gymtracker|expo|No Channel|rest-end" | tail -25 | cut -c1-300; } >>"$RES/results.txt"
    return 1
  fi
  log "PASS $how: Rest is over posted ${late} ms after 0:00 (countdown: $(tr '\n' ' ' <"$RES/countdown.txt" | cut -c1-160))"
  # +15s then Skip, in the app: Skip removes the countdown and the alarm straight away.
  maestro test --debug-output "$RES/dbg" .maestro/flows/rest-start.yaml >"$RES/maestro.out" 2>&1 || true
  maestro test --debug-output "$RES/dbg" .maestro/flows/rest-add.yaml >"$RES/maestro.out" 2>&1 || true
  sleep 1; local e1; e1=$(countdown_when)
  maestro test --debug-output "$RES/dbg" .maestro/flows/rest-skip.yaml >"$RES/maestro.out" 2>&1 || { log "FAIL $how: Skip"; return 1; }
  sleep 1
  if [ -n "$(countdown_when)" ]; then log "FAIL $how: countdown still there after Skip (was $e1)"; return 1; fi
  if adb shell dumpsys alarm | grep -A4 "$PKG" | grep -qi "expo.modules.notifications"; then log "FAIL $how: alarm still pending after Skip"; return 1; fi
  log "PASS $how: Skip cleared the countdown and the alarm"
}

run_flows() {
  local tag="$1"; shift
  local ok=0 n=0
  for f in "$@"; do
    n=$((n + 1)); touch "$RES/.start"
    rm -rf "$RES/dbg"
    if [ "$f" = rest-off ] || [ "$f" = rest-bg ]; then rest_check "$f" || ok=1; continue; fi
    if maestro test --debug-output "$RES/dbg" ".maestro/flows/$f.yaml" >"$RES/maestro.out" 2>&1; then
      log "PASS $tag $f"
    else
      log "FAIL $tag $f"
      grep -vE 'libcuda|cuInit|h264|^$|Waiting for flows|analytics' "$RES/maestro.out" | tail -8 >>"$RES/results.txt"
      diagnose "$tag-$f"; ok=1
    fi
    # Screenshots a flow takes on purpose (takeScreenshot: shot-...) go out with the results.
    for p in shot-*.png; do [ -f "$p" ] && mv "$p" "$RES/$tag-$p"; done
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
  # "uid:10123" (dumpsys package says appId= on newer Android, so don't parse that).
  uid=$(adb shell cmd package list packages -U "$PKG" | grep -m1 -o 'uid:[0-9]*' | cut -d: -f2)
  [ -n "$uid" ] || { echo "unknown-uid"; return; }
  adb shell dumpsys netstats detail | awk -v u="uid=$uid" '$0 ~ (u "( |$)") {f=1; next} /uid=/ {f=0} f && /rb=/ {for(i=1;i<=NF;i++){if($i ~ /^rb=/){split($i,a,"=");r+=a[2]} if($i ~ /^tb=/){split($i,b,"=");t+=b[2]}}} END {print r+t}'
}

publish() {
  (cd "$RES" && rm -rf .git && git init -q && git checkout -q -b e2e-results && git add results.txt && { ls fail-*.png >/dev/null 2>&1 && git add fail-*.png; true; } && { ls ./*shot-*.png >/dev/null 2>&1 && git add ./*shot-*.png; true; } && git -c user.name=e2e-session -c user.email=e2e@localhost commit -qm "e2e results: $1" && git push -qf "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" e2e-results) || echo "publish failed"
}


# --- Speed checks ("perf" requests) --------------------------------------------------------------
# The perf build is the same release build with EXPO_PUBLIC_PERF=1 inlined in the JS bundle: it logs
# "[perf] <mark> <epoch ms>" to logcat and seeds ~900 days of history on a fresh start.
VARIANT=${VARIANT:-normal}

# Build the given variant (normal | perf) of the commit, rebuilding the JS bundle when the variant
# changes (the flag is baked into the bundle, so the cached one can't be reused).
build_variant() {
  local want="$1" v="$2" ref prev="$VARIANT"
  # Start from exactly the requested commit (an earlier "ref=" run leaves another commit's src/ behind).
  git reset -q --hard && git clean -fdq src
  # "perf" with "ref=<commit>" on line 3: measure that commit's app (src/) with today's test scripts.
  ref=$(echo "${flows:-}" | grep -oE 'ref=[0-9a-f]+' | cut -d= -f2)
  if [ "$v" = perf ] && [ -n "$ref" ]; then
    # Exactly that commit's src/: nothing added since may stay behind (e.g. a newer route).
    git cat-file -e "$ref^{commit}" 2>/dev/null || git fetch -q origin "$ref" 2>/dev/null ||
      { log "FAIL: commit $ref not found"; return 1; }
    git rm -rq --cached src && rm -rf src && git checkout -q "$ref" -- src || return 1
    log "measuring the app code of $(git rev-parse --short "$ref") (src/), test scripts of $(git rev-parse --short "$want")"
    # Native config (app.json, packages) is still $want's, so the build is compared against $want.
    VARIANT=forced
  fi
  if [ "$v" = "$VARIANT" ]; then build_if_needed "$want"; return; fi
  log "rebuild: $prev -> $v build$([ -n "$ref" ] && [ "$v" = perf ] && echo " (of $ref's app code)")"
  native_prep "$built" "$want"; [ $? = 1 ] && return 1
  rm -rf android/app/build/generated/assets android/app/build/generated/res/createBundleReleaseJsAndAssets \
    android/app/build/intermediates/assets android/app/build/intermediates/merged_assets node_modules/.cache "${TMPDIR:-/tmp}"/metro-* 2>/dev/null
  if [ "$v" = perf ]; then export EXPO_PUBLIC_PERF=1; else unset EXPO_PUBLIC_PERF; fi
  (cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64 -q) >"$RES/build.log" 2>&1 || { tail -40 "$RES/build.log" | tee -a "$RES/results.txt"; return 1; }
  adb install -r "$APK" >/dev/null || return 1
  built="$want"; VARIANT="$v"
  # A build of another commit's src/ is never reused: the next request always rebuilds.
  [ -n "$ref" ] && [ "$v" = perf ] && VARIANT=forced
  return 0
}

# Epoch ms of the first "[perf] <name>" mark in the logcat dump $1 at or after epoch ms $2.
mark() { awk -v n="$2" -v t="${3:-0}" '/\[perf\] / {for(i=1;i<=NF;i++) if($i=="[perf]" && $(i+1)==n && $(i+2)+0>=t+0) {print $(i+2); exit}}' "$1"; }
# Epoch ms of the activity START line for the app in the logcat dump $1.
start_ms() { awk -v p="$PKG" '/ActivityTaskManager: START u0/ && index($0,p) {split($1,a,"."); print a[1] substr(a[2]"000",1,3); exit}' "$1"; }
avg() { awk '{s+=$1; n++} END {if(n) printf "%.0f", s/n; else print "n/a"}'; }
pss() {
  local m pid
  # Collect garbage first (SIGUSR1 makes ART run a GC), so the Java heap shows what's really in use.
  pid=$(adb shell pidof "$PKG" | tr -d '\r')
  [ -n "$pid" ] && { adb shell su 0 kill -10 "$pid" 2>/dev/null || adb shell kill -10 "$pid" 2>/dev/null; }; sleep 3
  m=$(adb shell dumpsys meminfo "$PKG")
  local total gfx native java
  total=$(echo "$m" | grep -m1 -oE 'TOTAL PSS: *[0-9]+' | grep -oE '[0-9]+$')
  gfx=$(echo "$m" | grep -m1 -E '^ *Graphics:' | grep -oE '[0-9]+' | head -1)
  native=$(echo "$m" | grep -m1 -E '^ *Native Heap:' | grep -oE '[0-9]+' | head -1)
  java=$(echo "$m" | grep -m1 -E '^ *Java Heap:' | grep -oE '[0-9]+' | head -1)
  if [ -z "$pid" ] || [ -z "$total" ]; then log "MEM $1: app not running"; return; fi
  log "MEM $1: total PSS $((total / 1024)) MB (native $((native / 1024)), java $((java / 1024)), graphics $((gfx / 1024)))"
}

# Clear logcat, but first keep any crash lines from it (checked at the end of perf_run).
CRASH_RE="FATAL EXCEPTION|AndroidRuntime: Process: $PKG|ReactNativeJS: .*(TypeError|ReferenceError|Unhandled)"
clear_log() { adb logcat -d | grep -E "$CRASH_RE" >>"$RES/perf-crash.txt"; adb logcat -c; }

perf_run() {
  local ok=0 i t s r d vm
  : >"$RES/perf-crash.txt"
  adb logcat -G 16M 2>/dev/null || true  # room for every perf mark of a whole pass
  # Seed the big history once (fresh start), then let it save.
  adb shell pm clear "$PKG" >/dev/null
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 25
  run_flows seed nav >/dev/null 2>&1 || true
  # 1. Cold start x5: process start -> Today on screen (JS mark), and Android's own TotalTime.
  : >"$RES/cold.txt"; : >"$RES/total.txt"
  for i in 1 2 3 4 5; do
    adb shell am force-stop "$PKG"; sleep 2; clear_log
    r=$(adb shell am start -W -n "$PKG/.MainActivity" | grep -oE 'TotalTime: [0-9]+' | grep -oE '[0-9]+')
    for _ in $(seq 30); do adb logcat -d -v epoch >"$RES/lc.txt"; grep -q '\[perf\] today-ready' "$RES/lc.txt" && break; sleep 1; done
    s=$(start_ms "$RES/lc.txt"); t=$(mark "$RES/lc.txt" today-ready)
    [ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) >>"$RES/cold.txt"; [ -n "$r" ] && echo "$r" >>"$RES/total.txt"
    log "cold start $i: Today ready $([ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) || echo '?') ms, Android TotalTime ${r:-?} ms"
  done
  log "PERF cold start (avg of 5): Today ready $(avg <"$RES/cold.txt") ms, Android TotalTime $(avg <"$RES/total.txt") ms"
  adb shell am force-stop "$PKG"; sleep 2
  adb shell am start -W -n "$PKG/.MainActivity" >/dev/null; sleep 12; pss "Today after a cold start"
  # 2. Opening a workout x3 (each a fresh start with the big history): tap -> screen, tap -> first video frame.
  : >"$RES/open.txt"; : >"$RES/frame.txt"
  for i in 1 2 3; do
    clear_log
    run_flows perf perf/open || ok=1
    adb logcat -d -v epoch >"$RES/lc.txt"
    vm=video-frame; grep -q '\[perf\] video-shown' "$RES/lc.txt" && vm=video-shown
    s=$(mark "$RES/lc.txt" tap-start); t=$(mark "$RES/lc.txt" workout-ready "$s"); d=$(mark "$RES/lc.txt" "$vm" "$s")
    [ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) >>"$RES/open.txt"
    [ -n "$s" ] && [ -n "$d" ] && echo $((d - s)) >>"$RES/frame.txt"
    log "open workout $i: screen $([ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) || echo '?') ms, moving video $([ -n "$s" ] && [ -n "$d" ] && echo $((d - s)) || echo 'none') ms"
  done
  log "PERF open workout (avg of 3): screen $(avg <"$RES/open.txt") ms, moving video $(avg <"$RES/frame.txt") ms"
  sleep 5; pss "workout, page 1"
  # 3. Every page with Next, then back with Previous: page change -> its video's first frame.
  clear_log
  run_flows perf perf/pages || ok=1
  adb logcat -d -v epoch >"$RES/lc-fwd.txt"; clear_log
  pss "workout, after Next through all 7 pages"
  run_flows perf perf/back || ok=1
  pss "workout, after Previous back to page 1"
  if ! adb shell pidof "$PKG" >/dev/null; then
    log "FAIL: the app is no longer running. Android's record of why:"
    adb shell dumpsys activity exit-info "$PKG" | grep -E "reason|description|pss|rss" | head -8 >>"$RES/results.txt"; ok=1
  fi
  adb logcat -d -v epoch >"$RES/lc-back.txt"
  cat "$RES/lc-fwd.txt" "$RES/lc-back.txt" >"$RES/lc.txt"
  # When the moving video is on screen: "video-shown" (the still gives way to it); builds without
  # that mark show nothing before the first frame, so for them it's "video-frame".
  vm=video-frame; grep -q '\[perf\] video-shown' "$RES/lc.txt" && vm=video-shown
  grep -oE "\[perf\] (page-[0-9]+|$vm) [0-9]+" "$RES/lc.txt" | awk -v vm="$vm" '
    $2 ~ /^page-/ {if (p!="") print p, "none"; p=$2; t=$3; next}
    $2==vm && p!="" {print p, $3-t; p=""}
    END {if (p!="") print p, "none"}' >"$RES/pages.txt"
  log "page change -> moving video on screen, ms ($vm): $(tr '\n' ' ' <"$RES/pages.txt")"
  log "PERF page change -> moving video (avg of $(grep -vc none "$RES/pages.txt") pages with video): $(grep -v none "$RES/pages.txt" | awk '{print $2}' | avg) ms"
  log "video players created: $(grep -c 'ExoPlayerImpl: Init' "$RES/lc.txt"), released: $(grep -c 'ExoPlayerImpl: Release' "$RES/lc.txt")"
  # 4. Progress with ~900 days of history x3 (fresh process each time): tap -> screen ready.
  : >"$RES/prog.txt"
  for i in 1 2 3; do
    adb shell am force-stop "$PKG"; sleep 2; clear_log
    run_flows perf perf/progress || ok=1
    adb logcat -d -v epoch >"$RES/lc.txt"
    s=$(mark "$RES/lc.txt" tap-progress); t=$(mark "$RES/lc.txt" progress-ready "$s")
    [ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) >>"$RES/prog.txt"
    log "open Progress $i: $([ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) || echo '?') ms"
  done
  log "PERF open Progress with ~900 days of history (avg of 3): $(avg <"$RES/prog.txt") ms"
  clear_log
  if [ -s "$RES/perf-crash.txt" ]; then log "CRASH during the speed checks:"; head -20 "$RES/perf-crash.txt" >>"$RES/results.txt"; ok=1; fi
  sleep 5; pss "Progress with ~900 days of history"
  return $ok
}
