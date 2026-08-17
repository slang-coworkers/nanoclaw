---
title: "[approver/critique-mustfix] Doc-consistency check must read the WHOLE file, not just diffed lines"
type: learning
topic: review-approval
source: learnings/1784019216454-approver-critique-mustfix-doc-consistency-check-mu.md
---

# [approver/critique-mustfix] Doc-consistency check must read the WHOLE file, not just diffed lines

**Symptom:** On shader-slang/slang#12090 (a PR that flips the shader-coverage demos' full-mode default from single-dispatch to batched/tiled), the challenger pass read only the DIFFED README lines, saw the usage sections were correctly updated, and concluded "READMEs are self-consistent → no docs OPEN_GAP → WOULD_APPROVE(CLEAN)." The OUTPUT_REVIEW codex critique read the WHOLE README files and caught two UNTOUCHED "Architecture > Dispatch" table rows still asserting the old default (bvh README:117 "as a single dispatch (default)"; image README:157 "whole-image dispatch per config (default)"), now contradicting the new full-mode default the same PR introduces. Decision correctly flipped to ABSTAIN_POLICY(OPEN_GAP).

**Root cause:** A change that alters a documented DEFAULT (or any fact stated in more than one place) can leave stale copies of that fact in parts of the file the diff never touches. Reading only `gh pr diff` output makes those stale copies invisible — the diff shows the lines that WERE changed, not the lines that SHOULD have been changed but weren't. Internal-consistency defects live precisely in the un-diffed remainder.

**How to catch it:** When a PR changes a default value, flag semantics, an API name, or any assertion that is documented, do NOT judge doc-consistency from the diff alone. Fetch the FULL body of every touched doc/README at the pinned head (`gh api repos/<r>/contents/<path>?ref=<sha> | jq -r .content | base64 -d`) and grep it for the OLD value/behavior and for the word "default" — a surviving statement of the pre-change fact anywhere in the file is an OPEN_GAP candidate. Especially check narrative/architecture/overview sections: authors reliably update the usage/CLI section and forget the prose tables. This generalizes beyond docs — the same "did an un-diffed sibling copy go stale?" question applies to duplicated code (e.g. this PR's two identical vk_compute_demo.h copies) and to any invariant asserted in multiple locations.

**Fix:** Docs-accuracy defects in public reference docs that are reachable on the supported path and contradict the PR's own stated behavior clear the conservative-lean bar as OPEN_GAP (consistent with the human-validated `[approver/validated-abstain]` docs learning) → ABSTAIN_POLICY, not a clear. Any doubt ⇒ ABSTAIN.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784019216454-approver-critique-mustfix-doc-consistency-check-mu.md`_
