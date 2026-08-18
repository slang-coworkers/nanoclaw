---
title: "CORRECTION — two symptoms sharing a description is a hypothesis, not a unified defect"
type: learning
topic: verification
source: learnings/1785966354315-correction-two-symptoms-sharing-a-description-is-a.md
---

# CORRECTION — two symptoms sharing a description is a hypothesis, not a unified defect

# CORRECTION to my own entry: "two symptoms with one description" was a HYPOTHESIS I published as the thing that worked

**Repairs the "What actually worked" section of my 2026-08-05 learning *"A remedy claim needs its own instrument — box health says nothing about a service's cached environment"* (filed ~21:40Z, same incident: shader-slang/slang#12341). The primary lesson there STANDS — remedy-from-defect inference, the hedging correlation, observability bias in hypothesis selection. This atom corrects one bullet I listed as a success.**

## What I published

> **The two-signature unifying description:** *"a freshly built Slang binary cannot resolve a DLL or an exported symbol on this box"* — covering both `spirv-val 0/866` and a nightly `failed to load slang.dll`. A deleted-but-still-on-`PATH` Vulkan directory **is exactly that.** ⭐ The description survived even though every mechanism guess under it was wrong.

I called that out as the artifact that worked, and I described it as *surviving*.

## Why it's wrong

The two symptoms have **two different causes.** Measured:

| limb | cause | status |
|---|---|---|
| `test-compile-regression` → `spirv-val [0/866]` | VulkanSDK upgraded with the old version **deleted**; runner service never restarted ⇒ stale cached `PATH` | ✅ fixed by a service restart |
| nightly VKGLCTS → `failed to load slang.dll`, 11,545/13,792 fail | slang renamed `slang.dll` → `slang-compiler.dll` in **`dcb47b716`**, and the workflow copies only the new name — a **separate, latent** defect fixed by VK-GL-CTS PR #17 | ✅ different fix, different repo |

**Decisive timing check:** `dcb47b716` is dated **2025-10-31** — *nine months* before the 2026-08-04 onset. A nine-month-old rename cannot produce a sharp onset, which means the VKGLCTS limb was never evidence for the SLANGWIN5 environment fault at all. They coincided on one box on one day.

## The actual lesson

⭐⭐⭐ **Two symptoms sharing a plausible description is a HYPOTHESIS about common cause — not a demonstration of one.** I had it inverted: I treated the description's *coverage* as evidence, and coverage is exactly what a sufficiently abstract description always has. *"A freshly built binary can't resolve a DLL or symbol"* is broad enough to cover any dynamic-linking failure on any host, so it was **guaranteed** to fit both limbs regardless of whether they shared a cause.

⇒ **The test for common cause is not "does one description fit both" — it is whether the limbs are coupled in time and mechanism.** One cheap check refutes it here: the candidate mechanism's own date.

⚠️ **And I inverted the epistemics twice over.** I wrote that the description *"survived even though every mechanism guess under it was wrong"* — presenting durability as its virtue. But a claim that survives the refutation of every mechanism beneath it isn't robust; **it is unfalsifiable at the level it was stated.** That is the property to be suspicious of, not to celebrate. Cf. my own standing rule that a claim which cannot be wrong is not doing work.

## What still stands from the corrected entry

- **A remedy claim needs its own instrument** — I inferred "a restart is a no-op" from "the box passes other jobs"; the fix *was* a service restart. Second instance of remedy-from-defect on one chain.
- **The hedging correlation** — the claim we labelled a hypothesis (VS 17→18) was wrong and cost nothing; the claim we stated flatly ("not a reboot") was wrong and shaped the ask. Cost tracks the **label**, not felt confidence.
- **Observability bias** — two toolchain changes landed in that window and we latched onto the one our logs happened to print.
- **The overscoped ask** — "depool or reprovision" when a free service restart sufficed.

## The meta-pattern this closes

Every defect on this chain lived in a **correction, a control, or a claim about my own reliability** — never in the original diagnosis. This atom is the last of them: a bullet in a lessons-learned entry, asserting that a thing worked, published minutes after the incident closed and while I was cataloguing my own errors. **Writing an accurate self-critique is not evidence that every sentence in it is accurate** — the success bullets need the same instrument as the failure bullets, and they get less scrutiny precisely because they flatter nobody.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785966354315-correction-two-symptoms-sharing-a-description-is-a.md`_
