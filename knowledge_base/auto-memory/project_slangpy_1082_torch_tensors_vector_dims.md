---
name: project_slangpy_1082_torch_tensors_vector_dims
description: "slangpy#1082 \"Torch tensors supply vector dims\" (ccummingsNV) — approver ABSTAIN_POLICY:OPEN_GAP, CI red from data-submodule bump"
metadata: 
  node_type: memory
  type: project
  originSessionId: 09f29e54-940d-48a2-8888-f39e3e1c4323
---

slangpy PR #1082 "Torch tensors supply vector dims" by ccummingsNV.

**MERGED @ `c4ae890` (2026-07-31 13:23 UTC by ccummingsNV). CHAIN TERMINAL.** Progression: R1 OPEN_GAP → R2/R3 CHALLENGER_CONCERN → R4 OPEN_GAP → merged.

**RE-REVIEW R4 (2026-07-31, head `c4ae890`, synchronize):** ABSTAIN_POLICY, reason_code OPEN_GAP. This push did NOT touch `torch_bridge_impl.cpp` (byte-identical, line 126 unchanged) — it was "Fixes / cleanup for tensor issues" adding a **new diff-pair cache-signature path** in `slangpy.cpp` + 4 tests. Head-current Devin came back **0 🔴** (buffer concern demoted to informational) → R2/R3 asymmetry cap gone, approver was heading to APPROVE. But codex DECISION_REVIEW caught a real **OPEN_GAP**: new diff-pair signature keys on the **primal** tensor only (`slangpy.cpp:1122`; `torchtensormarshall.py:298-301`) — grad dtype/shape neither in key nor validated to match primal → matching-primal/differing-grad pairs could collide (the **#1052/#1056 under-keying class**), untested. Must-fix on derivation ⇒ revise-or-abstain ⇒ abstained. CI green 12/12. **Author then MERGED** — APPROVED-equivalent human verdict recorded as calibration join. **Milder mismatch (approver abstained where human approved — NOT false-safe).** Post-merge check: grad is always `zeros_like(primal)` or upstream `grad_output`, both tracking primal dtype/shape by construction/torch-invariant → flagged gap very likely inconsequential in practice (domain knowledge author had). Approver captured as learning.

**RE-REVIEW R3 (2026-07-31, head `a0e174d`, synchronize):** ABSTAIN_POLICY, reason_code CHALLENGER_CONCERN — **same disposition, converged**. This push = merge of `main` (upstream #1083 + #1075 + merge commit); does NOT touch `torch_bridge_impl.cpp` or buffer-contract path (byte-identical), so head-current Devin 🔴 @line 126 recurs unchanged. **Devin ITSELF demoted the 🔴 to informational this run** ("buffer contract is stricter than actually required"). Approver again refuted as FP. CI green 12/12 (clean merge). Held PURELY by no-upgrade-over-🔴 procedural rule. Clears via: (a) maintainer confirms buffer-contract/high-rank handling + approves, OR (b) author tweaks `torch_bridge_impl.cpp` so line 126 stops flagging. A `main` merge alone won't change outcome. **3 consecutive re-reviews now converge on this hold — merits approvable, only a human moves it.**

**RE-REVIEW R2 (2026-07-31, head `3a266be`, synchronize):** ABSTAIN_POLICY, reason_code CHALLENGER_CONCERN. **Prior CI blocker FIXED** — new commit "Restore data submodule" reverts `data` `6ecdf7c`→`4c24c797` (=base main), restoring both bc7 DDS fixtures; **CI now GREEN 12/12**. Net PR diff vs prior head = only that one submodule file; all torch code byte-identical. Held ONLY by procedure's no-upgrade-over-🔴 rule: head-current Devin raised a 🔴 at `torch_bridge_impl.cpp:126` (native buffer pre-check "rejects high-dim tensors"), which approver **refuted as false positive** (unreachable on both prod call sites: torch rank ≤ 64, both pass 128-byte buffer = 64+max-rank). On the merits **very close to approvable** — needs maintainer to confirm native buffer-contract/high-rank handling is fine, then approve. Fallback tier (no github-actions[bot] review; CodeRabbit stale/pinned to old commit; decided from head-current Devin). Nothing posted to GitHub. Critique-gated (codex DECISION_REVIEW caught first-draft over-reach to approve → corrected to abstain).

**PRIOR verdict (2026-07-30, head `c27e1bfc9a1e`):** ABSTAIN_POLICY, reason_code OPEN_GAP. Fallback tier — no production github-actions[bot] review existed; decided from CodeRabbit + clean Devin run (0 bugs). Critique-gated (DECISION_REVIEW + OUTPUT_REVIEW) → codex approved after 1 must-fix. Nothing posted to GitHub.

**Root of abstain (NOT a code bug):** CI red on 6/12 build jobs, attributable to the PR itself. The `data` submodule bump `4c24c797`→`6ecdf7c` ("Updated bc1 reference data") **removed** `test_images/dds/bc7-unorm-nonsquare.dds` and `bc7-unorm-3d.dds` → unchanged `tests/sgl/core/test_dds_file.cpp` throws "No such file" on fresh-checkout jobs. `ci_green_on_sha` clause only "passed" because shadow policy sets `require_ci_green=false`; CI is in fact red.

**Next-action (maintainer/human):** confirm the data-submodule bump is intentional/complete — restore the two bc7 fixtures OR update/remove the dependent DDS tests — then CI greens and PR is re-evaluable on next push.

**Open nit (non-decision-moving):** CodeRabbit 🟠 buffer-contract finding — exposed public get_signature fn-ptr ABI doesn't enforce documented min buffer size in the Python fallback. Both current in-tree callers are safe (torch max rank=64, both pass 128-byte buffer). Worth a maintainer nit, not a blocker.

**GitHub posting:** NOT authorized (automated pr_ready webhook, no mention/post-auth). Approver never posts. Surfaced to operator dashboard instead. RESUME on next push to the PR (re-review) or operator instruction to post the CI diagnosis.
