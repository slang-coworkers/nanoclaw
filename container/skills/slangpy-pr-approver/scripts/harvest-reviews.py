#!/usr/bin/env python3
"""Harvest an already-posted bot review for one PR — the approver's review input.

Step 1b of the (live-only) slang-pr-approve workflow. The approver no longer
dispatches a reviewer coworker; instead it reuses the review that production CI
already posted on the PR. This script fetches the PR's reviews (read-only gh),
picks the newest bot review whose `commit_id` equals the pinned commit, and
hands its body back for the workflow to synthesize into review/review-doc.md.

Primary source: `github-actions[bot]` — the production `claude-pr-review.yml`
(anthropics/claude-code-action) review. Its body already carries the 🔴/🟡/🔵
severity markers, a `Findings (N total)` table, a `**Verdict**: …` line, and a
footer `reviewed: <sha> · diff sha256 <hash>` — exactly what the approver's
Step 2 parser and eval-clauses.py consume. Secondary: `coderabbitai[bot]`
(the only signal on slangpy). Our own `nv-slang-bot[bot]` echoes are skipped.

Input:  --repo owner/name  --pr N  --commit <pinned sha>  --out <workspace>
Output: <workspace>/review/harvest.json
  {"found": bool, "login": "...", "commit_id": "...", "submitted_at": "...",
   "diff_hash": "..." | null, "stale": bool, "body": "...",
   "pending_bot": "CodeRabbit" | "<check-run name>" | null}
  (`pending_bot` is set only on exit 22 — the bot whose review we're waiting on.)

Exit codes (let the workflow branch):
  0  — harvested a bot review matching the pinned commit (fresh)
  10 — only STALE bot reviews exist (newest bot review's commit_id != pinned) —
       the workflow falls to Devin-only, noting the stale review
  20 — no harvestable bot review at all AND no review bot is still working — a
       genuine production-skip (fixer fix/issue-N PRs, bot-authored PRs, Claude's
       own branches). The workflow falls to Devin-only.
  22 — no bot review YET, but a review bot is still running (CodeRabbit status
       `pending` on slangpy, or a Claude/review check-run `queued`/`in_progress`
       on slang). This is a TIMING RACE on a fresh PR, NOT a skip — the review is
       imminent. The workflow WAITS and re-harvests; falling to Devin-only here
       discards the primary signal (root cause of the slang#12064 harvest_used=0
       miss). `harvest.json` carries `pending_bot` so the caller knows what to
       poll.
  21 — the reviews fetch itself FAILED (gh error / rate-limit / network) — the
       PR may carry a real review we couldn't see, so the workflow treats this
       as an infra signal (ABSTAIN_POLICY:NO_REVIEW_SIGNAL), never a clean Devin-only decision
   2 — usage / no context

stdlib + gh only.
"""
import argparse, json, os, re, subprocess, sys

# Bot reviewers we trust to harvest, most-authoritative first. github-actions is
# the production claude-code-action review; coderabbit is the secondary source
# (and the only one on slangpy). Our own reviewer's posts are excluded so we
# never harvest an echo of ourselves.
PRIMARY = "github-actions[bot]"
SECONDARY = "coderabbitai[bot]"
HARVEST_LOGINS = (PRIMARY, SECONDARY)
SKIP_LOGINS = ("nv-slang-bot[bot]",)

# Footer emitted by the production review: `reviewed: <sha> · diff sha256 <hash>`.
FOOTER_RE = re.compile(r"diff\s+sha256\s+([0-9a-f]{8,64})", re.IGNORECASE)


def gh_json(path, paginate=False):
    """One read-only gh api call -> parsed JSON, or raise."""
    args = ["gh", "api", path]
    if paginate:
        args += ["--paginate", "--slurp"]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("gh api %s failed: %s" % (path, r.stderr[:200]))
    out = json.loads(r.stdout)
    if paginate:  # --slurp wraps each page in a list; flatten
        merged = []
        for page in out:
            merged.extend(page if isinstance(page, list) else [page])
        return merged
    return out


def parse_diff_hash(body):
    """The sha256 the production review footer records, or None."""
    m = FOOTER_RE.search(body or "")
    return m.group(1) if m else None


# A review bot is "still working" when its signal is present but not settled.
# On slangpy CodeRabbit reports via a *commit status* context (`CodeRabbit`,
# pending -> success); on slang the Claude/production review reports via a
# *check-run* (queued/in_progress -> completed). Either, at the pinned head,
# means a review is imminent and exit 20 would be a false "skip". Matched
# loosely by name so a context rename ("CodeRabbit" -> "coderabbit review")
# doesn't silently regress us back to racing.
PENDING_STATUS_RE = re.compile(r"coderabbit|claude|review", re.IGNORECASE)


def pending_review_bot(repo, commit):
    """Return the name of a review bot still working at `commit`, else None.

    Read-only; never raises — a lookup failure just means "no pending signal I
    can prove", so the caller falls through to the genuine-skip path (exit 20)
    rather than hanging. Checks both surfaces because the two repos differ:
      - commit status contexts (CodeRabbit on slangpy) with state `pending`
      - check-runs (Claude/review on slang) with status queued/in_progress
    """
    # Commit-status contexts (CodeRabbit's surface).
    try:
        st = gh_json(f"repos/{repo}/commits/{commit}/status")
        for s in st.get("statuses", []):
            ctx = s.get("context") or ""
            if s.get("state") == "pending" and PENDING_STATUS_RE.search(ctx):
                return ctx
    except Exception:
        pass
    # Check-runs (Claude/production-review's surface).
    try:
        cr = gh_json(f"repos/{repo}/commits/{commit}/check-runs")
        for c in cr.get("check_runs", []):
            name = c.get("name") or ""
            if c.get("status") in ("queued", "in_progress") and PENDING_STATUS_RE.search(name):
                return name
    except Exception:
        pass
    return None


