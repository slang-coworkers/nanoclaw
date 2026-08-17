---
title: "[approver/human-disagreement] Confirmed agreement: content-digest exclusion of a load-time-only option is a safe WOULD_APPROVE shape"
type: learning
topic: review-approval
source: learnings/1784031339360-approver-human-disagreement-confirmed-agreement-co.md
---

# [approver/human-disagreement] Confirmed agreement: content-digest exclusion of a load-time-only option is a safe WOULD_APPROVE shape

**Not a disagreement — a confirmed agreement, recorded for calibration.** shader-slang/slang#12068 (Fix #6557) decided WOULD_APPROVE (CLEAN) on the Devin-only fallback tier; MERGED unchanged (head `7bba4d1ca17d`, single commit, zero follow-up commits) by jvepsalainen-nv, on top of pdeayton-nv's prior APPROVE of the same commit.

**The transferable shape:** A change that EXCLUDES a compiler option from a content/cache digest (`CompilerOptionSet::buildHash`) is SAFE to approve when — and only when — the option is proven to have zero effect on generated/linked output, i.e. it's a pure load-time or output-policy knob. The probe that establishes this, and that a maintainer would run:
1. Find every CONSUMER of the option (grep the option name across `source/slang/`). If it's read only at an acceptance/policy gate (here: `slang-session.cpp:1282`, gating whether `isBinaryModuleUpToDate` runs) and never in a codegen/emit path, it doesn't belong in the digest.
2. Check for a CLI spelling (grep `slang-options.cpp`). No CLI spelling ⇒ API-only ⇒ no on-disk digest was ever baked WITH the flag ⇒ excluding it CANNOT retroactively accept a stale cached artifact. This is the key stale-cache-safety argument for digest EXCLUSIONS specifically.
3. Confirm the digest feeds no OTHER cache whose correctness depends on the option. `CompilerOptionSet::buildHash` also feeds `Linkage::buildHash` (target-code/linkage caches); since the option has no codegen effect, two compilations differing only in it must produce identical artifacts, so a shared cache key stays correct (deepwiki corroborated).
4. Look for a precedent skip in the same function — here `CoverageManifestOutput` was already excluded for the identical reason two lines above, and its lock-test (`_testCoverageManifestOutputDoesNotAffectCompilerOptionHash`) is scoped to that option, so the new skip breaks nothing.

**Why it matters for Step-0 recall:** digest/cache-key changes look scary (silent stale-cache acceptance is a classic footgun) but the "exclude a load-time-only option" sub-shape is provably safe via the 4 probes above. Contrast with digest *inclusion* changes or excluding an option that DOES touch codegen — those are NOT safe and warrant ABSTAIN/BLOCK. See [[pr-12068-awaiting-join]] and the digest-based up-to-date-check learning (`isBinaryModuleUpToDate` uses content digest, not mtime).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784031339360-approver-human-disagreement-confirmed-agreement-co.md`_
