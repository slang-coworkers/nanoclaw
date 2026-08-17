---
title: "-dump-ir survives a Slang ICE — don't budget a Debug rebuild to see pre-crash IR"
type: learning
topic: slang-compiler
source: learnings/1786195182285-dump-ir-survives-a-slang-ice-don-t-budget-a-debug-.md
---

# -dump-ir survives a Slang ICE — don't budget a Debug rebuild to see pre-crash IR

**Rule:** A Slang internal error (`E99997`) does **not** foreclose `-dump-ir`. The per-pass dumps already written to stdout survive the throw, so a **Release** build gives you the pre-crash IR. Don't schedule a 15-25 min Debug rebuild to investigate an ICE's IR shape until you've tried the dump on the binary you already have.

**Measured 2026-08-08, base `716ec597fc`, Release slangc.** An ICE in `slang-ir-typeflow-specialize.cpp` yielded **15 pass dumps** before the throw (`### LOWER-TO-IR:` … `### AFTER specializeModule:`), which was enough to identify the producer. I had told my parent this would need a Debug rebuild; that was wrong and the Release dump answered it in ~2 minutes.

```bash
slangc repro.slang -target cpp -entry computeMain -stage compute -dump-ir -o /tmp/out.cpp > dump.txt 2>&1
grep -n "### " dump.txt        # pass boundaries; the LAST one is where it died
```

**The high-value comparison is first-dump vs last-dump.** If the malformed shape is already present in `### LOWER-TO-IR:`, the pass that throws is only *tripping over* it, not *creating* it — so the fix belongs upstream. That single check answers "producer bug or missing case in the consumer?", which is otherwise argued from source-reading alone.

**Pair it with a one-character control.** I diffed the failing spelling against a clean one differing by one token (`IV.dzero()` → `V.dzero()`) via `sed`, dumped both, and compared the *same* named pass. The clean run had no call at all at that point (resolved + DCE'd) and continued to 77 passes vs 15. Comparing the same pass name across two runs is what makes the delta attributable to the call site rather than to global differences.

**Traps:**
- The last `### AFTER <pass>:` header names where it died — useful, but the *first* dump is what identifies the producer.
- Don't read a module-wide inst count as a fact about your call site. I saw 467 `specialize` insts and nearly concluded one wrapped my call; tracing the actual callee showed it was a `lookupWitness` at every pass — which is *why* the existing diagnostic couldn't fire. Check the specific object, not the population.
- Per repo docs: always pair `-dump-ir` with `-target` (compilation stops early otherwise) and `-o <file>` (otherwise target code mixes into stdout with the IR). `extras/split-ir-dump.py` splits large dumps per pass.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786195182285-dump-ir-survives-a-slang-ice-don-t-budget-a-debug-.md`_
