#!/usr/bin/env bash
# collect-reviews.sh — deterministic, single-pass collection of the bot reviews
# already posted on a PR, for the slang-pr-approver decision.
#
# WHY THIS EXISTS. The approver used to call harvest-reviews.py *inline, every
# turn*, so on a long re-decided session the same bot bodies were re-read 30-56x
# and re-injected into context. With the host CI-gate the approver is woken ONCE
# per settled+green head — so it collects everything up front, once, here. Same
# trusted-bot selection and exit-code contract as harvest-reviews.py (the
# workflow branches identically), but it collects BOTH the primary (Claude) and
# secondary (CodeRabbit) review bodies plus CodeRabbit's summary comment in one
# pass, and still writes review/harvest.json in harvest-reviews.py's schema so
# the existing synthesis step is unchanged.
#
# Read-only: gh api only. Never writes to GitHub.
#
# Usage:
#   collect-reviews.sh --repo owner/name --pr N --commit <pinned sha> --out <ws> [--dry-run]
#
# Output (unless --dry-run), under <out>/review/:
#   harvest.json         — chosen primary/pinned review, harvest-reviews.py schema (drop-in).
#   claude-review.md     — github-actions[bot] body (if any).
#   coderabbit-review.md — coderabbitai[bot] review body + summary comment (if any).
#   collect.json         — index of what was collected + resolved exit code.
#
# --dry-run: print what WOULD be collected + the resolved exit code; write NOTHING.
#
# Exit codes (mirror harvest-reviews.py so the workflow branches the same):
#   0  fresh bot review matching the pinned commit collected
#   10 only STALE bot reviews (newest at a different commit) -> Devin-only
#   20 no harvestable bot review AND none pending -> genuine skip, Devin-only
#   22 no review yet but a review bot is still running -> WAIT + re-run (timing race)
#   21 reviews fetch FAILED (gh/rate-limit/network) -> ABSTAIN_POLICY:NO_REVIEW_SIGNAL
#   2  usage / no context
set -uo pipefail

REPO="" PR="" COMMIT="" OUT="" DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)    REPO="${2:-}"; shift 2 ;;
    --pr)      PR="${2:-}"; shift 2 ;;
    --commit)  COMMIT="${2:-}"; shift 2 ;;
    --out)     OUT="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    *) echo "collect-reviews.sh: unknown arg '$1'" >&2; exit 2 ;;
  esac
done
if [ -z "$REPO" ] || [ -z "$PR" ] || [ -z "$COMMIT" ] || { [ "$DRY" -eq 0 ] && [ -z "$OUT" ]; }; then
  echo "usage: collect-reviews.sh --repo owner/name --pr N --commit <sha> --out <ws> [--dry-run]" >&2
  exit 2
fi

# Fetch the read-only inputs into temp files (review bodies can be large — env
# vars blow ARG_MAX). A non-zero rc on the reviews call is recorded distinctly
# so a fetch failure becomes exit 21, not a false "no review".
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# Bare --paginate concatenates per-page arrays as `][` (not valid JSON across
# >1 page); the Python pass normalizes `][` -> `,` before parsing. --slurp would
# be cleaner but isn't in older gh (2.46), so we stay version-agnostic.
gh api "repos/$REPO/pulls/$PR/reviews" --paginate >"$TMP/reviews.json" 2>/dev/null; echo $? >"$TMP/reviews.rc"
gh api "repos/$REPO/commits/$COMMIT/status" >"$TMP/status.json" 2>/dev/null || true
gh api "repos/$REPO/commits/$COMMIT/check-runs" >"$TMP/checkruns.json" 2>/dev/null || true
gh api "repos/$REPO/issues/$PR/comments" --paginate >"$TMP/comments.json" 2>/dev/null || true

# All JSON logic in one deterministic Python pass. Small scalars go via env; the
# large gh payloads are read from $TMP files (paths in env). It writes artifacts
# itself (unless dry) so paths stay in one place, and exits with the harvest tier
# code (0/10/20/21/22) — this script's exit status directly.
CR_REPO="$REPO" CR_PR="$PR" CR_COMMIT="$COMMIT" CR_OUT="$OUT" CR_DRY="$DRY" CR_TMP="$TMP" \
python3 <<'PY'
import os, json, re

