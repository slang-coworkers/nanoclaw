---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787680235407-uo2zbl
written_at: 2026-08-31T16:30:52.589Z
---

# [approver/infra-abstain] Same PR can flip WOULD_APPROVE→ABSTAIN across sessions when the group policy mount goes missing (v0-shadow-wide → bundled v0-shadow)

**Symptom.** slang PR #12754: R1/R2 (Aug 25) recorded WOULD_APPROVE with
`policy_version: v0-shadow-wide` (all clauses pass). R3 (Aug 31, a trivial
maintainer-requested CMake branch reorder) recorded ABSTAIN_POLICY —
`author_trust` FAIL (nv-slang-bot = CONTRIBUTOR) and `no_protected_paths` FAIL
(`**/CMakeLists.txt`). The PR got functionally *cleaner*, yet the decision
flipped to abstain.

**Root cause.** `eval-clauses.py` resolves the policy in this order: `--policy`
→ `<ws>/policy/APPROVAL_POLICY.json` → group mount
`/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled default. On
R1/R2 the group mount held the relaxed `v0-shadow-wide` (CONTRIBUTOR trusted;
CMakeLists.txt not protected). In the later session that mount directory was
EMPTY, so it fell through to the bundled conservative `v0-shadow`
(trusted = OWNER/MEMBER/COLLABORATOR only; `**/CMakeLists.txt`, `.github/**`,
`cmake/**`, `**/*.yml` protected). Same PR, different effective policy.

**How to catch it.** Check `policy_version` in clauses.json on EVERY revision and
compare it to prior revisions of the same PR. If it changed, the environment —
not the code — moved. A bot/CONTRIBUTOR PR touching a build file (`CMakeLists.txt`,
`*.yml`, `cmake/**`) will PASS under a wide mounted policy and ABSTAIN under the
bundled default; the flip is entirely policy-driven.

**Fix / classification.** A missing mounted policy is the *documented, designed*
graceful degradation to the conservative default — so it is `CLAUSE_FAIL`
(policy family), NOT an infra reason code (do not burn the infra gate for it).
Do NOT reach around policy resolution to reproduce the earlier WOULD_APPROVE —
decide under the policy that actually resolves. But DO flag the discrepancy to
the human/admin (mount may have regressed unintentionally): note that R2 was
WOULD_APPROVE under v0-shadow-wide and restoring that mount would clear the
eligibility fails (though the challenger+critique would still have to run — a
Step-1 clause FAIL early-returns before them, so an abstain is NOT a completed
would-approve determination). Also: `ci_green_on_sha` reads the legacy 2-status
combined-status API, which can report `success` while a check-run
(`build-windows-debug-cl-aarch64`) has FAILED — never restate that clause as
"CI green"; cite the actual per-platform check-runs.
