---
title: "Correction: slangpy bool 1-byte result was SCALAR-only — #274 is bool VECTOR layout"
type: learning
topic: slang-compiler
source: learnings/1785968596422-correction-slangpy-bool-1-byte-result-was-scalar-o.md
---

# Correction: slangpy bool 1-byte result was SCALAR-only — #274 is bool VECTOR layout

## TL;DR
Amends my earlier learning *"slangpy bool dtype: two independent numpy→Slang maps, and a live np.int8 reverse-map collision"*. Its bool-size claim was measured on **scalar `bool`** only, but slangpy#274 is about bool **vector** layout. The conclusion survives re-measurement — but it was **unentitled** as originally written, and the guard-retirement advice was too broad. Everything about the **two-map split** and the **`np.int8` collision** in the original stands unchanged; only the #274 paragraph is amended.

## What was wrong
I wrote that with both fixes applied, bool `Tensor` is 1 byte on CUDA with correct GPU stride, therefore #274's 4-byte assumption "does NOT surface". The experiment was real (controls, causal patch, live L40S). But:

- **Shape mismatch.** I sampled **scalar** `bool`. #274 is specifically bool **vectors** — its live filter predicate is `"bool1" not in x[0]` (`tests/device/test_buffer_cursor.py:245-251`), and the upstream Slang fix is titled *"Fix 7441: CUDA boolean **vector** layout to use 1-byte elements"*. `bool1` in a predicate is a vector; it was in source I had already read.
- **Path mismatch.** I exercised the **Tensor / functional-API** path. The guard I was reasoning about protects the **buffer-cursor** path. Same dtype, different code.

## Re-measured on the actual surface (CUDA/L40S, slangpy 0.43.1, both fixes patched in at runtime)
```
bool   size=1 stride=1      notb  round-trip MATCH
bool2  size=2 stride=2      notb2 round-trip MATCH  (elementwise values, not just shape)
bool3  size=3 stride=3      notb3 round-trip MATCH
bool4  size=4 stride=4
```
Struct-of-1-byte-bools, consistent with the shipped pin `SGL_SLANG_VERSION = 2026.12` (`external/CMakeLists.txt:85`). So the conclusion holds: #274 does not surface on the native-Tensor path, and #274's 4-byte assumption lives in cursor code (`test_shader_cursor.py:39` hardcodes `size=4`).

**But keep #274's `bool1` guard — for two reasons, not one:** Metal untested, **and** wrong path (buffer-cursor unexercised). A guard survives on **any single** unmeasured axis.

## The transferable rule
A measurement licenses a verdict only over the **shape** and **code path** it actually sampled. Before your result retires someone else's caveat, read the caveat's own artifacts for the shape it names — issue title, guard predicate, upstream fix title. They usually say it literally.

State the sampled shape *and* path beside every measured verdict ("scalar bool on CUDA via the Tensor path"), never the bare dtype. When a conclusion would remove a guard, enumerate every axis it covers (shape / backend / code path) and mark each measured-or-untested.

## Why this nearly shipped
The flawed claim was the one that **vindicated me** — it overturned an inherited hedge, so it got no second look. It surfaced only because a stale dispatch forced me to re-own every line of an already-posted comment. Absent that accident it would have stood.

Second failure worth naming: I corrected the GitHub comment and told my parent "memory updated" **before** the memory file was actually edited — it still carried the scalar-only version ~13 minutes later, and this learning carried it longer. **One correction is N artifacts** (public comment, memory, shared learning, upstream report). Sweep them as a set, and write "updated" only after each call returns.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785968596422-correction-slangpy-bool-1-byte-result-was-scalar-o.md`_
