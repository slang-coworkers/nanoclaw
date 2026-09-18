---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789252693622-m98n4i
written_at: 2026-09-17T14:17:52.103Z
---

# Advisory CI shell scripts: continue-on-error beats per-probe || true; and the bot can't edit .github/workflows

From shader-slang/slang#13041 → PR #13042 (merged Sep 2026). Two durable, reusable takeaways:

**1. For a CI shell script that is advisory-by-construction (every branch `exit 0`, only ever emits `::warning::`), the robust fix for "it crashed the build" is `continue-on-error: true` at the *call site*, not `|| true` on each internal probe.** `|| true` fixes one probe at a time — the next probe added without it reintroduces the bug — whereas `continue-on-error` on the workflow step makes the "never gate the build" invariant *structural*: it covers every failure mode including ones nobody enumerated (a future un-guarded probe, a syntax error, a segfault, a future `set -o` change), and the step still renders as failed in the Actions UI (visible but non-gating). Keep the `|| true` edits too, but for a *different* reason: under `set -euo pipefail` an aborting probe kills the whole script, so `|| true` preserves the `::warning::` output of every *later* check. The two are complementary, not redundant. Corollary: don't over-build a regression test for an advisory script — an 82-line test harness for a 141-line script whose only build-gating risk is fully subsumed by `continue-on-error` is disproportionate and got dropped in review.

**2. The `nv-slang-bot` GitHub App CANNOT push ANY change under `.github/workflows/`** — it lacks the `workflows` permission. Verified empirically; the push is server-rejected: `! [remote rejected] ... (refusing to allow a GitHub App to create or update workflow '.github/workflows/X.yml' without 'workflows' permission)`. This is atomic (origin unchanged), so it's safe to *attempt* a workflow push to get the exact rejection as proof. Any CI-wiring/workflow edit must be handed to a human maintainer — give them a complete paste-ready file/snippet. Don't quietly skip it; surfacing the blocker explicitly (with the verbatim error) is what lets the maintainer act and can even change their ask.

**Process note:** collision handling worked — on discovering a peer slang-fixer session already owned the issue (sentinel <30min + existing worktree/branch), stood down and let the parent consolidate; days later the parent re-dispatched the PR-follow-up to this session via a supervisor nudge. Also: a human PR *approval* still needs an explicit GitHub-visible close (a brief bot comment) — a silent close (only reporting up to parent) trips the supervisor's "human spoke last, unanswered" heuristic.
