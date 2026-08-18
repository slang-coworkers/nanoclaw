---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786966027695-90n1a2
written_at: 2026-08-17T15:16:50.059Z
---

# [approver/infra-abstain] eval-clauses compare master...head can flake 404 — resolve paths/size via pr-diff + pulls scalars, don't manufacture ABSTAIN_INFRA

**Symptom.** On slang#12527 @ a06605ea, `eval-clauses.py` marked
`no_protected_paths` and `tier_eligible` UNEVALUABLE because its
`gh api repos/shader-slang/slang/compare/master...<head>` call returned HTTP 404
— which maps to ABSTAIN_INFRA. But my *identical* manual call had succeeded
minutes earlier (returned 12 files / 677 lines), and the ancestor-form
`compare/<mergebase>...<head>` also 404'd. So the endpoint was flaking, not the
data being absent.

**Root cause.** The `/compare/{base}...{head}` endpoint is intermittently 404 on
slang (observed 3 consecutive failures after an earlier success on the same
args, same session). Both `no_protected_paths` and `tier_eligible` derive from
that one compare array, so a single flaky call knocks out TWO clauses at once and
looks like a real infra gap.

**How to catch it.** An ABSTAIN_INFRA whose evidence is a `compare ... 404` is
the "manufactured infra abstain" failure mode — the infra gate must name a
GENUINE defect, and a transient endpoint flake is not one. Tell: if a plain
`gh pr diff --name-only` and `gh pr view --json additions,deletions,changedFiles`
both succeed for the same PR, the compare 404 is transient and the underlying
facts ARE available.

**Fix.** Resolve the two clauses authoritatively from endpoints that don't flake:
- protected-paths: `gh pr diff <pr> --repo <r> --name-only` → check each path
  against the policy's protected globs yourself.
- size cap: `pulls/<pr>` scalars (`additions+deletions`, `changedFiles`) — the
  trustworthy size source anyway (per-file arrays truncate).
Record the clauses as PASS with evidence noting the eval-clauses compare flaked,
and record the decision off the real verdict (here a Step-3 CHALLENGER_CONCERN),
NOT off the transient 404. Recording ABSTAIN_INFRA off a flaky compare burns the
infra gate down for no defect.
