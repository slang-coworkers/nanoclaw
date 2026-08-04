---
title: "A pin-independent fix's risk baseline is the pinned dependency, not the unreleased upstream change that motivated it"
type: learning
topic: misc
source: learnings/1785751904901-a-pin-independent-fix-s-risk-baseline-is-the-pinne.md
---

# A pin-independent fix's risk baseline is the pinned dependency, not the unreleased upstream change that motivated it

When you fix a downstream repo to accommodate an unreleased upstream change, and you deliberately make the fix **pin-independent** so it can land early, you have created a window: the fix ships to users under the **currently pinned** dependency, long before the upstream change merges or is tagged. Risk must be assessed against the pin — not against the post-upstream world you were reasoning about while writing it.

The pin-independence that makes the fix safe to land early is exactly what makes the post-merge world the wrong comparison. It is an easy error precisely because the upstream change is the thing that's been occupying your attention.

**Concrete case** (slangpy#1087 / PR #1088, blocking slang#11225, 2026-08-03). A guard stopped requesting the `hlsl_nvapi` capability on non-d3d12 targets. Analysis showed the cooked capability set was byte-identical, so the change looked inert. But several files read the **raw** `CompilerOptionName::Capability` array, and one of them matters:

- `slang-type-layout.cpp` — `maybePromoteDescriptorHandleCapability` computes `specificCapabilityRequested` from the raw array, then auto-promotes `CapabilityName::descriptor_handle` iff `!specificProfileRequested && !specificCapabilityRequested`.
- `slang-ir-layout.cpp` — the raw array drives `DescriptorHandle<T>` **sizing**, so raw reads are not diagnostic-only.
- `Capability` is in `CompilerOptionSet::allowDuplicate()`, so `inheritFrom()` merges it **additively** session→target; the request genuinely reaches the set being read.

I dismissed the exposure as "probably benign — those targets were erroring under the upstream change anyway." Wrong baseline. Checking the **pinned release tag** showed `maybePromoteDescriptorHandleCapability` already present with an identical predicate, and its doc comment states promotion happens "only when no specific profile or capability was requested (auto-promotion mode)." So the stray capability entry had been *silently suppressing* auto-promotion on every affected target, under the pinned compiler, all along. Removing it flips those targets from suppressed to promoted — a real behaviour change in the ship window, and plausibly a latent-bug fix rather than a regression, but unverified either way.

**Controls:**

- Fetch the dependency source at the **pinned ref** (`gh api repos/<owner>/<repo>/contents/<path>?ref=<tag>`) and check whether the affected logic exists there. Do not reason about it from the unreleased branch you happen to have open.
- Ask: *which configurations behave differently under the pin, between old and new code?* That set — not the set the upstream change breaks — is your risk surface.
- Narrow it honestly before calling it benign. Here, two real narrowings dropped the surface a lot: the promotion only fires inside `as<DescriptorHandleType>(type)` branches (no such type in the shader ⇒ no change), and a sibling predicate confirmed the same target set. But the type *was* reachable from the downstream API, so the exposure was real rather than vacuous.
- **A green CI matrix that lacks the exposed configuration cannot see the flip.** If exposure is confined to metal/cuda/cpu and CI runs vulkan, no amount of vulkan green speaks to it. Say so, and either test one exposed target or file it as a known gap.

**Corollary on two-clause predicates:** when a guard is `A && B` and you want to know whether removing an input can change the outcome, the clause that closes the bound may be the one you didn't suspect — and the code satisfying it may live in the *other* repo. Here `hasOption(Profile)` was unconditionally true because the upstream session code calls `setProfile()` for every target, while the downstream repo only ever sets a `TargetDesc` **field**. Grepping the downstream repo for the option name returns nothing, which would "confirm" no profile is ever requested — exactly backwards.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785751904901-a-pin-independent-fix-s-risk-baseline-is-the-pinne.md`_
