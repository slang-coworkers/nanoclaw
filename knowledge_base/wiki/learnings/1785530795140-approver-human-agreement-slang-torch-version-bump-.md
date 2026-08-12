---
title: "[approver/human-agreement] slang-torch version-bump PR — Devin-only fallback WOULD_APPROVE, harvest exit 20 is correct (production skips)"
type: learning
topic: review-approval
source: learnings/1785530795140-approver-human-agreement-slang-torch-version-bump-.md
---

# [approver/human-agreement] slang-torch version-bump PR — Devin-only fallback WOULD_APPROVE, harvest exit 20 is correct (production skips)

**Class:** A `pyproject.toml` (or setup.cfg/package.json) single-line package-version-bump PR in a slang sibling repo (slang-torch, slang-rhi, slangpy), authored by a MEMBER on a same-repo `bump-vX.Y.Z` branch, purpose = rebuild/test wheels against the latest Slang release before a PyPI/publish tag.

**Signal shape (safe → WOULD_APPROVE on Devin-only fallback):**
- `collect-reviews.sh`/`harvest-reviews.py` returns **exit 20** (no bot review, no bot working) — this is EXPECTED and correct, not an infra gap: the production claude-code-action review genuinely skips version-bump PRs (nothing substantive to review). Fall to Devin-only per contract; `reviewers_complete=true` when Devin completes. Do NOT treat exit 20 here as NO_REVIEW_SIGNAL.
- Devin runs head-current, completes (checks N/N), empty flags.
- CI green + complete at head (the build job actually produces the wheels with the new version string → packaging is execution-verified, not just reviewed).

**Two version-bump risk classes the challenger MUST probe (both cleared here, but check every time):**
1. **Second version source-of-truth desync** — code-search the repo at head for the old version string and `__version__`. Confirm the version lives in exactly one place. (slang-torch: only `pyproject.toml`; the `__version__` in `slangtorch/util/compile.py` is `from torch import __version__` — torch's, unrelated.)
2. **Fetched-dependency version/hash pin desync** — does the diff touch a pin that a version bump silently invalidates (cf. slang-rhi CMake `if(SLANG_VERSION STREQUAL SLANG_HASH_VERSION)` hash guard)? For slang-torch this is N/A: `build-package.sh` extracts a prebuilt Slang zip supplied via CI env vars (`$WIN64ZIP` etc.), orthogonal to the package version string — no hash-integrity control in the diff.

**Blast radius:** package metadata only; no runtime/compiler/ABI. `pyproject.toml` is NOT a protected path under v0-shadow-relaxed (protected = `.github/**`, `**/slang-tag-version.h`).

**Decision:** slang-torch#49 v1.3.22 @52e061a9 → WOULD_APPROVE, 6/6 clauses, both risk classes cleared. Nearest prior class precedent: slang-rhi#774 (test-only + version-bump WOULD_APPROVE merged unchanged). Awaiting human join.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785530795140-approver-human-agreement-slang-torch-version-bump-.md`_
