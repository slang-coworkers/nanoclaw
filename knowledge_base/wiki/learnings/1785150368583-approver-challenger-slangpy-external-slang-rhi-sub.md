---
title: "[approver/challenger] slangpy external/slang-rhi submodule bump is reviewable content; fold live maintainer gaps in on the Devin-only tier"
type: learning
topic: slang-compiler
source: learnings/1785150368583-approver-challenger-slangpy-external-slang-rhi-sub.md
---

# [approver/challenger] slangpy external/slang-rhi submodule bump is reviewable content; fold live maintainer gaps in on the Devin-only tier

**Context:** slangpy#1075 ("Fix for texture loading exhausting sampler heap") @ 8b22345, decided ABSTAIN_POLICY:OPEN_GAP. Diff was tiny (2 files, ~4 lines): a `device->wait()` sync added per 32-texture batch + at end of `create_textures()`, plus an `external/slang-rhi` submodule pointer bump. Devin ran clean (0 flags), production claude review SKIPPED (exit-20 harvest), all 6 clauses PASS. The decision rested entirely on the Step-3 challenger.

**Symptom / trap:** A submodule bump shows in `gh pr diff` as an opaque one-line pointer change (`-Subproject commit A` / `+Subproject commit B`). Easy to treat as un-reviewable and let a clean Devin round carry the PR toward approve. Also: I first copied the *bundled* `v0-shadow` policy into the workspace `policy/` dir (mimicking prior work-dirs) — that lists `external/**` as protected and would have wrongly short-circuited to CLAUSE_FAIL:no_protected_paths.

**Root cause / correct handling:**
1. **The submodule delta IS reviewable content.** Fetch `gh api repos/<upstream>/compare/<A>...<B>` and read the actual added lines. Here the bump was a single commit "Extra logging for descriptor heat[map]" adding `std::fprintf(stderr, "GPU descriptor allocation failed…")` on the `GPUDescriptorHeap::allocate` failure path — exactly the fprintf-vs-throw / possibly-debug-logging concern the maintainer raised. Without reading the compare you can't score that gap.
2. **`external/**` is NOT a protected path under the authoritative mounted policy** `/workspace/extra/approver-policy/APPROVAL_POLICY.json` (`v0-shadow-relaxed`: protected = `.github/**`, `**/slang-tag-version.h` only). It IS protected in the skill-bundled `v0-shadow` fallback. So a submodule bump reaches the CHALLENGER, not a clause short-circuit — do NOT copy the bundled policy into `policy/` (it shadows the mount; the workflow never tells you to). Verify `policy_version` in clauses.json = `v0-shadow-relaxed`.
3. **A resource-bounding sync is a gap, not a bug.** `device->wait()` correctly bounds heap residency (achieves the fix) so it's no 🔴 — but the maintainer's "do we now always wait and never frontload?" is a real throughput/design concern with blast radius across every texture-load path ⇒ OPEN_GAP under conservative-lean, not a clear.
4. **Fold a live maintainer review in as the reviewer signal.** On a Devin-only tier (`live_late`), an actively-reviewing maintainer's unanswered review-thread comment is legitimate 🟡 gap signal — independently verify it on the PR (read-only), then synthesize it into review-doc.md and treat each unanswered, plausibly-real concern as OPEN_GAP. Two open maintainer questions + uncertainty ⇒ ABSTAIN_POLICY:OPEN_GAP (the "a human must look" state), never round up because Devin was clean.

**How to catch it next time:** whenever a slangpy PR touches `external/<submodule>`, always pull the upstream compare and read the added lines before scoring; and check the live PR review-thread for open maintainer comments, not just harvested bot reviews — the human's open question can be the whole decision.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785150368583-approver-challenger-slangpy-external-slang-rhi-sub.md`_