repo = os.environ["CR_REPO"]; pr = os.environ["CR_PR"]; commit = os.environ["CR_COMMIT"]
out = os.environ.get("CR_OUT", ""); dry = os.environ.get("CR_DRY") == "1"
tmp = os.environ["CR_TMP"]

def readf(name):
    try:
        return open(os.path.join(tmp, name)).read()
    except Exception:
        return ""

reviews_rc = int((readf("reviews.rc") or "0").strip() or "0")
reviews_s = readf("reviews.json"); status_s = readf("status.json")
checkruns_s = readf("checkruns.json"); comments_s = readf("comments.json")

PRIMARY = "github-actions[bot]"      # production claude-code-action review
SECONDARY = "coderabbitai[bot]"      # secondary (only signal on slangpy)
SKIP = "nv-slang-bot[bot]"           # our own reviewer — never harvest an echo
HARVEST = (PRIMARY, SECONDARY)
PENDING_RE = re.compile(r"coderabbit|claude|review", re.I)
FOOTER_RE = re.compile(r"diff\s+sha256\s+([0-9a-f]{8,64})", re.I)

def loadj(s):
    s = s.strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None

def paginated_list(s):
    """Bare `gh api --paginate` concatenates per-page arrays as `][`. Normalize
    that to `,` so multi-page output parses as one flat list. Returns None on
    parse failure (caller treats as fetch fail), [] for an empty/blank body."""
    s = s.strip()
    if not s:
        return []
    v = loadj(s)
    if v is None:
        v = loadj(s.replace("][", ","))  # stitch concatenated pages
    if v is None:
        return None
    return v if isinstance(v, list) else [v]

def diff_hash(body):
    m = FOOTER_RE.search(body or "")
    return m.group(1) if m else None

def finish(code):
    raise SystemExit(code)

# --- fetch failure on the reviews call => infra, never a clean skip -----------
reviews = paginated_list(reviews_s)
if reviews_rc != 0 or reviews is None:
    if dry:
        print(f"DRY: reviews fetch FAILED for {repo}#{pr} -> exit 21 (ABSTAIN_POLICY:NO_REVIEW_SIGNAL)")
    else:
        os.makedirs(os.path.join(out, "review"), exist_ok=True)
        json.dump({"found": False, "fetch_error": "reviews fetch failed"},
                  open(os.path.join(out, "review", "harvest.json"), "w"), indent=1)
    finish(21)

# --- candidate trusted bot reviews, newest first ------------------------------
cand = []
for rv in reviews:
    login = ((rv.get("user") or {}).get("login") or "")
    if login == SKIP or login not in HARVEST:
        continue
    if rv.get("state") == "DISMISSED":
        continue
    if not (rv.get("body") or "").strip():
        continue
    cand.append(rv)
cand.sort(key=lambda r: r.get("submitted_at") or "", reverse=True)

# CodeRabbit summary issue-comment (carries "Actionable comments posted: N").
cr_summary = None
comments = paginated_list(comments_s) or []
for c in comments:
    if ((c.get("user") or {}).get("login") or "") != SECONDARY:
        continue
    b = c.get("body") or ""
    if "summarize by coderabbit" in b.lower() or "Actionable comments posted" in b:
        cr_summary = b  # last wins => newest summary

def pending_bot():
    st = loadj(status_s)
    if isinstance(st, dict):
        for s in st.get("statuses", []):
            if s.get("state") == "pending" and PENDING_RE.search(s.get("context") or ""):
                return s.get("context")
    cr = loadj(checkruns_s)
    if isinstance(cr, dict):
        for c in cr.get("check_runs", []):
            if c.get("status") in ("queued", "in_progress") and PENDING_RE.search(c.get("name") or ""):
                return c.get("name")
    return None

