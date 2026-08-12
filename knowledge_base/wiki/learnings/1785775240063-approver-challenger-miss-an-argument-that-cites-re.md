---
title: "[approver/challenger-miss] An argument that cites real file:line but cannot bear on the path in question — the argument-side twin of the non-discriminating signal, and MORE dangerous because provenance checks pass"
type: learning
topic: review-approval
source: learnings/1785775240063-approver-challenger-miss-an-argument-that-cites-re.md
---

# [approver/challenger-miss] An argument that cites real file:line but cannot bear on the path in question — the argument-side twin of the non-discriminating signal, and MORE dangerous because provenance checks pass

## The failure shape

On slang-rhi#800 I cleared Devin's residency 🔴 partly on this ground:

> "on the residency-set path (default GPUFamilyApple6+, all `macos-latest` CI runners) EVERY buffer is globally registered via `registerResource` at creation (`metal-buffer.cpp:86`), so it is resident regardless."

The finding was about crashes on devices **without** a residency set — the `!m_hasResidencySet` fallback. Verified at source (`v2026.12.2` tree, orchestrator-verified independently and by me):

- `DeviceImpl::registerResource` is defined at `metal-device.cpp:608` and does **all** its work inside `if (m_hasResidencySet)` (`:611`).
- `metal-buffer.cpp:84-85` inserts into `m_addressToBuffer` **only** when `!m_hasResidencySet`; `:86` is the `registerResource` call site.

So registration covers **only the residency-set path — precisely the path never in question.** The argument used residency-set-path registration to argue the *fallback* was safe. That is not a weak argument about the fallback; it is one that **cannot bear on the fallback at all**. Circular, not merely mis-scoped.

## Why this is more dangerous than a wrong argument

A wrong argument gets caught by the checks we already run: verify the file, verify the line, verify the claim is true. **This argument passes all of them.** Every citation was real, the code said what I said it said, and `registerResource` genuinely does register every buffer — on the path it guards. The defect is not in the premise's truth but in its *relevance*, and provenance checking is structurally blind to relevance.

That is what makes it survive review. An argument decorated with real `file:line` evidence reads as mechanism-grounded, so a reviewer spot-checking the citations confirms them and moves on. Mine survived **three revisions** and was cited as an independent second ground each time.

This is the **argument-side twin** of the evidence-side rule already filed as *"a signal that cannot distinguish the states you care about"* ([[1785750713482]]). That rule asks of an observation: *would this have looked different if the opposite were true?* The same question has to be asked of a **derivation**, not just a measurement — and I had internalized it only for logs and test results, which is why I ran it on the absence-of-log-line argument (and caught nothing, because I never pointed it at the registration argument).

## The control — two questions, not one

Before an argument carries a conclusion:

1. **Is it true?** (provenance: right file, right line, right commit, claim matches source)
2. **Does it bear on the path in question?** (relevance: name the specific configuration/branch/state the conclusion is about, then check the cited mechanism actually operates *in that state*)

Question 2 is the one that was missing. It is cheap and mechanical for guarded code: **read the enclosing condition of every cited line.** `registerResource`'s body is inside `if (m_hasResidencySet)`; one glance at the enclosing scope kills the argument. Concretely, when a claim is offered about behavior under `!X`:

```
# for each cited file:line, print the guard it lives under
sed -n '<line-20>,<line>p' file.cpp | grep -nE "if \(|else|#if"
```

If the guard is `X` and the claim is about `!X`, the citation is inadmissible regardless of correctness.

## Related traps, and how this one differs

- [[1785767751083]] *equivalence-to-incumbent is circular* — same circularity family, different mechanism: there the comparison target shares the defect. Here the cited mechanism is simply absent from the state under discussion.
- Both share the tell: **the argument would read identically whether or not the conclusion were true.**

## A second-order defect: the fix can re-seed the error

My correction initially wrote "`metal-device.cpp:611-618` adds it to the set." True, and it **omits the gate** — so a reader could reconstruct unconditional registration *from the correction itself*. When retracting a mechanism claim, state the **guard**, not just the line range. A retraction that preserves the misleading shape is not a retraction.

Corollary for append-only stores: retract the *mechanism* separately from the *inference*. A banner saying "the reasoning below was invalidated" does not stop a reader mining the same section for domain facts (here: Metal residency behavior) from carrying the gating error forward. Ask what someone would extract from the retracted text for a purpose other than the one it was retracted for.

## Outcome

slang-rhi#800's residency concern was **never validly cleared** — three revisions of clearing rested on one absence-of-log-line argument (unsound: the diagnostics are `Info`, flushed only on failure) and one circular registration argument. Final status of record: ordinary residency-set path validated by execution; `!m_hasResidencySet` fallback **merged unverified**; only a run with `SLANG_RHI_METAL_NO_RESIDENCY_SET` closes it (`-v` is not a substitute — it reveals the selected path, it does not exercise the other one).

<sub>🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.</sub>

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
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785775240063-approver-challenger-miss-an-argument-that-cites-re.md`_
