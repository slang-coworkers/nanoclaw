# [approver/calibration] slang-rhi#802 — a source-verified-CORRECT implementation still FAILED once Metal actually executed: exec-coverage holds are not pedantry

## Symptom

I held slang-rhi#802 (Metal bindless `DescriptorHandle`) at ABSTAIN_POLICY/`OPEN_GAP` on a
pure *coverage* basis: the implementation was **source-verified correct** and matched the
slang#10842 fix-shape spec exactly, but its two new Metal test cases were **SKIPPED** on macOS
CI (the runner reported Metal unsupported), so the runtime path had **zero execution coverage**.
"Green CI ≠ tests executed." That reads like pedantry when the source review is clean — a
plausible reviewer would round it up to approve.

Then slang-rhi#807 fixed the Metal device-init problem, Metal began genuinely executing, and
#802's next CI run turned **red on exactly the two cases I held on**:

```
tests/test-bindless.cpp:7    TEST CASE: bindless-buffers.metal   FAILED  (17 assertion failures)
tests/test-bindless.cpp:184  TEST CASE: bindless-textures.metal  FAILED  (60 assertion failures)
tests/testing.h:234: ERROR: CHECK_GE( result[i], expectedResult[i] - 0.01f ) is NOT correct!
  values: CHECK_GE( 0, 0.99 )   logged: i := 0
  values: CHECK_GE( 0, 3.99 )   logged: i := 3
[doctest] test cases: 1041 | 1039 passed | 2 failed
```

Buffers read back **zeros / off-by-one-slot** data instead of the expected 1…12 ramp.

## Root cause of the *review* miss (not of the bug)

Source-correctness and behavioural-correctness are different claims, and a clean source review
licenses only the first. Every mechanism #802 needed was individually right — raw
`getDeviceAddress()+offset`, `gpuResourceID()._impl`, the `static_assert` on
`sizeof(MTL::ResourceID)`, the combined tex+sampler exclusion. The composition still produced
wrong data. **No amount of reading would have found this; only running it did.**

## How to catch it / how to attribute cleanly

Attribution matters — "the tests fail" is worthless if they were already failing. Counting
`.metal` result rows on both branches proved the failures are the PR's own:

| branch | `.metal` rows | `bindless-*.metal` | `Features:` line |
|---|---|---|---|
| main (post-#807) | **205** (129P/76S/0F) | **absent entirely** | no `bindless` |
| #802 branch | **207** (129P/76S/**2F**) | present, both FAIL | `… bindless argument-buffer-tier-2` |

Delta of exactly **2** = the two cases #802 registers, plus it adds the `bindless` feature
advertisement. So the regression is unambiguously introduced, not inherited.

Two more discriminators worth reusing:
- **Debug vs Release identical** — the full ordered 77-tuple of (error line, values, index) was
  **byte-equal** across optimization levels ⇒ deterministic logic/codegen bug, **not** UB and
  not a race. Cheap test, strong conclusion.
- **Check the skip *reasons*, not the skip count.** None of the 76 remaining `.metal` skips was
  `device not available` (ray tracing 59, timestamp 12, combined tex-sampler 2, …) — that is how
  you tell "feature-gated, fine" from "silently not running at all."

## Fix / calibration

**Never round an execution-coverage gap up to approve on the strength of a clean source read.**
This is the series' strongest anti-round-up datapoint: WOULD_APPROVE here would have been a
genuine false-approve of code that demonstrably computes wrong results on real hardware.

Discipline notes for the re-gate:
- Root cause remains **OPEN**. The residency premise is now *observed* rather than inferred
  (`GPUFamilyApple6 not supported; using per-encoder useResource fallback` — the paravirtual GPU
  is below Apple6, exactly the `!m_hasResidencySet` path), but the failure *values* argue for a
  descriptor **indexing** shift: `result[i] == i` where `expected == i+1`. Non-resident reads
  would more plausibly give uniform zeros, not a neat off-by-one ramp. **Assert neither** as the
  cause.
- Don't decide on a head with a standing CHANGES_REQUESTED plus red CI; that is `live_late` and
  needs a full re-gate on a settled head.
- My pinned decision head went stale twice while the row sat "awaiting join." Re-read live head
  + reviews before touching any awaiting-join row.
