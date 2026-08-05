---
title: "Probing a rare race: inject a delay at the suspect window instead of brute-forcing iterations"
type: learning
topic: ci-tooling
source: learnings/1785893649340-probing-a-rare-race-inject-a-delay-at-the-suspect-.md
---

# Probing a rare race: inject a delay at the suspect window instead of brute-forcing iterations

## Context
slangpy#1072 (`sgl` profiler). Question: does the `expected_zone_count` gate in `finalize_ready_frames()` repair the flaky test `frame statistics align repeated and intermittent zones` (test_profiler.cpp:317)? Competing claim: "unrelated timing jitter".

## The trap: 0/N proves nothing when N is underpowered
Straight A/B on unmodified source gave **0 failures out of 4000 base and 4000 fixed** (linux-gcc Release), and 0/200 in Debug — including under `nproc` busy loops and 16x oversubscription. The natural rate is ~0.02%; a single test iteration is **5 ms Release / 26 ms Debug**, so an idle-ish 8-core container is a completely different sampling regime from a loaded CI runner. Reporting "0/200 both ways, fix unproven" would have been a false null.

## What actually worked: widen the suspect window with an env-gated sleep
The hypothesis names a specific window — `drain()` samples the per-thread CPU ring and the sealed-frame queue as two separate snapshots, so a frame marker can be consumed before its zone events. Insert a delay *at that exact point*:

```cpp
if (const char* d = std::getenv("SGL_PROBE_DELAY_US"))
    std::this_thread::sleep_for(std::chrono::microseconds(std::atoi(d)));
```

Env-gated means **one binary serves the whole sweep** — no rebuild per delay, and delay=0 is a built-in control proving the probe itself is inert.

Result: base went 0/30 at delay=0 to **21/30 at 100 us**; the fixed version stayed **0/30 at every delay through 50 ms**. The failing assertions and their *values* matched the CI report exactly (`count 1==2`, `call_count[1] 1==0`, `0==2`), which is what identifies the mechanism rather than merely producing some failure.

## Run the 2x2, not the 1x2 — it localizes which half is load-bearing
The fix bundled two changes (the `expected_zone_count` gate **and** a `drain()` reorder that snapshots sealed frames first). Testing each alone:
- gate only + base ordering → **14/20 fail**
- reorder only, no gate → **18/30 fail**
- both → **0/30**

Neither half suffices; they are jointly necessary. A 1x2 (base vs full fix) would have shown "fixed" and hidden that the gate is only sufficient once the sampling order guarantees the zones were already snapshotted.

## Reusable checklist
- Always positive-control the swapped-in binary: run the tests the fix was *written* for and confirm they FAIL on base and PASS on fixed. Three cases flipped cleanly here, proving neither build was stale.
- `cmake --build --preset linux-gcc-debug` alone does **not** relink `sgl_tests` — a `.pyi` stubgen failure (missing numpy/libcst) aborts ninja before the link and leaves a stale binary that still passes. Use `--target sgl sgl_tests` and compare `stat -c %Y` against a pre-build `date +%s`.
- Caveat to state honestly: an injected delay proves susceptibility and mechanism, **not** the production failure rate.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785893649340-probing-a-rare-race-inject-a-delay-at-the-suspect-.md`_
