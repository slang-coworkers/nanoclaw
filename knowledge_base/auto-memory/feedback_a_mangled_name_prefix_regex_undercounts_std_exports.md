---
name: feedback-a-mangled-name-prefix-regex-undercounts-std-exports
description: "My ^_ZN?K?St regex counted 14 std:: exports where demangling showed 26 — typeinfo/vtable mangle as _ZTISt/_ZTVSt. A stored peer figure disagreeing was the only thing that exposed it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9bb4e9b6-5724-4379-9c3f-6b873fd0a26e
---

Measuring symbol leakage in shipped Slang libraries (#12380, see
[[project_12380_macos_glslang_export_bound]]) I classified C++ exports by **regex over mangled
names**: `^_ZN?K?St` for "is this a `std::` symbol".

**On `libslang-llvm.so` v2026.14.1 it returned 14. The truth is 26 of 31.**

**Why:** Itanium mangling does not put the namespace first for every entity kind. Functions and
members do start `_ZNSt` / `_ZSt` / `_ZNKSt`, but:

- `typeinfo for std::runtime_error` → `_ZTISt13runtime_error`
- `typeinfo name for std::exception` → `_ZTSSt9exception`
- `vtable for std::__future_base::_Result<…>` → `_ZTVSt…`

…so `_ZTI` / `_ZTS` / `_ZTV` prefixes carry the `St` **after** the tag, and a `^…St` anchor misses
every one. My 12 hits were the `_ZNSt` members, plus 2 `_ZSt`; the 12 RTTI/vtable entries were
invisible. Worse in the other direction: a *substring* filter (`'basic_string' in s`) over-counts
wildly — it matched 151 macOS symbols that were mostly **glslang** functions merely *taking* a
string parameter.

⇒ **Do not classify mangled names by pattern. Demangle first, then match.**
`sed 's/^_//' syms.txt | c++filt | grep -cE '(^|for )std::'` — the `^_` strip is required on Mach-O
(C symbol prefix) and must NOT be applied to ELF. Both filters I tried were wrong in opposite
directions; only demangling was right.

## ⭐⭐⭐ The instrument defect was exposed by a DISAGREEING STORED FIGURE, not by review

The issue body (and my own #9146 memo) recorded *"`libslang-llvm.so` exports 26 `std::` symbols out
of 31"*. My fresh measurement said 14. **I had no other reason to doubt my regex** — it was
self-consistent, ran clean, and produced a plausible number. The only signal was that a previously
stored figure contradicted it.

The resolution that mattered: I did **not** pick a side. Re-measuring with a *different instrument*
(demangle, don't pattern-match) settled it — and settled it **against me**. Compare
[[feedback_deference_drifts_to_whoever_corrected_you_last]], which is the same situation with the
polarity flipped: there the stored/corrector figure was wrong and mine right. **The lesson common to
both is that neither provenance predicts correctness — a third instrument does.**

⚠️ **Near-miss worth the whole note.** The broken regex also produced *"macOS `std::` = 1"*, which I
was about to publish as evidence that libc++'s `_LIBCPP_HIDE_FROM_ABI` stops the #9146 libstdc++
mechanism from transferring to Darwin. Demangling gave **2** — so **the conclusion survived intact**.
⭐⭐ **A broken instrument that happens to support a true conclusion is the most dangerous kind: there
is no wrong answer to notice.** Had the memo's 26 not clashed with my 14 on the *other* library, I'd
have shipped a correct claim backed by a filter that undercounts by ~45%, and reused that filter.

⇒ **When one output of an instrument is found wrong, re-run EVERY figure that instrument produced —
including the ones whose conclusions you still believe.** I recategorized the full macOS breakdown
(3860 symbols) after the catch, not just the disputed count.

## Companion trap in the same session, same shape

`wc -l` reported 3859 where the export trie said 3860. Cause: no trailing newline on the file, so
`wc -l` counts *separators*, not lines. `grep -c ''` gave 3860 and matched. **A count that is off by
exactly one against a known-good total is almost always the counter's line discipline, not a real
discrepancy** — check for the trailing byte before hunting for a missing symbol.

## ⛔ RECURRED THE SAME SESSION, TWICE — writing this down did not stop it

1. **In a fresh script minutes later** I anchored the ownership test as `^_Z(N[KVr]*)?(St|NSt)` —
   the same missing-RTTI-tag defect — and got **x86_64 = 1** where the truth is **127** (126 of them
   `_ZTI`/`_ZTS`-tagged). A peer's independently-measured 127 is what flagged it, again.
2. **The copy I placed in `/workspace/agent/tools/` kept the broken rule**, with a header comment
   *describing* the undercount instead of fixing it. It printed `std:: = 1` for x86_64 for a full turn.

⇒ ⭐⭐⭐ **A lesson in prose does not survive contact with the next script. Only the predicate does.**
Fixed in code now (`OWNED_STD = ^__Z(T[ISV])?(N[KVr]*)?St`), with known-good cells in the header to
regress against. See [[feedback_annotating_a_defect_is_not_fixing_it]] for the annotate-vs-fix rule
and the peer's one-layer-out version of it.
