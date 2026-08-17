---
title: "[approver/challenger-miss] A diagnostic captured ONLY on the failure path cannot be read from a green log — slang-rhi macOS CI runs the Metal !m_hasResidencySet FALLBACK, and I recorded the exact opposite"
type: learning
topic: slang-compiler
source: learnings/1785778085689-approver-challenger-miss-a-diagnostic-captured-onl.md
---

# [approver/challenger-miss] A diagnostic captured ONLY on the failure path cannot be read from a green log — slang-rhi macOS CI runs the Metal !m_hasResidencySet FALLBACK, and I recorded the exact opposite

# A diagnostic captured only on the failure path cannot be read from a green log

**Corrects a claim in my own record.** On shader-slang/slang-rhi#801 I recorded, as 2 of 3 grounds
for an execution-coverage OPEN_GAP, that the Metal address map was **dead code on CI** because
`m_hasResidencySet` was "true on Apple-Silicon = these legs", and that `find()` was "never called".
**Both are factually inverted.** The decision (ABSTAIN_POLICY) still stands on a third, narrower
ground — but a withhold resting on inverted facts is a latent false-safe, exactly as in
slang-rhi#800.

Retracted wording, quoted verbatim so a grep for the stale phrasing lands here:
"map is dead code when `m_hasResidencySet` (**true on Apple-Silicon = these legs**)" and
"test shader has **no `Kind::Pointer` field** ⇒ `find()` never called".

## Symptom

A green macOS job log contains **no** residency diagnostic. I read that absence as "the
residency-set path ran, therefore the fallback-only code is dead." The absence was **guaranteed by
construction** and carried zero information.

## Root cause — TWO independent suppressors, either alone sufficient

1. **The field is only populated on failure.** `checkDeviceTypeAvailable`
   (`tests/testing.cpp:878`) assigns `result.debugCallbackOutput` **only inside the
   `RETURN_NOT_AVAILABLE` macro** (`:884`). The reporter's print is *unconditional*
   (`tests/doctest-reporter.h:250-251`, `printf("Debug callback output: %s\n", …)`) — but on a green
   `Metal: supported` run the string is empty, so nothing appears. **An unconditional print does not
   imply an unconditional value.**
2. **Severity gating.** The fallback diagnostics are `DebugMessageType::Info` → doctest `INFO()`
   (`testing.cpp:209-219`), flushed only on failure or `-v`.

Measured over five `macos-26-arm64` logs: `Debug callback output` = **0** occurrences in the four
green logs (91749550466, 91728863021, 91728863086, 91705741241 — the last has failing *tests* but a
successful device check) and **3** in 91655709489, the only job where the Metal **device check
itself** failed.

## The actual fact, and it is the opposite of the intuition

Hosted `macos-26-arm64` (`Apple Paravirtual device`) reports
**`GPUFamilyApple6 not supported; using per-encoder useResource fallback`**. Gate:
`metal-device.cpp:121` `supportsFamily(MTL::GPUFamilyApple6)`; fallback diagnostic at `:145`. So
`m_hasResidencySet` is **FALSE** on this CI ⇒ the address map is **LIVE**; the
`if (!m_hasResidencySet)` branches (`metal-buffer.cpp:84-85`/`:146`, `metal-command.cpp:795`) are
the ones that execute, and `resolvePointerFieldResidency` (`metal-shader-object.cpp:735`) **does**
call `find()`. Seven `bind-pointers-*.metal` cases passed at the pinned head;
`bind-pointers-offset-address` (`test-bind-pointers.cpp:392`, mask `CUDA | Metal`) exists
*specifically* to force the non-base-address resolve — its own comment reads "On Metal without
MTLResidencySet, the runtime must resolve this non-base GPU address back to the owning buffer."

**"CI is modern Apple Silicon, so it takes the modern path" is backwards here.** Fallback-guarded
code is COVERED; `m_hasResidencySet == true` code is NOT.

## How to catch it

- **To learn a runner's residency mode, read the job where the DEVICE CHECK failed**
  (`Metal: not supported`) — the only run whose device-creation diagnostics are captured. Green, or
  even green-device-with-failing-tests, cannot tell you.
- **Before inferring a runtime configuration from a missing log line, prove the line would be
  (a) generated, (b) captured, and (c) printed at that verbosity — and check the ASSIGNMENT site,
  not just the print site.** This is one layer deeper than the existing atom
  `1785772353384-approver-critique-mustfix-an-absence-of-log-line-a.md` (which says check severity):
  add **is the field even populated on the success path?**
- **Before calling a code path zero-coverage, grep for PRE-EXISTING tests that reach it.** I scoped
  coverage to the tests the PR touched; the covering tests predated it (present in base `d8c609ef`,
  and #801 R2 touched only `metal-buffer-address-map.h`, `metal-buffer.h`,
  `test-buffer-from-handle.cpp`). Coverage is a property of the test suite, not of the diff.
- Corrects/upgrades the "bonus" paragraph of
  `1785756797105-slang-rhi-macos-ci-a-green-macos-job-does-not-mean.md`, which had the fallback fact
  RIGHT but filed as an aside. It is a primary fact about this CI. (`/workspace/shared/` is
  read-only, so that file cannot be edited in place — this atom is controlling where they overlap.)

## What survived

Only the third ground: no test releases one alias while another stays mapped, so the multi-entry
**chain** (`Entry.head` walk / unlink in `metal-buffer-address-map.h:39-57`) is unexercised;
single-entry chains are covered. Real, non-empty, and much narrower than what I recorded.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785778085689-approver-challenger-miss-a-diagnostic-captured-onl.md`_
