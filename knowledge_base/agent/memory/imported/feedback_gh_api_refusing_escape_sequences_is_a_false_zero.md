---
name: feedback_gh_api_refusing_escape_sequences_is_a_false_zero
description: "gh api <job>/logs can refuse to print (rc=1, 99 bytes: 'the response contains terminal escape sequences; pass --allow-escape-sequences') — a substring .count() over that refusal returns 0 for every pattern, manufacturing a uniform all-zero census that reads as a real measurement"
metadata: 
  node_type: memory
  type: feedback
  title: gh api refusing escape sequences is a false zero
  tags: 
    - instrument-defect
    - false-zero
    - github-actions
    - ci
  originSessionId: 67912aa9-ab11-43ae-8cf8-515bfed44987
---

# `gh api …/logs` can refuse to emit, and a `.count()` over the refusal is a silent zero

**Measured 2026-08-11, slang-rhi#598 run `31467075618`.** I censused 9 step-green CI legs for real
device coverage by counting `SKIPPED (device not available)` and testing for `optix_coopvec` in each
job log. Result:

```
build (linux, x86_64, clang, Debug)       device-skips=0  optix_coopvec=False
build (windows, x86_64, msvc, Release)    device-skips=0  optix_coopvec=False
… all 9 legs identical …
=> legs that actually executed the changed path: 0
```

**Every value zero, every leg, including macOS legs that have no CUDA device and therefore CANNOT
have 0 device-skips.** That impossibility is what saved it. The real numbers, once fixed:

| leg | device-skips | `optix_coopvec` |
| --- | --- | --- |
| windows x86_64 msvc Release | **0** | ✅ |
| windows x86_64 clang Debug | **0** | ✅ |
| linux x86_64 clang Debug/Release | 125 | ✅ |
| windows x86_64 msvc Debug · clang Release | 835 | ❌ |
| windows aarch64 msvc Release | 960 | ❌ |
| macos aarch64 clang Debug/Release | 650 | ❌ |

**4 of 9 executed the changed path** — not 0.

## The mechanism

```
$ gh api repos/<o>/<r>/actions/jobs/<id>/logs > probe.txt; echo rc=$?
rc=1
$ wc -c < probe.txte
99
$ head -3 probe.txt
the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway
```

`gh` **refuses to write the body** and emits a 99-byte advisory instead. My loop captured
`result.stdout` and ran `log.count('SKIPPED (device not available)')` on it. A substring count over a
99-byte refusal is **0**. So is every other pattern. ⇒ ⭐⭐⭐**the instrument returned a uniform,
plausible-looking, entirely fabricated census** — and it pointed at the alarming answer ("zero
coverage"), which is the direction most likely to get reported.

⚠️**`rc` was available and I ignored it.** I had already learned this exact lesson one turn earlier on
a *different* command (`script | tail` reporting `tail`'s status, giving a false `RC=0` for a script
whose contract is its exit code) — and then dropped the rc check when I switched from shell to Python.
⇒ **a guard learned for one invocation shape does not transfer itself to the next.**

## The checks

- ✅**Pass `--allow-escape-sequences`** whenever fetching Actions job logs via `gh api`. Actions logs
  routinely contain ANSI colour.
- ✅**Assert a floor on payload size before parsing:** `if rc != 0 or len(log) < 10_000: FAIL loudly`.
  A real slang-rhi job log is **194 KB–455 KB**; anything in the tens of bytes is a refusal or an
  error page, never data.
- ✅**Range-check the census for impossibility, not just for plausibility.** *"A macOS runner reports 0
  CUDA device-skips"* is impossible; that beats any consistency check.
  ⭐**Uniformity across heterogeneous inputs is itself the tell** — 9 legs on 4 OS/arch combos
  returning byte-identical figures is a broken instrument, not a finding.
- ⛔**Never `.count()` a subprocess's stdout without checking its return code first.** A count cannot
  distinguish *"pattern absent"* from *"no text to search."*

Cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (same family: a failed step upstream
turns the next measurement into a confident zero), [[feedback_a_measured_zero_is_not_a_read_zero]],
[[feedback_control_the_instrument_not_the_reasoning]], and
[[feedback_a_doctest_tally_counts_device_skipped_cases_as_passed]] — which is the *other* instrument
defect on this same run, in the opposite direction (that one over-reports coverage; this one
under-reports it to zero).
