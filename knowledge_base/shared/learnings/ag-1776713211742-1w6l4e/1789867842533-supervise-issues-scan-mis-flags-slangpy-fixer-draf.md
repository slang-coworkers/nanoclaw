---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-20T01:30:42.533Z
---

# supervise-issues scan mis-flags slangpy-fixer draft-PR chains as awaiting_us (branch + Fixes-regex blind spot)

# Symptom

Tick 234 (2026-09-20) nudged slangpy#1171 and slangpy#1173 as `awaiting_us` / "no PR, no resumable artifact". Both were false positives: each already had a complete, peer-reviewed **draft PR** (#1172 fixes #1171; #1174 fixes #1173), CI green/done on our side, a link comment on the issue, and `report_pr_created` called. The correct state was `awaiting_human` (maintainer promotion+merge), not `awaiting_us`.

# Root cause — two independent PR-resolution misses in `scripts/pull-universe.sh`

The slangpy-fixer names its branches `dev/slangpy-fixer/<issue>` (e.g. `dev/slangpy-fixer/1171`, `dev/slangpy-fixer/slangpy-1173`) and writes the **fully-qualified** closing keyword `Fixes shader-slang/slangpy#<n>` in the PR body. Both of pull-universe's resolution paths assume the *slang* fixer's conventions:

1. **Branch-convention match** (pull-universe.sh ~lines 418-419 and 540-541):
   `head == f"fix/issue-{issue}" or head.startswith(f"fix/issue-{issue}-")` — `dev/slangpy-fixer/*` never matches, so the cross-referenced PR is discarded.
2. **`Fixes` regex fallback** (line 547):
   `re.search(r"(?:Fixes|Closes|Resolves)\s+#(\d+)", body, re.IGNORECASE)` requires a **bare** `#N` immediately after the keyword. `Fixes shader-slang/slangpy#1171` has `shader-slang/slangpy` between `Fixes ` and `#`, so it does not match.

With both paths failing, the chain resolves to `pr: None` → scan classifies it under the fixer-owned no-PR carve-out → `awaiting_us` → nudge. slang chains are unaffected (they use `fix/issue-<n>`), so this is slangpy-specific and systematic: *every* slangpy-fixer draft-PR chain is mis-flagged, and the board reports them wrong to the operator each tick.

# Fix (for scan/pull-universe maintainer)

Broaden both resolvers, don't special-case one project:
- Branch match: also accept `dev/<fixer-folder>/<issue>` and `dev/<fixer-folder>/<repo>-<issue>` shapes (or, better, stop keying on branch name and trust the PR→issue link).
- `Fixes` regex: accept the fully-qualified form — e.g. `(?:Fixes|Closes|Resolves)\s+(?:[\w.-]+/[\w.-]+)?#(\d+)`.
- Best: prefer GitHub's own `closingIssuesReferences` (GraphQL) which already links draft PRs regardless of branch name or body spelling, and fall back to the regex only when that is empty.

# Supervisor workaround until patched

- A slangpy chain flagged `awaiting_us`/no-artifact is **suspect** — verify live with `gh pr list --repo shader-slang/slangpy --search "in:body Fixes #<n>"` or check the issue's cross-referenced timeline before trusting the nudge premise.
- The nudges themselves aren't harmful (they prompt the fixer to reconcile), but the **board delivered to the operator is wrong** on those rows. Correct it when a fixer reconciles, and note the blind spot so counts aren't taken at face value.
