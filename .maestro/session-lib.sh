# Sourced by session.sh for every request (from the commit under test). Uses: RES, PKG, APK, built.
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
  find "$RES/dbg" -name maestro.log -print0 2>/dev/null | xargs -0 -r grep -h "onCommandFinished" | grep -v "Apply configuration" | tail -14 | sed 's/.*onCommandFinished: //' | cut -c1-160 >>"$RES/results.txt"
  log "--- taps ---"
  find "$RES/dbg" -name 'commands-*.json' -print0 2>/dev/null | xargs -0 -r cat | jq -c '.[] | select(.command.tapOnElement != null) | {sel: (.command.tapOnElement.selector.idRegex // .command.tapOnElement.selector.textRegex), status: .metadata.status, ms: .metadata.duration, err: .metadata.error.message}' 2>/dev/null | tail -6 >>"$RES/results.txt"
  find "$RES/dbg" -name maestro.log -print0 2>/dev/null | xargs -0 -r grep -hiE 'tap|bounds|click' | tail -12 | cut -c1-240 >>"$RES/results.txt"
  adb exec-out screencap -p >"$RES/fail-$n.png" 2>/dev/null || true
  [ -f after-swap-tap.png ] && cp after-swap-tap.png "$RES/fail-$n-after-tap.png"
}

run_flows() {
  local tag="$1"; shift
  local ok=0 n=0
  for f in "$@"; do
    n=$((n + 1)); touch "$RES/.start"
    rm -rf "$RES/dbg"
    if maestro test --debug-output "$RES/dbg" ".maestro/flows/$f.yaml" >"$RES/maestro.out" 2>&1; then
      log "PASS $tag $f"
    else
      log "FAIL $tag $f"
      grep -vE 'libcuda|cuInit|h264|^$|Waiting for flows|analytics' "$RES/maestro.out" | tail -8 >>"$RES/results.txt"
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
  # "uid:10123" (dumpsys package says appId= on newer Android, so don't parse that).
  uid=$(adb shell cmd package list packages -U "$PKG" | grep -m1 -o 'uid:[0-9]*' | cut -d: -f2)
  [ -n "$uid" ] || { echo "unknown-uid"; return; }
  adb shell dumpsys netstats detail | awk -v u="uid=$uid" '$0 ~ (u "( |$)") {f=1; next} /uid=/ {f=0} f && /rb=/ {for(i=1;i<=NF;i++){if($i ~ /^rb=/){split($i,a,"=");r+=a[2]} if($i ~ /^tb=/){split($i,b,"=");t+=b[2]}}} END {print r+t}'
}

publish() {
  (cd "$RES" && rm -rf .git && git init -q && git checkout -q -b e2e-results && git add results.txt && { ls fail-*.png >/dev/null 2>&1 && git add fail-*.png; true; } && git -c user.name=e2e-session -c user.email=e2e@localhost commit -qm "e2e results: $1" && git push -qf "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" e2e-results) || echo "publish failed"
}


# --- Speed checks ("perf" requests) --------------------------------------------------------------
# The perf build is the same release build with EXPO_PUBLIC_PERF=1 inlined in the JS bundle: it logs
# "[perf] <mark> <epoch ms>" to logcat and seeds ~900 days of history on a fresh start.
VARIANT=${VARIANT:-normal}

# Build the given variant (normal | perf) of the commit, rebuilding the JS bundle when the variant
# changes (the flag is baked into the bundle, so the cached one can't be reused).
build_variant() {
  local want="$1" v="$2"
  if [ "$v" = "$VARIANT" ]; then build_if_needed "$want"; return; fi
  log "rebuild: $VARIANT -> $v build"
  rm -rf android/app/build/generated/assets android/app/build/generated/res/createBundleReleaseJsAndAssets \
    android/app/build/intermediates/assets android/app/build/intermediates/merged_assets node_modules/.cache "${TMPDIR:-/tmp}"/metro-* 2>/dev/null
  if [ "$v" = perf ]; then export EXPO_PUBLIC_PERF=1; else unset EXPO_PUBLIC_PERF; fi
  (cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64 -q) >"$RES/build.log" 2>&1 || { tail -40 "$RES/build.log" | tee -a "$RES/results.txt"; return 1; }
  adb install -r "$APK" >/dev/null || return 1
  built="$want"; VARIANT="$v"
}

# Epoch ms of the first "[perf] <name>" mark in the logcat dump $1 at or after epoch ms $2.
mark() { awk -v n="$2" -v t="${3:-0}" '/\[perf\] / {for(i=1;i<=NF;i++) if($i=="[perf]" && $(i+1)==n && $(i+2)+0>=t+0) {print $(i+2); exit}}' "$1"; }
# Epoch ms of the activity START line for the app in the logcat dump $1.
start_ms() { awk -v p="$PKG" '/ActivityTaskManager: START u0/ && index($0,p) {split($1,a,"."); print a[1] substr(a[2]"000",1,3); exit}' "$1"; }
avg() { awk '{s+=$1; n++} END {if(n) printf "%.0f", s/n; else print "n/a"}'; }
pss() {
  local m; m=$(adb shell dumpsys meminfo "$PKG")
  local total gfx native java
  total=$(echo "$m" | grep -m1 -oE 'TOTAL PSS: *[0-9]+' | grep -oE '[0-9]+$')
  gfx=$(echo "$m" | grep -m1 -E '^ *Graphics:' | grep -oE '[0-9]+' | head -1)
  native=$(echo "$m" | grep -m1 -E '^ *Native Heap:' | grep -oE '[0-9]+' | head -1)
  java=$(echo "$m" | grep -m1 -E '^ *Java Heap:' | grep -oE '[0-9]+' | head -1)
  log "MEM $1: total PSS $((total / 1024)) MB (native $((native / 1024)), java $((java / 1024)), graphics $((gfx / 1024)))"
}

