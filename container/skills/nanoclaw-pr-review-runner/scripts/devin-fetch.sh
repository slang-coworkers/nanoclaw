#!/usr/bin/env bash
# Fetch Devin Review's analysis for a GitHub PR via agent-browser.
# Output: <out>/devin-flags.md (extracted flag titles + Devin's narrative)
#
# Usage:
#   devin-fetch.sh --url <devin-review-url> --out <run-dir> [--poll-seconds 45] [--max-minutes 20]
#
# Returns 0 on success, 2 on auth-wall, 3 on timeout, 4 on browser-launch-failure
# (transient infra — stale Chrome profile lock; retry later), 1 on any other error.
# The workflow treats failure (2/3/4) as best-effort.

set -euo pipefail

URL=""
OUT=""
POLL=45
MAX_MIN=20

while (($#)); do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --poll-seconds) POLL="$2"; shift 2 ;;
    --max-minutes) MAX_MIN="$2"; shift 2 ;;
    *) echo "error: unknown flag $1" >&2; exit 1 ;;
  esac
done

[ -n "$URL" ] || { echo "error: --url required" >&2; exit 1; }
[ -n "$OUT" ] || { echo "error: --out required" >&2; exit 1; }
mkdir -p "$OUT"

# Normalize URL. Accept either a GitHub PR URL
# (https://github.com/<owner>/<repo>/pull/<n>) or an already-Devin URL
# (https://app.devin.ai/review/<owner>/<repo>/pull/<n>). If the input is GitHub,
# rewrite to the Devin review form so agent-browser opens the right page.
if [[ "$URL" =~ ^https?://github\.com/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
  OWNER="${BASH_REMATCH[1]}"
  REPO="${BASH_REMATCH[2]}"
  PR_NUM="${BASH_REMATCH[3]}"
  URL="https://app.devin.ai/review/${OWNER}/${REPO}/pull/${PR_NUM}"
  echo ">>> devin-fetch: rewrote GitHub URL → ${URL}"
fi

# Launch the page — with a one-shot retry on transient Chrome-launch failure.
# Chrome launches fine in this container WITHOUT a dbus session bus; a
# "no DevToolsActivePort / no dbus" error is NOT a deterministic environment
# failure. The real cause is TRANSIENT: a stale Chrome profile under
# /tmp/agent-browser-* left holding SingletonLock or a half-written
# DevToolsActivePort by a prior crash. agent-browser relaunches cleanly on the
# next `open` once the stale profile is cleared, so on failure we close the
# daemon, clear the profile dirs, and retry ONCE. A failure that survives the
# retry is infra-transient (retry later) — exits 4. The `if err=$(...)` idiom
# keeps `set -e` from killing us on a nonzero `open`.
LAUNCH_FAIL_RE='failed to launch chrome|chrome launch task failed|without writing DevToolsActivePort|SingletonLock'
open_page() {
  local url="$1" err rc
  if err="$(agent-browser open "$url" 2>&1 >/dev/null)"; then rc=0; else rc=$?; fi
  if [ "$rc" -ne 0 ] || printf '%s' "$err" | grep -qiE "$LAUNCH_FAIL_RE"; then
    echo ">>> devin-fetch: Chrome launch failed (transient) — clearing stale profile, retrying once" >&2
    printf '%s\n' "$err" >&2
    agent-browser close --all >/dev/null 2>&1 || true
    rm -rf /tmp/agent-browser-chrome-* /tmp/agent-browser-profile-* 2>/dev/null || true
    sleep 2
    if err="$(agent-browser open "$url" 2>&1 >/dev/null)"; then rc=0; else rc=$?; fi
    if [ "$rc" -ne 0 ] || printf '%s' "$err" | grep -qiE "$LAUNCH_FAIL_RE"; then
      { echo "browser-launch-failure: Chrome failed to launch after profile reset + retry."
        echo "TRANSIENT infra condition (retry later) — NOT a deterministic environment failure, NOT auth-wall, NOT timeout."
        printf '%s\n' "$err"; } > "$OUT/devin-error.txt"
      echo ">>> devin-fetch: browser launch failed after retry — exit 4 (transient, retry later)" >&2
      exit 4
    fi
  fi
}
open_page "$URL"
sleep 5

# Detect auth wall before polling. Use a tight regex that targets phrases unique
# to an auth-walled state (login modal / banner) — NOT a generic "sign in"
# substring, which fires false-positive on Devin's navbar "Sign in" link even
# when the page is otherwise loading content normally. The `i` flag in JS regex
# is case-insensitive; `\b` ensures whole-word match.
if agent-browser eval 'const t=document.body.innerText; /\b(log in to (?:view|access)|sign in to (?:view|access)|authentication required|please (?:log|sign) in to (?:view|access|continue))\b/i.test(t)' 2>/dev/null | grep -qi true; then
  echo "auth-wall: Devin requires login for this PR" > "$OUT/devin-error.txt"
  exit 2
fi

# Poll until analysis is done. Devin's UI does NOT render a literal
# "Analysis complete" string when finished — the in-progress state shows
# "PR analysis in progress" and the done state shows the "Devin's AI
# analysis" heading plus a flags summary ("N Flags", "1 Flag", or "No
# flags") and/or the checks panel ("All checks passed"/"checks failed").
# Treat absence-of-progress + presence-of-result as "done".
DONE_EXPR='(() => {
  const t = document.body.innerText;
  // Still-streaming guard (DO NOT REGRESS): a half-rendered panel shows a
  // "Generating…"/"Generating..." placeholder and echoes the PR description
  // back, with a flags summary ("No flags") possibly already visible. That is
  // NOT a completed verdict — never treat it as done. See knowledge_base
  // learnings on devin-fetch premature exit-0.
  if (/Generating\s*(\.{2,}|…)/i.test(t)) return false;
  // Positive done-signals: the AI-analysis heading AND a flags/checks summary.
  //
  // The checks-panel alternative must require a SETTLED rail (passed === total).
  // A partial counter like "Checks 12/22" means CI is still running, which says
  // nothing about whether the review verdict has rendered — the verdict can
  // still be behind an unclicked "View results". Accepting a partial counter as
  // a done-signal is what produced the exit-0 false-cleans (observed on
  // slang-rhi#815 at "Checks 12/22"; see the knowledge_base learnings on
  // devin-fetch premature exit-0). Requiring equality keeps the July-10 fix
  // that this alternative exists for — a settled "Checks 22/22" rail on a page
  // whose "All checks passed" banner has not yet rendered still counts as done,
  // so the false 30-min timeouts do not come back.
  const heading = /Devin.s AI analysis/i.test(t);
  const checksSettled = (() => {
    const m = t.match(/Checks\s*(\d+)\s*\/\s*(\d+)/i);
    return !!m && m[1] === m[2];
  })();
  const summary = /\b\d+\s+Flags?\b/.test(t) || /\bNo flags\b/i.test(t) || /All checks passed/i.test(t) || /checks? failed/i.test(t) || checksSettled;
  const done = heading && summary;
  // "PR analysis in progress" can LINGER transiently on a page that is otherwise
  // fully rendered. Only let it veto when the positive done-signals are ABSENT —
  // a transient in-progress substring must not block a clearly-complete page
  // (which caused false timeouts). A genuine re-analysis keeps `done` false and
  // correctly keeps polling.
  if (/PR analysis in progress/i.test(t) && !done) return false;
  return done;
})()'

