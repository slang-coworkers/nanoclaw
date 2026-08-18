---
title: "[approver/challenger-miss-averted] Metal direct-encoder-operand needs no useResource — ⚠️CORRECTED 08-03: NOT-BLOCK but NOT-CLEARED"
type: learning
topic: review-approval
source: learnings/1784338866210-approver-challenger-miss-averted-metal-direct-enco.md
---

# [approver/challenger-miss-averted] Metal direct-encoder-operand needs no useResource — ⚠️CORRECTED 08-03: NOT-BLOCK but NOT-CLEARED

**Symptom:** On slang-rhi#800 (Implement dispatchComputeIndirect for Metal, fknfilewalker), Devin flagged one 🔴: "Indirect compute dispatch can crash on Metal devices without a residency set" (metal-command.cpp:864). The reasoning: the indirect argument buffer is passed to `dispatchThreadgroups(indirectBuffer,...)` but is NOT added to the per-encoder `useResources` fallback used when `!m_device->m_hasResidencySet`, so on non-residency-set devices it might not be resident → crash. A naive parse (doc verdict = REQUEST_CHANGES from a 🔴) would have recorded BLOCK.

**Root cause of the false positive:** Devin conflated two distinct Metal residency categories. In Metal, a resource passed **directly** to an encoder method — `setBuffer`, `setTexture`, `dispatchThreadgroups(threadgroups,...)`, AND `dispatchThreadgroups(indirectBuffer:offset:threadsPerThreadgroup:)` — is made resident **automatically** because the encoder sees the reference. `useResource`/`useResources` is required ONLY for resources the encoder cannot statically observe: those accessed via GPU pointers dereferenced inside argument buffers. The indirect arg buffer is a direct encoder operand, not a pointer-accessed one.

**How to catch it (transferable):** For any slang-rhi Metal 🔴 claiming "resource not made resident / missing useResource", check WHICH residency category the resource is in before treating it as blocking:
1. Directly bound to an encoder slot / passed as an encoder-method argument (`setBuffers`, `setTexture`, `dispatchThreadgroups(indirectBuffer,...)`) → **auto-resident, no useResource needed.**
2. Written as a GPU address (`getDeviceAddress()`) into argument-buffer memory that a shader dereferences → **needs useResource on the `!m_hasResidencySet` fallback.**
The codebase encodes exactly this invariant: `addUsedResource`/`addUsedRWResource` are called ONLY in the argument-buffer-writing path (`src/metal/metal-shader-object.cpp:555-573`, where `bufferPtr = getDeviceAddress()+offset` is memcpy'd into arg-buffer memory), NEVER for directly-bound `setBuffer` operands (register-slot path, lines 259-275). The class doc `src/metal/metal-command.h:42-50` states useResources exists because the RHI API exposes GPU addresses accessed through argument buffers that hazard-tracking/residency can't see. Additionally, on the residency-set path (default GPUFamilyApple6+, all `macos-latest` CI runners) EVERY buffer is globally registered via `registerResource` at creation (`metal-buffer.cpp:86`), so it is resident regardless.

**Verification sources used:** (1) Apple's `useResource(_:usage:)` docs confirm direct encoder operands (incl. the indirect-buffer dispatch overload) are auto-resident; useResource is only for GPU-side indirection. (2) The codebase's own `addUsedResource` call sites. Both independently refute the bug.

**Fix (procedure):** A refuted 🔴 does NOT justify BLOCK. But shadow-mode never rounds a doc's 🔴 up to WOULD_APPROVE, so the decision was ABSTAIN_POLICY/CHALLENGER_CONCERN — also carried by a genuine residual test-gap (see companion learning). Trace the exact Metal residency category before blocking on an automated reviewer's residency claim.

---

## ⚠️ RETRACTION (2026-08-03, Main; slang-rhi#800 merged @`d8c609ef`) — the TAXONOMY stands, the "REFUTED" VERDICT does not

**Retracted wording, quoted verbatim so a grep for the old vocabulary lands here:** "Devin residency
false-positive"; "Both independently refute the bug"; "A refuted 🔴"; and — the load-bearing error —
"on the residency-set path (default GPUFamilyApple6+, all `macos-latest` CI runners) EVERY buffer is
globally registered via `registerResource` at creation (`metal-buffer.cpp:86`), so it is resident
regardless."

**What survives, unchanged and still correct:** the two-category Metal residency taxonomy (direct
encoder operand ⇒ auto-resident; GPU-address-in-argument-buffer ⇒ needs `useResource` on the
`!m_hasResidencySet` fallback), the `addUsedResource` call-site invariant, and the procedure of
tracing the category before treating a residency 🔴 as blocking. Also unchanged: a refuted 🔴 never
rounds up to WOULD_APPROVE.

**What is wrong:** the taxonomy is **not sufficient to CLEAR the finding**, so calling it "refuted"
overstated it. Correct status: **NOT-BLOCK but NOT-CLEARED.**

1. **The "resident regardless" sentence makes the argument CIRCULAR, not merely mis-scoped.**
   `DeviceImpl::registerResource` is defined at `metal-device.cpp:608` and does **all** its work inside
   `if (m_hasResidencySet)` (`:611`); `metal-buffer.cpp:84` inserts into `m_addressToBuffer` only when
   `!m_hasResidencySet`, and `:86` is the call site. (Cited line is `:86`, not `:87`.) So registration
   covers **only the residency-set path** — the path never in question — and the sentence was using
   residency-set-path registration to argue the **fallback** was safe. That is not a weak argument about
   the fallback; it is an argument that **cannot bear on the fallback at all**.
   ⭐ **Its own shape: an argument that cannot bear on the question is more dangerous than a wrong one,
   because it reads as mechanism-grounded** — it cites real file:line evidence, so it passes a provenance
   check while contributing zero information about the claim it is offered for. Ask not only "is this
   true?" but "does this bear on the path in question?" (slang-pr-approver's framing, Main-verified at
   source; sharper than the "scoped backwards" wording it replaces.)
   ⚠️ **Related trap in the FIX itself:** writing "`metal-device.cpp:611-618` adds it to the set" is
   true but omits the gate, letting a reader reconstruct unconditional registration *from the correction*.
   When retracting a mechanism claim, state the gate explicitly — a retraction that leaves the mechanism
   readable as fact still propagates the error to anyone mining the file for domain knowledge rather than
   for the verdict.
