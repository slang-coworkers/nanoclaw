---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787860914077-yt0yyq
written_at: 2026-08-28T02:19:49.296Z
---

# [approver/confirmed-safe] RequiredLoweringPassSet gate-batch PRs (#11917 epic) merge unchanged when the four source probes + producer trace are clean

## Outcome
shader-slang/slang **#12336** ("Gate four backend passes on RequiredLoweringPassSet flags", #11917 epic) — decided **WOULD_APPROVE** @ `3c70e106a72e`, **merged unchanged** by jkwak-work at that exact commit (squash `227c519`), **zero interval commits** between decision and merge. Clean agreement. Devin-only fallback tier (harvest exit 20 — bot-authored `fix/issue-N` branch, production review skips as expected).

## Transferable signal (sharpens Step-0 recall for the #11917 gate-batch)
This is the recurring shape of the #11917 epic (#11920/#11961/#11987/#12088 precedents): a batch PR adds N booleans to `RequiredLoweringPassSet` and gates N unconditional backend passes in `linkAndOptimizeIR` on them. Failure direction = silent always-skip = **miscompile** (or a missing diagnostic for a diagnostic-bearing pass), which byte-identical codegen + green CI **cannot** see. So the verdict must rest on source verification, NOT CI/revert-drills.

The four standing probes + a stale-FALSE producer trace were sufficient and the PR merged unchanged when ALL held:
1. **No dead flag** — every new flag has a real setter in `calcRequiredLoweringPassSet` AND a gate read.
2. **Scan order** — the governing scan runs before the gated work; for this epic there are TWO accumulating scans (reset before scan#1 only; flags accumulate to scan#2). Each gate reads a scan that precedes it.
3. **Jobs, not passes** — read each gated pass body; a second unconditional job needs its own flag term (here `lowerUntaggedUnionTypes`'s `replaceNoneTypeElementWithVoidType` → correctly covered by adding `NoneTypeElement` to the untaggedUnion arm).
4. **Trigger-present control** — a diagnostic-bearing gate (`assumeAddress`) needs a concrete test whose assertion fails if the pass skips (`tests/diagnostics/get-address-validation-gpu.slang`); tag/union gates covered by pre-existing dynamic-dispatch/interfaces suites.
5. **Stale-FALSE trace** — every producer of the gated opcodes must run before the governing scan, EXCEPT a downstream producer covered by an implication (here `lowerTaggedUnionTypes`, covered by `taggedUnion`→(untaggedUnion,tagOps,tagType)). Subtlety worth remembering: a pass may TRANSIENTLY construct a gated opcode after the scan and immediately delete it within its own already-enabled pass (`getNoneTypeElement()` in `replaceNoneTypeElementWithVoidType`) — that's harmless; the precise invariant is "the only post-scan producer that LEAVES a gated opcode for a LATER gated pass."

## Note on this epic's PRs being bot-authored
These land on `nv-slang-bot[bot]` `fix/issue-N` branches → harvest exit 20 (no production review) is EXPECTED, not an abstain. Decide from Devin + your own source trace. Human approvals on these often predate a large rebase (the merged head's `committedDate` postdates the review's `submittedAt`) → the re-pointed APPROVED is weak corroboration only, never the basis. (Rebase-repoint probe already in the store: `1785939783049`.)
