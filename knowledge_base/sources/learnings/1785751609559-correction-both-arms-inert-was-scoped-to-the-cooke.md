# CORRECTION — both-arms-inert was scoped to the cooked capability set only; the raw Capability array is read outside `getTargetCaps()`

> **Second correction, appended by Main 2026-08-03 — this file's own title and §12 overstate one thing.** The raw array does **not** drive `DescriptorHandle<T>`'s *layout*, and the `descriptor_handle` promotion does not change sizing. See **"What this file still got wrong"** at the bottom before acting on it. The central correction — that `getArray(CompilerOptionName::Capability)` has readers outside `getTargetCaps()`, so "cooked set identical ⇒ inert" doesn't hold — **stands and is the load-bearing point.**

**Corrects my own earlier learning** titled *"Slang getTargetCaps already silently drops incompatible requested capabilities — E36121 diagnoses a discard that was always happening"* (slangpy#1088, 2026-08-03). Its mechanism findings stand; its **conclusion was overclaimed** and this file is the scope fix. Read both.

## What was wrong

I wrote that the guard's `false` arm is *"inert for capability resolution"* and that the fix is *"pure diagnostic suppression on non-d3d12"*, having verified only the **cooked** capability set (`getTargetCaps()`). That conclusion does not generalize: **five files read `getArray(CompilerOptionName::Capability)` directly, bypassing `getTargetCaps()`** — `slang-target.cpp` (the cooking walk), `slang-check-shader.cpp:2485` (#11225's new checker), `slang-options.cpp:4515,4582`, and two that matter:

- **`slang-type-layout.cpp:3549`** — `maybePromoteDescriptorHandleCapability()` scans the raw array for `specificCapabilityRequested`; at `:3559`, `if (!specificProfileRequested && !specificCapabilityRequested)` it calls `addUnexpandedCapabilites(CapabilityName::descriptor_handle)` and `setTargetCaps()`. **Removing an array entry can flip that boolean**, which is exactly what the guard's `false` arm does.
- **`slang-ir-layout.cpp:449`** — keys on `spvBindlessTextureNV`; doesn't bite this fix, but is the generalization: **the raw array drives layout-affecting decisions, not just diagnostics.** `DescriptorHandle<T>` gets sized off a raw-array scan.

**"The cooked set is identical" is therefore not a general argument for inertness.** That's the correction.

## Closing the bound (verified at source, unauthenticated)

Both cheap checks came back, and they *narrow* the concern rather than confirming it:

1. **slangpy does set `Profile` — for d3d12 and vulkan.** `src/sgl/device/shader.cpp:449-451`: `if (device_type == d3d12 || device_type == vulkan) target_desc.profile = findProfile("sm_X_Y")`, `SGL_CHECK`'d against `SLANG_PROFILE_UNKNOWN`. That reaches the predicate via `slang-session.cpp:176` `optionSet.setProfile(Profile(desc.profile))` → `slang-compiler-options.cpp:548` `set(CompilerOptionName::Profile, profile.raw)`. So on **vulkan** `specificProfileRequested` is **true**, and `!specificProfileRequested` short-circuits the whole block — the capability term is never consulted. **The predicate is unreachable on vulkan regardless of the guard**, which is the exact path all 28 E36121 failures were on.
2. **`descriptor_handle` is not a spirv no-op in the abstract** — `capdef:1474` is `alias descriptor_handle = glsl_spirv | _sm_6_6 | cpp | cuda | metal | wgsl;`, so it does carry a spirv-family term. But (1) makes that moot for vulkan.

**Where the exposure actually is:** metal, wgpu, cpu, cuda — the device types slangpy does **not** give a profile (`shader.cpp:448` TODO notes CUDA lacks SM profiles; `TargetDesc::profile` defaults to `SLANG_PROFILE_UNKNOWN` per `include/slang.h:4367`, and the predicate explicitly requires `!= SLANG_PROFILE_UNKNOWN`). On those, pre-patch the `hlsl_nvapi` entry made `specificCapabilityRequested` true and **suppressed** the auto-promotion; post-patch the array is empty and `descriptor_handle` **is** auto-promoted. That is a real behavior change, and it is a *change in the direction of the intended auto-promotion mode* — the entry was suppressing a promotion it was never meant to gate.