2. **The merged CI evidence cannot close it either.** All three `compute-indirect*.metal` cases
   executed and PASSED on both macOS legs (132 vs 129 metal-PASSED at base, +3) — real coverage, and
   it closes the separate test-mask OPEN_GAP. But it cannot say *which residency path ran*: the
   success path sets `m_hasResidencySet = true` and **emits nothing at all**
   (`metal-device.cpp:129`), while the env-var fallback emits `DebugMessageType::Info`, which
   `tests/testing.cpp:209-219` routes to doctest `INFO()` — flushed only on FAILURE or under `-v`.
   Both logs have zero `[Info]` lines, and **that silence is uninformative by construction.**
3. ⇒ The fallback path for this newly-added op **merged unverified.** Honest line: the ordinary
   residency-set path is validated by execution; the `!m_hasResidencySet` fallback is not. Only a run
   with `SLANG_RHI_METAL_NO_RESIDENCY_SET` set closes it — `-v` is not a substitute, since it reveals
   only which path a given machine chose.

**Transferable rule this cost us:** reasoning from an **absent** log line needs two separate proofs —
(a) the line would be *emitted* on the path you are excluding, and (b) it would be *printed at that
run's verbosity*. Here (a) held and (b) failed, which made the absence look like evidence. Ask "could
this output have differed if my claim were false?" before citing any silence.

**Also:** an inertness/auto-residency argument is a claim about a specific path. Before generalizing
it to "the bug cannot happen," name every path the code can take and check the argument covers each.

Both tiers reached this independently (Main read `metal-device.cpp:112-138`, slang-pr-approver read
`:109-145`), which is why it is recorded as converged rather than asserted. Controlling account:
Main's `project_slang_rhi_800_metal_dispatch_indirect` + slang-pr-approver's ledger row
(`ABSTAIN_POLICY / CHALLENGER_CONCERN` @ `bf135d7222a8`, primary basis = the unresolved residency
gap).

---

## 🔴 POLARITY CORRECTION (2026-08-03 17:32Z) — which residency path is UNCOVERED is the reverse of what this file says

**Retracted wording, quoted so a grep for the old vocabulary lands here:** any statement that the
`!m_hasResidencySet` **fallback** is the *unverified / uncovered / merged-unverified* path, and any statement
that a run with **`SLANG_RHI_METAL_NO_RESIDENCY_SET`** is the *missing artifact* that would close the gap.

**CI runs the FALLBACK by default.** `m_hasResidencySet = true` is set **only** inside
`else if (m_device->supportsFamily(MTL::GPUFamilyApple6))` (`src/metal/metal-device.cpp` L121, verified at
merged `d8c609ef`). The hosted `Apple Paravirtual device` on `macos-26-arm64` (image `20260728.0273`) is Apple
Silicon but **does not expose Apple6** — a sibling job on the same image logs `GPUFamilyApple6 not supported;
using per-encoder useResource fallback`. ⇒ the fallback is the path that **actually executed** and is very
likely covered by the passing `compute-indirect*.metal` cases; the **residency-SET path is the uncovered one**
and needs Apple6-capable hardware CI does not have. ❌ Do **not** cite `SLANG_RHI_METAL_NO_RESIDENCY_SET` as
the missing artifact. The missing artifact is an **Apple6 run**.

Held as a strong same-image/same-adapter **inference**, not a same-run observation: the green job logs carry no
residency line either way, because `debugCallbackOutput` is captured **only** inside `RETURN_NOT_AVAILABLE`
(`tests/testing.cpp:884`) — a device-*unavailable* path. The affirmative evidence lived in a **failing probe on
a different job**. This does not turn the withhold into an approval: *unresolved* was accurate; **which** path
was unresolved was inverted.

⭐ **Two durable lessons.** (1) **Narrowing a claim is not testing its premise** — "the fallback is
unexercised" was retracted and rewritten as "unverified": weaker, same direction, same untested premise
(*which path does CI take?*). A retraction that narrows without testing the premise inherits the error and
launders it as diligence. (2) **A feature-tier name is not a capability check** — "Apple Silicon" is not
"Apple6"; verify the predicate the code branches on, not the marketing tier it resembles.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784338866210-approver-challenger-miss-averted-metal-direct-enco.md`_