perf_run() {
  local ok=0 i t s r d
  # Seed the big history once (fresh start), then let it save.
  adb shell pm clear "$PKG" >/dev/null
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 25
  run_flows seed nav >/dev/null 2>&1 || true
  # 1. Cold start x5: process start -> Today on screen (JS mark), and Android's own TotalTime.
  : >"$RES/cold.txt"; : >"$RES/total.txt"
  for i in 1 2 3 4 5; do
    adb shell am force-stop "$PKG"; sleep 2; adb logcat -c
    r=$(adb shell am start -W -n "$PKG/.MainActivity" | grep -oE 'TotalTime: [0-9]+' | grep -oE '[0-9]+')
    for _ in $(seq 30); do adb logcat -d -v epoch >"$RES/lc.txt"; grep -q '\[perf\] today-ready' "$RES/lc.txt" && break; sleep 1; done
    s=$(start_ms "$RES/lc.txt"); t=$(mark "$RES/lc.txt" today-ready)
    [ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) >>"$RES/cold.txt"; [ -n "$r" ] && echo "$r" >>"$RES/total.txt"
    log "cold start $i: Today ready $([ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) || echo '?') ms, Android TotalTime ${r:-?} ms"
  done
  log "PERF cold start (avg of 5): Today ready $(avg <"$RES/cold.txt") ms, Android TotalTime $(avg <"$RES/total.txt") ms"
  adb shell am force-stop "$PKG"; sleep 2
  pss_after_start() { adb shell am start -W -n "$PKG/.MainActivity" >/dev/null; sleep 12; pss "Today after a cold start"; }
  pss_after_start
  # 2. Opening a workout x3 (each a fresh start with the big history): tap -> screen, tap -> first video frame.
  : >"$RES/open.txt"; : >"$RES/frame.txt"
  for i in 1 2 3; do
    adb logcat -c
    run_flows perf perf/open || ok=1
    adb logcat -d -v epoch >"$RES/lc.txt"
    s=$(mark "$RES/lc.txt" tap-start); t=$(mark "$RES/lc.txt" workout-ready "$s"); d=$(mark "$RES/lc.txt" video-frame "$s")
    [ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) >>"$RES/open.txt"
    [ -n "$s" ] && [ -n "$d" ] && echo $((d - s)) >>"$RES/frame.txt"
    log "open workout $i: screen $([ -n "$t" ] && echo $((t - s)) || echo '?') ms, first video frame $([ -n "$d" ] && echo $((d - s)) || echo 'none') ms"
  done
  log "PERF open workout (avg of 3): screen $(avg <"$RES/open.txt") ms, first video frame $(avg <"$RES/frame.txt") ms"
  sleep 5; pss "workout, page 1"
  # 3. Every page with Next, then back with Previous: page change -> its video's first frame.
  adb logcat -c
  run_flows perf perf/pages || ok=1
  pss "workout, after Next through all 7 pages"
  run_flows perf perf/back || ok=1
  pss "workout, after Previous back to page 1"
  adb logcat -d -v epoch >"$RES/lc.txt"
  grep -oE '\[perf\] (page-[0-9]+|video-frame) [0-9]+' "$RES/lc.txt" | awk '
    $2 ~ /^page-/ {p=$2; t=$3; next}
    $2=="video-frame" && p!="" {print p, $3-t; p=""}' >"$RES/pages.txt"
  log "page change -> video frame (ms): $(tr '\n' ' ' <"$RES/pages.txt")"
  log "PERF page change -> video frame (avg of $(wc -l <"$RES/pages.txt") with video): $(awk '{print $2}' "$RES/pages.txt" | avg) ms"
  log "video players created: $(grep -c 'ExoPlayerImpl: Init' "$RES/lc.txt"), released: $(grep -c 'ExoPlayerImpl: Release' "$RES/lc.txt")"
  # 4. Progress with ~900 days of history x3 (fresh process each time): tap -> screen ready.
  : >"$RES/prog.txt"
  for i in 1 2 3; do
    adb shell am force-stop "$PKG"; sleep 2; adb logcat -c
    run_flows perf perf/progress || ok=1
    adb logcat -d -v epoch >"$RES/lc.txt"
    s=$(mark "$RES/lc.txt" tap-progress); t=$(mark "$RES/lc.txt" progress-ready "$s")
    [ -n "$s" ] && [ -n "$t" ] && echo $((t - s)) >>"$RES/prog.txt"
    log "open Progress $i: $([ -n "$t" ] && echo $((t - s)) || echo '?') ms"
  done
  log "PERF open Progress with ~900 days of history (avg of 3): $(avg <"$RES/prog.txt") ms"
  sleep 5; pss "Progress with ~900 days of history"
  return $ok
}