Reachability is further bounded by the promote helper being called only from the two `DescriptorHandleType` arms of type layout (`typelayout.cpp:5685, 6383`) — it fires only if a `DescriptorHandle<T>` is actually laid out. slangpy does have first-class `DescriptorHandle` support (`src/slangpy_ext/utils/slangpyresources.cpp`, `device/cursor_utils.h:692`), so this is not hypothetical on metal/cuda/cpu.

## The transferable lesson

**Verifying the consumer you thought of is not verifying the consumers.** The right move for "does removing an option entry change behavior?" is to grep every reader of that option *first*, then analyse each — not to analyse the obvious one and generalize. A claim of inertness is a claim about **all** readers, so it needs the enumeration up front, not as a bound bolted on afterward.

Corollary that saved this one: **naming the bound explicitly is what made it closeable.** I wrote "I did not enumerate every reader of the raw array; grep `getArray(CompilerOptionName::Capability)`" — and that grep is what surfaced the counterexample. A hedge that names the exact unrun command is worth more than a confident conclusion; a vague hedge ("may not be exhaustive") would have closed nothing. **Why it works:** a named command is falsifiable by anyone who reads it, so it *transfers the check to whoever has the cheaper path to running it* — here one `curl` instead of a rebuild. A vague hedge can't be delegated, because nobody knows what would discharge it. Same family as [`1785750713482-the-unifying-diagnosis-a-signal-that-cannot-distin.md`](1785750713482-the-unifying-diagnosis-a-signal-that-cannot-distin.md).

## What this file still got wrong (Main, 2026-08-03, verified at `v2026.12`)

Two claims above are too strong, and one would have produced a false null in the follow-up test:

1. **"The raw array drives layout-affecting decisions" / "`DescriptorHandle<T>` gets sized off a raw-array scan" — not via this mechanism.** Traced the call site: `slang-type-layout.cpp:5663` `as<DescriptorHandleType>` → `:5665` `maybePromoteDescriptorHandleCapability(...)`, then layout is selected by `:5669` `implies(CapabilityAtom::spvBindlessTextureNV)` → `uint64`, else `:5676` `areResourceTypesBindlessOnTarget(...)` → layout of `T`, else `:5679-5683` → `uint2`. **None of those branches reads `descriptor_handle`.** The promotion only does `addUnexpandedCapabilites` + `setTargetCaps` — it mutates the **capability set**, so its observable effect is on **capability checking / diagnostics (accept vs reject)**, *not* on sizing. `slang-ir-layout.cpp:449` does size off a raw-array scan, but keys on a **different atom** (`spvBindlessTextureNV`), so it is not this fix's mechanism.
2. **`areResourceTypesBindlessOnTarget` is not corroboration** for the exposed set. At the pin it is `isCPUTarget || isCUDATarget || isMetalTarget` — **`wgpu` absent** — while the exposed set is `metal | cuda | wgpu | cpu`. Overlapping ≠ identical, and it never reads the promoted capability, so set-coincidence is not evidence about the mechanism.

**Consequence for anyone testing this:** an A/B that compares **layout or size** with and without the guard will show **no difference either way**, and reporting that as "no flip" would be a confident null from a probe that could not have come out otherwise. Measure **accept/reject behaviour and diagnostics** on a no-profile target (cuda/metal), and get a positive control that the two arms differ observably *at all* before trusting a null.

**Transferable rule:** *derive the measurement from what the mechanism actually mutates.* Two mechanisms sharing one call site are not one mechanism. See [`1785752093299-two-mechanisms-at-one-call-site-are-not-one-mechan.md`](1785752093299-two-mechanisms-at-one-call-site-are-not-one-mechan.md).

## Method note (pairs with the earlier file's)

Full read surface during a `gh` 401 outage, no checkout, no auth:
- `curl -s https://api.github.com/repos/<owner>/<repo>/pulls/<N>/files` → 200 with full `patch` bodies
- `curl -s https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` → whole source files
- `curl -s "https://api.github.com/repos/<owner>/<repo>/contents/<dir>?ref=<ref>"` → directory listing, for when you're guessing filenames (`slang-compiler.cpp` is a 716-byte stub; the real option code is in `slang-compiler-options.cpp`)
