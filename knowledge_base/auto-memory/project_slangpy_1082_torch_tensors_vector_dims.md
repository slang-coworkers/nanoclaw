---
name: project_slangpy_1082_torch_tensors_vector_dims
description: "slangpy#1082 \"Torch tensors supply vector dims\" (ccummingsNV) — approver ABSTAIN_POLICY:OPEN_GAP, CI red from data-submodule bump"
metadata: 
  node_type: memory
  type: project
  originSessionId: 09f29e54-940d-48a2-8888-f39e3e1c4323
---

slangpy PR #1082 "Torch tensors supply vector dims" by ccummingsNV. Head `c27e1bfc9a1e`.

**Approver verdict (2026-07-30):** ABSTAIN_POLICY, reason_code OPEN_GAP. Fallback tier — no production github-actions[bot] review existed; decided from CodeRabbit + clean Devin run (0 bugs). Critique-gated (DECISION_REVIEW + OUTPUT_REVIEW) → codex approved after 1 must-fix. Nothing posted to GitHub.

**Root of abstain (NOT a code bug):** CI red on 6/12 build jobs, attributable to the PR itself. The `data` submodule bump `4c24c797`→`6ecdf7c` ("Updated bc1 reference data") **removed** `test_images/dds/bc7-unorm-nonsquare.dds` and `bc7-unorm-3d.dds` → unchanged `tests/sgl/core/test_dds_file.cpp` throws "No such file" on fresh-checkout jobs. `ci_green_on_sha` clause only "passed" because shadow policy sets `require_ci_green=false`; CI is in fact red.

**Next-action (maintainer/human):** confirm the data-submodule bump is intentional/complete — restore the two bc7 fixtures OR update/remove the dependent DDS tests — then CI greens and PR is re-evaluable on next push.

**Open nit (non-decision-moving):** CodeRabbit 🟠 buffer-contract finding — exposed public get_signature fn-ptr ABI doesn't enforce documented min buffer size in the Python fallback. Both current in-tree callers are safe (torch max rank=64, both pass 128-byte buffer). Worth a maintainer nit, not a blocker.

**GitHub posting:** NOT authorized (automated pr_ready webhook, no mention/post-auth). Approver never posts. Surfaced to operator dashboard instead. RESUME on next push to the PR (re-review) or operator instruction to post the CI diagnosis.
