---
title: "[approver/challenger] verify a codegen fix by aligning with pre-existing siblings + before/after byte-identity"
type: learning
topic: review-approval
source: learnings/1784446552079-approver-challenger-verify-a-codegen-fix-by-aligni.md
---

# [approver/challenger] verify a codegen fix by aligning with pre-existing siblings + before/after byte-identity

**Context:** slang#12142 changed MSL RayQuery accessor-name emission in `hlsl.meta.slang`: moved the `get_`/`is_` prefix out of a table's infix array (`kCandidateCommittedMetal` → `candidate_`/`committed_`) and re-added it per call site (literal `get_` for matrix accessors; a `metalPrefix` derived from `strcmp(method.type,"bool")` for the property table, so only the one bool query `TriangleFrontFace` gets `is_`). Deepwiki was imprecise on the exact MSL runtime naming (conflated Slang-side names) — per skill, that neither blocks nor upgrades.

**Technique that gave high-confidence correctness WITHOUT running the compiler** (useful when the target can't be executed locally):
1. **Find the pre-existing hand-written sibling as ground truth.** The same file already had hand-written accessors at `hlsl.meta.slang:21842/21863` emitting `is_candidate/committed_triangle_front_facing()`. The fix makes the *table-generated* accessor match those — the naming convention is corroborated by two independent in-repo locations, stronger than any external doc.
2. **Before/after byte-identity algebra.** Prove the change is a no-op for everything except the intended target: matrix `get_`+`candidate_` == old `get_candidate_`; property `get_`+`candidate_`+`id` == old `get_candidate_id`. Only `TriangleFrontFace` changes `get_`→`is_`. This bounds the blast radius to exactly the fixed case.
3. **Role-change completeness grep.** When a shared variable's meaning changes (array now holds infix only, callers must prepend), grep every use (`ccNameMetal` → 3 sites: 22138/22162/22208) and confirm ALL were updated. A missed site would emit the broken form.
4. **Blast radius on the test corpus.** Enumerate which existing tests target the changed backend. Here the git tree showed the ONLY `-target metal` ray-query test was the new one; other ray-query tests target DX12/VK/GLSL/SPIRV/HLSL, none with a Metal FileCheck leg → no pre-existing test asserts the old broken name (the slang#12130 "untouched Metal test breaks" risk does not materialize).
5. **Meta-block buildability.** New host-C++ in a `${...}` block (`strcmp`) — confirm the construct is already used in the same file (`:27412` `strcmp(dynamicKind,"Sampler")`) so the core-module bootstrap compiles even though CI didn't run.

**Payoff:** this established the code is correct, which is why the abstain was OPEN_GAP ("human must run CI") and NOT a BLOCK. The technique separates "is the code right?" (yes, by inspection) from "has it been validated?" (no) — two different axes that drive different reason_codes.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784446552079-approver-challenger-verify-a-codegen-fix-by-aligni.md`_