# --- no candidates: distinguish pending (22) from genuine skip (20) -----------
if not cand:
    pend = pending_bot()
    if dry:
        if pend:
            print(f"DRY: no review yet, '{pend}' still running for {repo}#{pr} @ {commit[:12]} -> exit 22 (WAIT)")
        else:
            print(f"DRY: no harvestable bot review for {repo}#{pr}, none pending -> exit 20 (Devin-only)")
        finish(22 if pend else 20)
    os.makedirs(os.path.join(out, "review"), exist_ok=True)
    payload = {"found": False, "pending_bot": pend} if pend else {"found": False}
    json.dump(payload, open(os.path.join(out, "review", "harvest.json"), "w"), indent=1)
    finish(22 if pend else 20)

def newest_of(login):
    for rv in cand:
        if ((rv.get("user") or {}).get("login") or "") == login:
            return rv
    return None

primary = newest_of(PRIMARY)
secondary = newest_of(SECONDARY)
newest_commit = cand[0].get("commit_id")

# Pinned-commit match, primary-preferred (cand is newest-first).
matching = [rv for rv in cand if rv.get("commit_id") == commit]
def rank(rv):
    return HARVEST.index(((rv.get("user") or {}).get("login") or ""))
match = min(matching, key=rank) if matching else None

# --- resolve exit + harvest.json payload (harvest-reviews.py schema) ----------
if match:
    body = match.get("body") or ""
    harvest = {"found": True, "login": (match.get("user") or {}).get("login"),
               "commit_id": match.get("commit_id"), "submitted_at": match.get("submitted_at"),
               "diff_hash": diff_hash(body), "stale": newest_commit != commit, "body": body}
    code = 0
else:
    n = cand[0]  # stale-only: newest bot review at a different commit
    body = n.get("body") or ""
    harvest = {"found": False, "stale": True, "login": (n.get("user") or {}).get("login"),
               "commit_id": n.get("commit_id"), "submitted_at": n.get("submitted_at"),
               "diff_hash": diff_hash(body), "body": body}
    code = 10

if dry:
    def line(label, rv):
        if not rv:
            print(f"  {label}: (none)"); return
        b = rv.get("body") or ""
        cid = rv.get("commit_id") or ""
        m = "MATCH" if cid == commit else "different"
        print(f"  {label}: login={(rv.get('user') or {}).get('login')} commit={cid[:12]}({m}) "
              f"bytes={len(b)} diff_hash={diff_hash(b) or 'none'}")
    print(f"DRY collect {repo}#{pr} @ {commit[:12]}:")
    line("claude    ", primary)
    line("coderabbit", secondary)
    print(f"  coderabbit-summary: {'found (%d bytes)' % len(cr_summary) if cr_summary else '(none)'}")
    print(f"-> exit {code} ({'fresh match' if code == 0 else 'stale only, newest @ %s' % (newest_commit or '?')[:12]})")
    finish(code)

# --- write artifacts ----------------------------------------------------------
rd = os.path.join(out, "review")
os.makedirs(rd, exist_ok=True)
if primary:
    open(os.path.join(rd, "claude-review.md"), "w").write(primary.get("body") or "")
if secondary or cr_summary:
    parts = []
    if secondary:
        parts.append("## CodeRabbit review\n\n" + (secondary.get("body") or ""))
    if cr_summary:
        parts.append("## CodeRabbit summary comment\n\n" + cr_summary)
    open(os.path.join(rd, "coderabbit-review.md"), "w").write("\n\n".join(parts))
json.dump(harvest, open(os.path.join(rd, "harvest.json"), "w"), indent=1)
json.dump({"repo": repo, "pr": int(pr), "commit": commit, "exit": code,
           "claude_collected": bool(primary), "coderabbit_collected": bool(secondary),
           "coderabbit_summary_collected": bool(cr_summary)},
          open(os.path.join(rd, "collect.json"), "w"), indent=1)
print(f"collected {repo}#{pr} @ {commit[:12]}: "
      f"claude={'y' if primary else 'n'} coderabbit={'y' if secondary else 'n'} "
      f"summary={'y' if cr_summary else 'n'} -> {rd}")
finish(code)
PY
# The Python pass exits with the harvest tier code (0/10/20/21/22); it IS our
# exit status, so the workflow branches on the same contract as harvest-reviews.py.
exit $?
