---
title: "Which arm of a compatibility guard carries the risk — the restoring arm is inert by construction"
type: learning
topic: misc
source: learnings/1785750665244-which-arm-of-a-compatibility-guard-carries-the-ris.md
---

# Which arm of a compatibility guard carries the risk — the restoring arm is inert by construction

## The rule

When a fix narrows an unconditional action behind a predicate — `if (P) do_the_old_thing();` — the **true arm is inert by construction**: it restores the pre-patch code path verbatim and cannot regress anything. The **false arm is the entire behavior change**. So a caveat of the form "the `P == true` path is unverified" points at the arm that needs no verification, and stays silent on the one that does. The real open question is always: *did anything on the newly-skipped path depend on the side effect that no longer happens?*

Worth stating explicitly because "I couldn't test configuration X" feels like the honest hedge, and reviewers accept it — while the untested-and-actually-risky side slips through unnamed.

## The instance (slangpy#1088, 2026-08-03)

`src/sgl/device/shader.cpp:405` unconditionally did `session_options.add(Capability, findCapability("hlsl_nvapi"))`; the fix guards it with `SGL_HAS_NVAPI && m_device->type() == DeviceType::d3d12`. The `true` arm reproduces the old unconditional add exactly ⇒ zero regression surface. The question that matters is whether any **non-d3d12** path relied on `hlsl_nvapi` leaking into the session options.

Second-order trap in the same review: the false arm **did** execute locally (`SGL_HAS_NVAPI: OFF` on Linux ⇒ predicate always false), but against a Slang pin where the diagnostic under test was unreachable. So it ran without being able to discriminate patched from unpatched — execution is not observation. Check both that the arm ran *and* that the environment could have shown a difference. See [`1785749557692-a-grep-returning-0-is-only-evidence-if-the-same-pa.md`](1785749557692-a-grep-returning-0-is-only-evidence-if-the-same-pa.md) for the same failure shape on log evidence.

## Corollary for a two-clause predicate

`SGL_HAS_NVAPI && type == d3d12` short-circuits on Linux, so a Linux run cannot tell you which clause did the work. If you need per-clause attribution, you need a platform where the first clause is true.

## Don't over-weight the inert arm either — split device-level from non-device-level

The mirror-image error, hit on the same PR: after correcting *"the `true` arm passed"* → *"the `true` arm is unverifiable, weight it accordingly,"* that framing **over-weights a non-risk** — an inert arm cannot behave differently from shipped code, so inviting concern about it is its own inaccuracy.

And more was verifiable than either framing implied. Because the diagnostic is raised in `TargetRequest::checkCapabilities()` keyed on the **target**, with no device term, the `dxil + hlsl_nvapi` pairing **is** testable on a machine with no D3D12 device at all — and compiles cleanly. The honest split:

- **Verified locally:** the capability/target pairing (no device required).
- **Needs real D3D12 CI:** device creation, runtime NVAPI linkage, Windows subcase execution, the `true` branch through `create_session`.

General form: *"can't test configuration X"* is usually too coarse. Separate the part that needs the hardware from the part that only looked like it did — a diagnostic keyed on a compile target is not gated on a device existing. And note the failure mode of over-correction: a claim weakened three times in one chain (`passed` → `unverifiable` → `partly verifiable, here's the split`) was drifting because each pass restated the hedge instead of re-deriving what the code actually keys on.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785750665244-which-arm-of-a-compatibility-guard-carries-the-ris.md`_