# Poll until DONE holds across TWO consecutive checks — a single positive poll
# can catch a page mid-transition; a second confirming poll ensures the done
# state is stable before we scrape. Costs ~one extra POLL interval on success.
deadline=$(( $(date +%s) + MAX_MIN*60 ))
stable=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  if agent-browser eval "$DONE_EXPR" 2>/dev/null | grep -qi true; then
    stable=$((stable + 1))
    [ "$stable" -ge 2 ] && break
  else
    stable=0
  fi
  sleep "$POLL"
done

# Confirm a stable done state (else timeout)
if [ "$stable" -lt 2 ]; then
  echo "timeout: Devin did not reach a stable done state within ${MAX_MIN}m" > "$OUT/devin-error.txt"
  exit 3
fi

# Reveal the verdict if it is still collapsed. Devin can render the
# "Devin's AI analysis" heading with the findings themselves behind a
# "View results" button; scraping at that point captures the surrounding page
# (PR description, CI rail) and yields an empty Flags section that reads as a
# clean pass. Click it first, and give the panel a moment to render.
if agent-browser eval '(() => {
  const btn = Array.from(document.querySelectorAll("button, a")).find(
    (b) => /^view results$/i.test((b.textContent || "").trim())
  );
  if (btn) { btn.click(); return true; }
  return false;
})()' 2>/dev/null | grep -qi true; then
  echo ">>> devin-fetch: clicked 'View results' to reveal the verdict" >&2
  sleep 3
