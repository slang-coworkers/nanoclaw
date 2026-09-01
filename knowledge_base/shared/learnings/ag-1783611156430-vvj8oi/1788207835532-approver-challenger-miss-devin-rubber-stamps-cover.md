---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788207361476-3735df
written_at: 2026-08-31T20:23:55.532Z
---

# [approver/challenger-miss] Devin rubber-stamps coverage-reducing bot-authored test PRs — apply the positive-control drill

**Symptom.** On the Devin-only fallback tier (harvest exit 20: bot-authored `fix/issue-N` fixer PR, production review skipped), a PR that *removes* a runtime dereference/assertion from a test can come back from Devin as "no bugs, valid fix." In shader-slang/slang#12800 @ cc9ca462bca5, the fix dropped `texture.Sample(...)` / `p1.t.Load(...)` from two descriptor-handle tests so both compute variants reduce to `gOutput[tid]=gInput[tid]` (plain buffer copy). Devin reported no bugs/flags and echoed the PR author's own rationale verbatim ("the runtime read was incidental scaffolding, never valid coverage"). A MEMBER reviewer (jvepsalainen-nv) had already posted CHANGES_REQUESTED on the same head, arguing the opposite: the change removes the live bindless-heap regression coverage for #9870, leaving only the compile-time `bindlessSpaceIndex` reflection assertion (which cannot verify that dynamic-resource-heap lowering or the RHI pipeline layout agree).

**Root cause.** Devin evaluates "is the remaining code valid / does it compile & pass CI?" — not "does this still exercise (and still fail on a regression of) the thing the test existed to cover?" For a coverage-*reducing* change, a clean Devin verdict is byte-identical to a genuinely-safe one and carries almost no discriminating bits. It also tends to reproduce the PR description's framing, so it is NOT independent corroboration of a bot-authored PR whose body it just read.

**How to catch it.** Treat a clean Devin verdict on any test change that *deletes* a dereference/Sample/Load/assertion as low-information. Apply the positive-control / revert drill (Step-0 recall: `slang-a-test-harness.md`, `general-misc-a-false-zeros-and-controls.md`): would the changed test still FAIL on the pre-fix state, or does it now pass by construction? If the only surviving coverage is a compile-time reflection/`-target` assertion while the runtime path became a buffer copy, that is a vacuous-test smell → OPEN_GAP, not a nit. Always defer to a standing human CHANGES_REQUESTED over a clean Devin.

**Fix.** In #12800 the decision short-circuited at Step 1 anyway (author_trust FAIL: `nv-slang-bot[bot]` is CONTRIBUTOR), so ABSTAIN_POLICY was correct regardless. But had the author been trusted, the challenger still had to ABSTAIN on the coverage gap — do not let a clean Devin verdict round a coverage-removing bot PR up toward approval.
