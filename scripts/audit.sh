#!/usr/bin/env bash
# SoulBound static audit (chain-neutral / frozen-contract / persona-clip / no-plaintext).
# Safe to run before AND after Task 1: missing apps/ or supabase/ => SKIP, not fail.
set -uo pipefail
fail=0

have() { command -v "$1" >/dev/null 2>&1; }
GREP() {
  if have rg; then
    rg --glob '!**/.next/**' --glob '!**/dist/**' --glob '!**/node_modules/**' "$@"
  else
    grep -rEn --exclude-dir=.next --exclude-dir=dist --exclude-dir=node_modules "$@"
  fi
}

# fail_if_match LABEL PATTERN PATH...
fail_if_match() {
  local label="$1"; shift
  local pat="$1"; shift
  local present=0
  for p in "$@"; do [ -e "$p" ] && present=1; done
  if [ "$present" -eq 0 ]; then
    echo "SKIP: $label (경로 없음: $*)"; return
  fi
  if GREP -i "$pat" "$@" >/dev/null 2>&1; then
    echo "FAIL: $label"
    GREP -i "$pat" "$@" 2>/dev/null | head -5
    fail=1
  else
    echo "OK:   $label"
  fi
}

echo "== SoulBound audit =="

# --- frozen core protections ---
fail_if_match "FROZEN no skip/todo in core"        '\.skip\(|\.todo\('                       packages/core/src
fail_if_match "FROZEN no free-text reason field"   'reason[[:space:]]*[:?][[:space:]]*string' packages/core/src

# --- chain-neutral (code only; docs may mention chains historically) ---
fail_if_match "chain-neutral: no concrete-chain SDK in code" '@mysten|aleo|aztec|zcash' packages apps
fail_if_match "chain-neutral: no 'sui' literal in core src"  '\bsui\b'                  packages/core/src

# --- no direct infra in UI ---
fail_if_match "no supabase import in core"          '@supabase'        packages/core/src
fail_if_match "persona clip: no supabase.storage in apps" 'supabase\.storage' apps
fail_if_match "no direct supabase client in components"   'createClient'      apps/web/components 2>/dev/null

# --- no plaintext / raw-key columns (precise; conversation_key_envelopes/wrapped_key are LEGIT) ---
fail_if_match "no plaintext/raw-key columns" \
  '\b(plaintext|body_plain|content_plain|decryption_key|raw_key|plain_key|conversation_key_plain|conversation_key_raw)\b' \
  supabase/migrations

# --- no chat/messages routes in app ---
fail_if_match "no chat/messages routes" 'app/(api/)?(messages|chat|inbox|conversations)' apps/web/app 2>/dev/null

# --- no COMMIT/ROLLBACK inside rpc migrations (INV-23) ---
fail_if_match "no COMMIT/ROLLBACK in rpc migrations" '\b(commit|rollback)\b' supabase/migrations

if [ "$fail" -ne 0 ]; then
  echo ""; echo "AUDIT FAILED"; exit 1
fi
echo ""; echo "AUDIT PASSED"
