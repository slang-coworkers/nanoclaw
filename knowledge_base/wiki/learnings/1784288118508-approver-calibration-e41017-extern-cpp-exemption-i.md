---
title: "[approver/calibration] E41017 __extern_cpp exemption is false-negative-safe by construction — approve the class"
type: learning
topic: review-approval
source: learnings/1784288118508-approver-calibration-e41017-extern-cpp-exemption-i.md
---

# [approver/calibration] E41017 __extern_cpp exemption is false-negative-safe by construction — approve the class

**Symptom:** A fixer PR (nv-slang-bot, bot-authored) adds an *exemption* to a diagnostic check — suppressing a warning for a specific IR shape. Instinct is to worry an exemption masks a real bug. For shader-slang/slang#12011 (@c7b35f1bdd02), the E41017 (UsingUninitializedGlobalVariable) exemption for `__extern_cpp` host-provided globals was WOULD_APPROVE (CLEAN); expipiplus1 APPROVED at the exact head.

**Root cause / why safe:** The check `checkUninitializedGlobals` (source/slang/slang-ir-use-uninitialized-values.cpp) emits the warning ONLY when the global has NO in-module init block AND NO Store/StoreParent use — two early returns before the diagnose. The new exemption early-return sits before those scans and fires only for `IRExternCppDecoration` + external linkage (Approach B). That shape is *by definition* the host-set-global pattern (docs/cpu-target.md: `__global public __extern_cpp int myGlobal;` set at runtime via `findSymbolAddressByName`) — value comes from outside the module, so absence of an in-module init is intentional, not a forgotten init. So the exemption **cannot** hide a real "forgot to initialize" bug: a normally-initialized global has an init block or a store and returns earlier regardless.

**How to catch it (the transferable probe):** For any diagnostic-suppression / exemption PR, don't ask "could this hide a bug?" in the abstract — trace the diagnostic's *fire conditions*. If the check only fires on a shape that the exemption's predicate is a strict subset of (and that subset is a documented legitimate pattern), the exemption is false-negative-safe by construction. The decisive artifacts: (1) the early-returns that gate the diagnose (fire only when X AND Y), (2) a discriminator test proving the exemption is narrow (here: `export __global` WITHOUT `__extern_cpp` still warns), (3) docs/deepwiki confirming the exempted shape is a sanctioned pattern.

**Fix:** WOULD_APPROVE when (a) the exemption predicate ⊆ the documented-legitimate shape, (b) the diagnostic's fire-conditions make the suppressed case one that could never be a real bug, (c) a discriminator test guards against the predicate widening, and (d) CI green at head. This is the "suppress-a-false-positive-on-a-documented-pattern" class — approvable, not withhold. Contrast with widening a core behavior (that breaks untouched tests — see the #12141 challenger-miss-averted class).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784288118508-approver-calibration-e41017-extern-cpp-exemption-i.md`_
