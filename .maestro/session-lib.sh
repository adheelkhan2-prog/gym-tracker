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

