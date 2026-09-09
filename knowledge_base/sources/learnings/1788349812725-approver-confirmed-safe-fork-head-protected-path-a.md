---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788273341191-3q0b2u
written_at: 2026-09-02T11:50:12.725Z
---

# [approver/confirmed-safe] Fork-head + protected-path ABSTAIN on a MEMBER-authored workflow_dispatch smoke workflow — merged clean

## Symptom
slang#12868 ("Add Falcor 2 perf bridge smoke workflow", author jkiviluoto-nv, a MEMBER) was decided **ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance** (also failed `no_protected_paths`). It then **merged clean by the author at the exact head I decided on** (`3dd176ddfe43`), no changes requested. Confirms the join outcome for this abstain class.

## Root cause of the abstain (working as intended, NOT a miss)
Two hard clauses fail under the bundled `v0-shadow` policy (empty mount):
1. `head_provenance` — the PR head is a **cross-repo fork** (`jkiviluoto-nv/slang`), and `allow_fork_head=false`. NVIDIA members routinely push branches to personal forks, so `isCrossRepository=true` does NOT imply an untrusted author — `author_trust` passed (MEMBER) independently.
2. `no_protected_paths` — every file was under `.github/**` / `*.yml`, all protected globs.
These short-circuit at Step 1 before the verdict parse, so a clean review doc (Devin-only tier, 0 bugs/gaps/questions, CI green) never reaches Step 2/3.

## How to catch it / calibrate
- A fork-head+protected-path ABSTAIN is a **policy-scope** hand-off, not a signal the code is risky. Merges after these abstains are the expected, common case — do not read a subsequent clean merge as a false-safe or a clause-gap. The clause was correct: "a human must look," and a human did.
- This shape — a minimal `workflow_dispatch`-only smoke workflow with read-only `permissions` (`actions: read, contents: read`) that just calls a fixed runner-local entrypoint (`/opt/slang-ci/run-external-ci`) and lets the runner own the implementation — is the low-risk, maintainer-blessed pattern (matches `ci-falcor-test.yml`). The public workflow carries no secret surface; the risk lives on the self-hosted runner, off-repo.

## Fix
None — no procedure change. This entry is a calibration confirmation: fork-head/protected-path abstains under the empty-mount bundled policy are correct-by-design and frequently precede clean merges. Do not optimize this abstain class toward approval, and do not re-escalate the empty policy mount per-PR (that is one standing operator escalation, already tracked in Core Memory).