def harvest(repo, pr, commit):
    """Return (result_dict, exit_code). Never raises: a genuinely empty PR is
    exit 20, a fetch failure exit 21, a match exit 0, stale-only exit 10."""
    try:
        reviews = gh_json(f"repos/{repo}/pulls/{pr}/reviews", paginate=True)
    except Exception as e:
        # A fetch failure is NOT "no review" — a real review (possibly
        # REQUEST_CHANGES) may exist behind the error. Distinct code 21 so the
        # workflow routes to ABSTAIN_POLICY:NO_REVIEW_SIGNAL instead of a clean Devin-only pass.
        return ({"found": False, "fetch_error": str(e)[:200]}, 21)

    # Keep only trusted bot reviews with a real body; drop echoes + empties.
    cand = []
    for rv in reviews:
        login = ((rv.get("user") or {}).get("login") or "")
        if login in SKIP_LOGINS or login not in HARVEST_LOGINS:
            continue
        if rv.get("state") == "DISMISSED":
            continue
        if not (rv.get("body") or "").strip():
            continue
        cand.append(rv)

    if not cand:
        # No harvestable bot review right now. Distinguish a genuine
        # production-skip (exit 20, fall to Devin-only) from a fresh-PR TIMING
        # RACE where a review bot is still working (exit 22, the caller waits
        # and re-harvests). Racing to Devin-only here is what made slang#12064
        # discard its primary review (harvest_used=0).
        pending = pending_review_bot(repo, commit)
        if pending:
            return ({"found": False, "pending_bot": pending}, 22)
        return ({"found": False}, 20)

    # Newest first (submitted_at is ISO-8601, lexicographically sortable).
    cand.sort(key=lambda rv: rv.get("submitted_at") or "", reverse=True)

    # A review matching the pinned commit, preferring the primary source and
    # the most recent. `matching` inherits `cand`'s newest-first order, so
    # min() over the HARVEST_LOGINS index (github-actions=0 < coderabbit=1)
    # returns the newest review from the lowest-index (primary) source present.
    def login_rank(rv):
        return HARVEST_LOGINS.index((rv.get("user") or {}).get("login") or "")

    matching = [rv for rv in cand if rv.get("commit_id") == commit]
    if matching:
        best = min(matching, key=login_rank)
        body = best.get("body") or ""
        # "stale" here means a NEWER bot review exists at a different commit —
        # informational; the fresh match is still authoritative.
        newest_commit = cand[0].get("commit_id")
        return ({
            "found": True,
            "login": (best.get("user") or {}).get("login"),
            "commit_id": best.get("commit_id"),
            "submitted_at": best.get("submitted_at"),
            "diff_hash": parse_diff_hash(body),
            "stale": newest_commit != commit,
            "body": body,
        }, 0)

    # No review at the pinned commit, but bot reviews exist at other commits →
    # STALE-only. Report the newest so the workflow can note it, then fall to
    # Devin-only (Devin is always head-current).
    newest = cand[0]
    body = newest.get("body") or ""
    return ({
        "found": False,
        "stale": True,
        "login": (newest.get("user") or {}).get("login"),
        "commit_id": newest.get("commit_id"),
        "submitted_at": newest.get("submitted_at"),
        "diff_hash": parse_diff_hash(body),
        "body": body,
    }, 10)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True, help="owner/name")
    ap.add_argument("--pr", required=True, type=int)
    ap.add_argument("--commit", required=True, help="the pinned commit sha")
    ap.add_argument("--out", required=True, help="per-PR workspace dir")
    a = ap.parse_args()

    result, code = harvest(a.repo, a.pr, a.commit)

    out_dir = os.path.join(a.out, "review")
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, "harvest.json")
    json.dump(result, open(dest, "w"), indent=1)

    if code == 0:
        print(f"harvested {result['login']} review @ {result['commit_id'][:12]} "
              f"(diff_hash={result.get('diff_hash') or 'none'}) -> {dest}")
    elif code == 10:
        print(f"STALE ONLY: newest bot review is {result.get('login')} @ "
              f"{(result.get('commit_id') or '?')[:12]} != pinned "
              f"{a.commit[:12]} -> Devin-only (noted stale)")
    elif code == 22:
        print(f"REVIEW PENDING for {a.repo}#{a.pr} @ {a.commit[:12]}: "
              f"{result.get('pending_bot')} still running -> WAIT + re-harvest "
              f"(timing race, NOT a skip)")
    elif code == 21:
        print(f"FETCH FAILED for {a.repo}#{a.pr} -> ABSTAIN_POLICY:NO_REVIEW_SIGNAL "
              f"({result.get('fetch_error')})")
    else:
        print(f"no harvestable bot review for {a.repo}#{a.pr} -> Devin-only")
    sys.exit(code)


if __name__ == "__main__":
    main()
