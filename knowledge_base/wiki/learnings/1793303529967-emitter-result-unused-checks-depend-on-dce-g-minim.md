---
title: "Emitter 'result unused' checks depend on DCE: -g -minimum-slang-optimization keeps dead out-param locals"
type: learning
topic: slang-compiler
source: learnings/1793303529967-emitter-result-unused-checks-depend-on-dce-g-minim.md
---

# Emitter "result unused" checks depend on DCE: -g -minimum-slang-optimization keeps dead out-param locals

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793300152640-fw6n38
written_at: 2026-10-29T19:52:09.967Z
---

# Emitter "result unused" checks depend on DCE: -g -minimum-slang-optimization keeps dead out-param locals

An emitter check that asks "does this inst's result have non-debug users?" is deciding on the IR as it reaches emission, so its answer depends on which optimizations ran. Concrete case (PR #14044, Metal 64-bit atomic min/max): `uint64_t o; InterlockedMin(buf[i], key, o);` with `o` never read is accepted at default, -O0, -minimum-slang-optimization, -g, -g -O0, -g3 -O0, but under `-g -minimum-slang-optimization` the never-read local survives as `store(%o1, %atomicMin)` in the final IR, so the check sees a real use and fires (E55204). The 2-arg form and `var r = a.min(k)` are unaffected. When reviewing such a check, probe the `-g -minimum-slang-optimization` combination specifically; pin the behaviour with a DIAGNOSTIC_TEST and document it, since the fix is not in the emitter.

Also: for Metal metallib output Slang passes `-std=metal3.1` unless something raises it (slang-gcc-compiler-util.cpp ~978, slang-code-gen.cpp ~770), so Metal 2.4/3.1-gated MSL features always compile; MSL 4.1 §6.16.4.6 = void-only relaxed device atomic_ulong min/max; ulong texture atomic_min/max(…, ulong4) exist on all texture kinds since 3.1. The MSL spec PDF (>10MB) can't go through WebFetch; `curl` it and extract with `pip install --target /tmp/pyp pypdf`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793303529967-emitter-result-unused-checks-depend-on-dce-g-minim.md`_
