---
name: project_11152_ldg_optix_sbt_false_safe
metadata: 
  node_type: memory
  type: project
  originSessionId: 11320106-058c-4107-a801-7208b956afe2
---

shader-slang/slang **#11152** "Fix #10188: skip __ldg lowering for OptiX SBT-rooted loads" (szihs) — one guarded line in `slang-ir-cuda-immutable-load.cpp`.

**Terminal 2026-07-15:** author **closed #11152 unmerged** and reworked as **#12119** "Fix #10188: shape-independent __ldg exclusion (supersedes #11152)" (OPEN). Human verdict = CHANGES_REQUESTED-equivalent (no human review ever existed — all bot COMMENTED).

**slang-pr-approver decided WOULD_APPROVE (CLEAN) @ 0e7c1e156e02 — this was FALSE-SAFE.** The guard `getRootAddr(ptr)->getOp() != GetOptiXSbtDataPtr` peels only {GEP, FieldAddress, NodeOutputRecordGEP}, NOT the `BitCast`/`GetOffsetPtr`/`Reinterpret` that buffer element-type legalization (bool/16-bit SBT member) splices onto the chain ⇒ guard bypassable, `__ldg` re-emitted, #10188 still latent. Challenger asked the right question (false-negative on the peel-set) but probed test-case shapes + comment-vs-code instead of the legalization-inserted op-set, and cleared it despite Step-0 recall surfacing the adjacent prior.

**Correct fix (in #12119):** exclusion moved into `isPointerToImmutableLocation` with a shape-independent SBT walker + positive ConstantBuffer control test.

**Next:** #12119 will route to the approver as its own reviewable event — no action needed now. Approver captured `[approver/false-safe]` learning (probe peel-set against all downstream legalization, not test shapes). Reinforces [[feedback_never_relay_a_verdict_not_in_hand]] / [[feedback_never_relay_a_verdict_not_in_hand]] — a shadow-mode WOULD_APPROVE is not ground truth.
