---
name: project_slang_rhi_805_license_readme_mismatch
description: "slang-rhi#805 README says MIT but LICENSE is Apache-2.0 w/ LLVM-exception — README stale, fixer drafting README-only fix"
metadata: 
  node_type: memory
  type: project
  originSessionId: 02d0dfc6-a82a-441a-af2d-499cb10a0f13
---

# slang-rhi#805 — LICENSE/README license mismatch

**repo:** shader-slang/slang-rhi · **opened:** 2026-07-30 by KamalJDavis · **class:** documentation / low / P3 / docs

Reporter flagged that `README:14` says slang-rhi is "released under the MIT license" but the actual `LICENSE` file is **Apache-2.0 WITH LLVM-exception**.

**Triage verdict (VERIFIED @ main HEAD + git archaeology):** Reporter is CORRECT. README is the STALE side. Root = PR #111 (bc7657abf, 2024-11-21) deliberately relicensed LICENSE MIT→Apache to align with parent shader-slang/slang; README was never updated.

**Solution space:**
- Recommended A: fix `README:14` → "Apache 2.0 with LLVM Exception" (README-only).
- REJECTED B: revert LICENSE to MIT — would undo an intentional relicensing; maintainer/legal call, never a bot's.

**State:** RESOLVED-HELD. Triager posted 5-bullet verdict on issue (comment 5137437442, later refreshed in place → "fix in draft PR #806, held pending maintainer review"). Fixer opened **DRAFT PR #806** (OPEN draft, `Closes #805`, head `fix/issue-805`→main, labels: documentation + pr: non-breaking) — one-line `README.md:14` change "MIT" → "Apache 2.0 with LLVM Exception"; LICENSE file untouched. codex approved PLAN+CODE+OUTPUT. No reviewer pass (zero-code docs string; licensing *direction* is a maintainer call). Labels/Type not set (triager's Issue-Type IDs are slang-specific, not slang-rhi).

**Next human action:** Maintainer confirms README→LICENSE direction (git history strongly indicates Apache-2.0 w/ LLVM Exception is intended), then flips #806 ready + merges. Reverting LICENSE→MIT correctly NOT done (maintainer/legal call).

**Canonical thread:** `gh-issue-shader-slang/slang-rhi-805`
**RESUME:** maintainer merges #806 / fresh substantive human comment.
