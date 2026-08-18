---
title: "CONSOLIDATED: dev↔prod duplicate PRs are an intentional A/B test"
type: learning
topic: misc
source: learnings/1780558152382-CONSOLIDATED-dev-prod-ab-pr-conventions.md
---

# CONSOLIDATED: dev↔prod duplicate PRs are an intentional A/B test

*Authoritative (operator-confirmed 2026-06-04). Supersedes any "isolate to one writer / dedupe the duplicate PRs" guidance — that framing is WRONG.*

## The setup
Two NanoClaw instances run the slang pipeline against the SAME live `shader-slang/slang` issues, both as `nv-slang-bot[bot]`. The operator wants BOTH, as a deliberate **A/B comparison** — do not "fix" it.
- **dev (this instance)** opens PRs on **`fix/issue-<N>`** branches.
- **prod** opens PRs on **`dev/slang-fixer/<...>`** branches.
- Both PRs stay open so the operator can compare the two instances' fixes.

## Rules
1. **Never classify dev↔prod dup pairs as DEGRADED / a problem.** Do not close, consolidate, or escalate them for cleanup. In status reports, label **A = prod (`dev/slang-fixer/*`), B = ours/dev (`fix/issue-*`)**.
2. **ALL `nv-slang-bot[bot]`-authored PRs are ours to manage** — including `dev/trelby/*` branches (operator-confirmed). Provenance = the bot author + branch namespace.
3. **Keep the instances separate.** This dev instance pushes ONLY to its own `fix/issue-*` PRs — NEVER push commits onto a prod `dev/slang-fixer/*` PR. Cross-pushing contaminates the A/B data point. Before any "open PR" or "push onto PR #N" task, confirm the target branch is `fix/issue-*`; if it's `dev/slang-fixer/*`, STOP — that's prod's lane.
4. **`report_pr_created` handles webhook round-trip routing** (writes `pr_session_mappings`). Do NOT borrow the webhook-routing `dev/<coworker-folder>/` branch convention for fixer PR *branch names* — that's a different mechanism and using it breaks A/B separation.

## Accepted exceptions (history)
- **#11398** (#11375/#11402 consolidation): dev pushed commits onto prod's PR — a one-time contamination, **operator-ACCEPTED, no unwind**; #11375/#11402 is a known compromised A/B point.
- **#11422** (#11410): dev opened on `dev/slang-fixer/issue-11410` (should've been `fix/issue-11410`) — contamination left open because closing/reopening would churn a PR maintainers were evaluating. Branch hygiene revisited only after maintainer eval resolves.

These "accepted-for-now" cases were about avoiding destructive churn on PRs under maintainer review — not because the mismatch was harmless.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1780558152382-CONSOLIDATED-dev-prod-ab-pr-conventions.md`_
