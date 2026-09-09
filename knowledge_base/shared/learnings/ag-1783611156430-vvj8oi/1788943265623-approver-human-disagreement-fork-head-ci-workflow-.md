---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788872622870-yz0khj
written_at: 2026-09-09T08:41:05.623Z
---

# [approver/human-disagreement] Fork-head CI-workflow-only PR by trusted MEMBER merged unchanged at the abstain commit — by-design ABSTAIN, not a miss

**Symptom.** shader-slang/slang#12940 (`ci: fix nightly Sascha test by looking up build artifact by name`) was decided ABSTAIN_POLICY on two revisions (0403b70, then 0fa2224 after a `synchronize`). Both times the deterministic Step-1 clauses failed on `head_provenance` + `no_protected_paths`. The PR then **merged, unchanged, at exactly the second decision commit 0fa2224** (merged_by=jvepsalainen-nv, a MEMBER). So the human verdict = APPROVED-equivalent while the approver ABSTAINed.

**Why this is NOT a false-safe or a scored disagreement.** A false-safe is WOULD_APPROVE where the human requested changes. Here the decision was ABSTAIN_POLICY — "a human must look" — which asserts nothing about the code and is EXCLUDED from agreement scoring. The human looked and merged. The routing was correct.

**Root cause of the abstain (two independent policy fails, both real):**
- `head_provenance` — the PR head is on a fork (`jvepsalainen-nv/slang`, `isCrossRepository:true`). Under the empty/v0-shadow policy mount, any fork head fails. (Mount artifact.)
- `no_protected_paths` — the only changed file is `.github/workflows/nightly-slang-sascha-test.yml`, matching BOTH `.github/**` and `**/*.yml`. This is a GENUINE policy fail that survives even a proper mount: a CI-workflow-file change can alter CI/secrets/permissions and must have a human look.

**Transferable lesson (sharpens Step-0 recall).** A trusted-MEMBER PR whose entire diff is a `.github/workflows/*.yml` CI-plumbing fix is a recurring shape that merges cleanly after human review. Repeated ABSTAINs on this shape are the system working as intended, not a calibration problem — do not treat the accumulating abstain rate on fork-head/protected-path PRs as a miss to optimize away. This extends the same "CI-only `.github/**` PRs are un-scoreable under v0-shadow" class seen in #12888 (same-repo CI-only, merged) and #12898 (fork `.github/` doc). New wrinkle here: the fork-head + workflow-YAML combination, merged at the exact abstain commit with zero follow-up commits.

**Mechanics note.** The `record_decision` tool doc states the human outcome is joined automatically by the host from GitHub; no `record_human_verdict` tool is exposed to the approver. On a `pr_merged` event, the approver's job is the calibration learning, not a verdict-write call.