fi

# Expand the Flags panel. The button text is "<N> Flags" / "1 Flag" /
# "No flags", so a literal "Flags" find-text match misses the count
# prefix. Click the matching toggle directly.
agent-browser eval '(() => {
  const btn = Array.from(document.querySelectorAll("button")).find(
    (b) => /^(\d+\s+Flags?|No flags)$/i.test((b.textContent || "").trim())
  );
  if (btn) { btn.click(); return true; }
  return false;
})()' >/dev/null 2>&1 || true
sleep 2

# Extract narrative + flags
agent-browser eval 'document.body.innerText' 2>/dev/null > "$OUT/devin-page.txt"
agent-browser screenshot "$OUT/devin-screenshot.png" 2>/dev/null || true

# Build a clean markdown extract: AI analysis + flag list
python3 - "$OUT/devin-page.txt" > "$OUT/devin-flags.md" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
# Heuristic: AI analysis = paragraph(s) before the Flags section
parts = re.split(r'\n\s*\d+\s*Flags?\s*\n', text, maxsplit=1)
analysis = parts[0].strip() if parts else text.strip()
flags = parts[1].strip() if len(parts) > 1 else ''
print('# Devin Review\n')
print('## AI Analysis\n')
print(analysis[:5000])
print('\n## Flags\n')
print(flags[:5000])
PY

# Body-integrity guard: require a terminal status AND a non-trivial body before
# declaring success. A reachable page can pass the DONE poll with the panel
# still streaming ("Generating…") — the AI-Analysis body is then just the PR
# description echoed back with Bugs/Flags "(none reported)", which reads like a
# clean pass but is an *incomplete* analysis. Also guard against a truly empty
# scrape. Either case → inconclusive (exit 3, best-effort skip), never a silent
# exit-0 "clean" that folds a half-rendered page into the verdict.
if grep -qE 'Generating[[:space:]]*(\.{2,}|…)' "$OUT/devin-flags.md" 2>/dev/null; then
  echo "inconclusive: Devin analysis still generating at scrape time" > "$OUT/devin-error.txt"
  echo ">>> devin-fetch: still generating at scrape time — inconclusive (exit 3)" >&2
  exit 3
fi
ANALYSIS_BYTES=$(wc -c < "$OUT/devin-flags.md" 2>/dev/null | tr -d ' ')
: "${ANALYSIS_BYTES:=0}"
if [ "$ANALYSIS_BYTES" -lt "${DEVIN_MIN_BYTES:-200}" ]; then
  echo "inconclusive: Devin analysis body too short (${ANALYSIS_BYTES}B)" > "$OUT/devin-error.txt"
  echo ">>> devin-fetch: body too short (${ANALYSIS_BYTES}B) — inconclusive (exit 3)" >&2
  exit 3
fi

echo ">>> devin-fetch: ${OUT}/devin-flags.md ($(wc -l < "$OUT/devin-flags.md") lines)"
