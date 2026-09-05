---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788503476880-yv8daz
written_at: 2026-09-04T09:04:10.346Z
---

# [approver/human-disagreement] CONFIRMED-correct: ABSTAIN_POLICY (external/** + oversize) on a trusted-author slang-rhi-integration PR → human APPROVED at the same commit and merged

**Case:** shader-slang/slangpy#1140 "Add opacity micromap support" (skallweitNV, MEMBER). My decision on the merged head `284645d8ffb0` was **ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths** (external/slang-rhi gitlink bump + 1304 lines > 400 cap). Terminal human outcome: **MERGED** (09:01:53Z, self-merged by the author) with an explicit human review **tdavidovicNV (MEMBER) APPROVED at `284645d8ffb0`** — my exact decision commit. CodeRabbit only COMMENTED, at the older commit.

**Is this a disagreement?** No — and that's the point worth recording. An ABSTAIN is a non-assertion ("a human must look"), so merged/approved does NOT make it a false-safe (that label is reserved for WOULD_APPROVE where the human requested changes). This is the abstain loop working exactly as designed: the approver cannot see inside the `external/slang-rhi` submodule where the real OMM implementation lives, so it correctly routed to a human, and a second MEMBER reviewer approved. Recording it under human-disagreement only because the join will show decision≠APPROVE; it is a CONFIRMED-correct routing, not an error. Abstains are excluded from approve/block agreement scoring, so this does not dent accuracy.

**Transferable calibration signal (sharpens Step-0 recall):** PRs of this *shape* are a recurring, cleanly-mergeable class:
- trusted author (MEMBER/OWNER/COLLABORATOR), same-repo head;
- bumps `external/slang-rhi` to integrate a matching upstream RHI feature (the correctness-bearing code is in the submodule, invisible to the slangpy diff — CodeRabbit even excludes `external/**`);
- adds a large but mechanical native + nanobind binding surface (src/sgl/device/*, src/slangpy_ext/device/*), pushing well over the 400-line v0-shadow cap;
- ships a genuine *present-path* behavioral test that builds the real object and asserts observable output (here `test_opacity_micromap_trace` → `[1,2,1,2,1,2]`), gated by `has_feature(...) + pytest.skip`.
This class will ALWAYS ABSTAIN under v0-shadow (both `no_protected_paths` via `external/**` and `tier_eligible`), and humans routinely APPROVE + merge them. That is correct conservative behavior in shadow mode — do NOT loosen the clauses on this evidence alone (needs human sign-off). But if this class keeps accumulating abstain→approve joins, it is the strongest candidate for a future *narrower* tier (e.g. trusted-author `external/slang-rhi`-only bump + green required CI at head + a present-path test present ⇒ a tighter eligibility path), decided by a human, not self-adopted.

**Efficiency confirmation:** the fast-pre-gate approach (run `eval-clauses.py` first, skip the ~6-min CodeRabbit poll + Devin when Step-1 hard-fails) cost nothing here — the human outcome depended only on the submodule contents I could never have inspected, so no amount of extra review-signal gathering would have changed the ABSTAIN. Reinforces the earlier `[approver/process]` learning.
