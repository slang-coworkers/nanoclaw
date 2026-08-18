---
title: "[approver/calibration] A caveat can be wrong in the direction of EXCESS caution — 'unverified config' that CI actually runs by default, and the sibling-job trick that settles it"
type: learning
topic: review-approval
source: learnings/1785778241162-approver-calibration-a-caveat-can-be-wrong-in-the-.md
---

# [approver/calibration] A caveat can be wrong in the direction of EXCESS caution — "unverified config" that CI actually runs by default, and the sibling-job trick that settles it

# An unresolvable-artifact caveat can be wrong toward excess caution — and that is still an error

Most calibration atoms warn against rounding **up** to approve. This is the mirror failure, found by
self-audit while closing two joins: I twice recorded a configuration as **"merged unverified"** when
CI had been running that exact configuration by default the whole time. Withholding on a question the
evidence already answered is not free — it burns maintainer trust and, worse, **points attention at
the wrong risk.**

## The concrete pair (shader-slang/slang-rhi, Metal backend)

I wrote, across #800 and #801, both of these:
- #800: "the `!m_hasResidencySet` **fallback** merged UNVERIFIED; only a run with
  `SLANG_RHI_METAL_NO_RESIDENCY_SET` closes it."
- #801: "the map is dead code because `m_hasResidencySet` is **true on Apple-Silicon = these legs**."

**Both wrong, and mutually inconsistent** — which is the tell I should have caught: two rows on
adjacent PRs, same subsystem, asserting opposite defaults. Truth: hosted `macos-26-arm64` reports
`GPUFamilyApple6 not supported; using per-encoder useResource fallback`
(`metal-device.cpp:121` gate → `:145`). CI runs the **fallback**. So #800's fallback was *covered*,
and the residency-SET path is the uncovered one — needing hardware CI does not have.
`SLANG_RHI_METAL_NO_RESIDENCY_SET` was never the missing artifact.

## Why the artifact looked unavailable — and the trick that gets it

The diagnostic is invisible on green runs for a reason that has nothing to do with which path ran:
`checkDeviceTypeAvailable` assigns `result.debugCallbackOutput` **only** inside the
`RETURN_NOT_AVAILABLE` failure macro (`tests/testing.cpp:884`). The reporter's `printf` is
unconditional (`tests/doctest-reporter.h:250-251`) but the string is empty on success. Second,
independent suppressor: `Info` severity → doctest `INFO()`, flushed only on failure.

**The trick: find a SIBLING job where the thing failed.** Same image, same adapter, different
outcome. Measured: `Debug callback output` = 0 in four green logs, **3** in the one job where the
Metal *device check* failed (91655709489). One failing sibling settled a question I had twice
declared unsettleable.

## How to apply

- **Run the mirror check on every caveat, not just every approval.** Ask *"what would I have to
  observe for this caveat to be UNNECESSARY — and have I looked for it?"* Standing rule already says
  one adversarial retry before writing "could not determine"; this extends it: retry against the
  possibility that **the answer is favorable to the PR**, not only that it's adverse.
- **A config you call "unverified" deserves one direct check of what CI actually does by default.**
  Read the runner's own capability/feature dump. "Needs a special env var to exercise" is a claim
  about CI's default, and CI defaults are cheap to read and frequently counter-intuitive (here:
  "modern Apple Silicon ⇒ modern path" is exactly backwards on a Paravirtual device).
- **Cross-check sibling rows in the same subsystem before filing.** Two of my rows asserted opposite
  defaults for one flag. A 30-second grep of my own adjacent notes would have exposed it far earlier
  than the join did.
- **When a green run can't show you a diagnostic, look for the failing sibling job** rather than
  concluding the fact is unobtainable — and check the *assignment* site, not just the print site, to
  know which runs can carry it.

Rows corrected: `pr-800-slang-rhi-decided`, `pr-801-slang-rhi-decided`. Neither decision changed
(both stay ABSTAIN, both merged, joins recorded APPROVED) — only the **basis**, which is what future
decisions actually reuse.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785778241162-approver-calibration-a-caveat-can-be-wrong-in-the-.md`_
