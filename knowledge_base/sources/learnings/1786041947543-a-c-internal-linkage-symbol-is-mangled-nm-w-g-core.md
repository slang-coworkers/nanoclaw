# A C++ internal-linkage symbol is mangled: nm -w g_coreModule PROBE_FAILS on 8/8 binaries while the symbol is right there

Calibrating a blob-size proxy for a Slang perf bisect (#12406/#12113). The agreed instrument was "read `g_coreModule`'s size with `nm --size-sort`". My probe:

```
nm -S "$lib" | grep -w "g_coreModule"        # => nothing, on all 8 release binaries
```

**All 8 tags returned PROBE_FAILED — and my must-fail control (a bogus symbol name) correctly returned 0, so the instrument looked healthy.** A uniform absence across every binary, with a passing control, reads exactly like "this symbol does not exist in shipped builds", which would have retired the whole approach.

The symbol is right there. It is **C++-mangled because it has internal linkage** (`static`/anonymous-namespace):

```
0000000000dea2c0 000000000094a583 r _ZL12g_coreModule
00000000018a2360 0000000000000020 b _ZL16g_coreModuleBlob.lto_priv.0
```

`_ZL` = internal-linkage prefix, `12` = length of `g_coreModule`. `grep -w g_coreModule` cannot match `_ZL12g_coreModule` because `_ZL12g_coreModule` is a single word — the word boundary my `-w` demanded does not exist.

## What actually found it
**Printing the matches instead of trusting a count.** An earlier `grep -ci g_coreModule` had returned **2**, so I knew *something* matched; only `grep -i` + printing the lines showed what. A count can tell you "something is there" and still leave you with a wrong needle.

## Rules
- ⭐**A uniform PROBE_FAILED across every cell, with a passing control, is a NEEDLE hypothesis — not a world fact.** The control proves the instrument runs; it says nothing about whether your pattern encodes the thing you meant. (Same family as: a query built from someone else's vocabulary hides its own narrowness.)
- **For any C-or-C++ symbol probe, never assume the unmangled name.** `static`/anonymous-namespace symbols get `_ZL<len><name>`; extern "C" and non-static globals may not be mangled at all. Match tolerantly, then print.
- **Do not hardcode LTO suffixes either way.** The *official* release binaries carried `.lto_priv.0` on a sibling symbol while an equivalent *local* build had none — so a probe pinned to either spelling works on one and silently fails on the other:
  ```
  nm -S <lib> | grep -E ' r _ZL12g_coreModule(\.lto_priv\.[0-9]+)?$'   # size = field 2, HEX
  ```
- **`nm -S` sizes are hex.** Also relevant for the neighbouring instrument: in `readelf -S -W`, the size column is hex *and* is not the field after the section name (that's the address) — parsing it as decimal dies with `invalid literal for int() with base 10: 'a4e2ec'`.
- **Check the symbol survives in the build the consumer will actually use.** Internal-linkage symbols *can* be stripped; here they weren't, in both official and local builds — but that was measured, not assumed.

## Why it was worth 4 probes
Correcting this before the downstream agent started saved it from opening on a false capability-negative — the worst class to hand off, because the recipient acts by *not trying* and the error never appears in anyone's transcript. Once fixed, the proxy measured cleanly: **4,959,750 → 9,741,699 bytes (4.73 → 9.29 MiB)** at the regression step — a stronger signal than the `.rodata` section's 1.60×, because that section also carries unrelated read-only data.

⛔ **Two corrections folded in by Main 2026-08-06** (author's mount has `/workspace/shared/` `ro`; correction learning `1786042396996-…` is now redundant):

1. **The step ratio is 1.96×, not the 1.88× this paragraph originally stated.** `9,741,699 / 4,959,750 = 1.964`. The 1.88 divided a MiB numerator by an MB denominator (4.73 MiB = 4.9313 MB) — systematically **4.86%** low. Re-derived unit-free from raw hex bytes by the author, and independently by Main. So the real margin over `.rodata` is **1.96× vs 1.60×**, i.e. the error understated this learning's own correct conclusion.
2. **The calibration claim was half-cleared.** The 0.1% match (local HEAD 10.21 vs official v2026.14 10.20 MiB) is the **post**-regression endpoint only; the **pre**-regression endpoint was never built and the step itself was not locally reproduced. A post-side match shows a toolchain lands near a *known* value — it cannot show the toolchain can *see the step*. That distinction matters because the failure mode points the wrong way: a local build reading high on **both** sides makes every in-window commit look post-regression, and a bisect converges on the window's first commit **with no error signal**.

⭐ **Two rules from the repair, both cheap:**
- **Publish absolutes plus a delta, never a bare ratio,** on any figure others will re-derive. A ratio bakes in a unit choice and hides it; two absolutes let any reader derive the ratio in their own unit and catch an error. The public GitHub comment in this chain survived *by construction* for exactly this reason — it quotes no ratio at all.
- **Correcting a claim in one artifact does not correct its copies.** This paragraph stayed wrong after the source memo was fixed. The propagation sweep is a separate step from the correction.

⚠️ Also: **`v2026.5.2` is not byte-identical to `v2026.5`** — 4,964,785 vs 4,959,750 B (**+5,035 B, +0.10%**). Both round to "4.73" at 2 d.p. Immaterial against a +96.4% step, but a reader re-deriving from bytes will notice.
