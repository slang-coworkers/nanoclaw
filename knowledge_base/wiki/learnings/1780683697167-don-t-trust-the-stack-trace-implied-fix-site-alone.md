---
title: "Don't trust the stack-trace-implied fix site alone — dump-IR the repro"
type: learning
topic: misc
source: learnings/1780683697167-don-t-trust-the-stack-trace-implied-fix-site-alone.md
---

# Don't trust the stack-trace-implied fix site alone — dump-IR the repro

# Don't trust the stack-trace-implied fix site alone — dump-IR the repro

**Source:** Slang triage of shader-slang/slang#11487 (segfault specializing an inherited default interface method called through dynamic dispatch), 2026-06-05.

When a Slang IR-pass crash gives you a stack trace, the call frame nearest the assertion is the most-likely fix site by inspection — but that's a starting hypothesis, not an empirical answer. On #11487, the supplied stack trace pointed at `_replaceInstUsesWith` ← `resolveInst` ← `analyzeCall` (`source/slang/slang-ir-typeflow-specialize.cpp`). The most-likely-by-grep fix site was `specializeLookupWitnessMethod` at `slang-ir-typeflow-specialize.cpp:5777` — its `inst->replaceUsesWith(findWitnessTableEntry(...))` is unguarded and `findWitnessTableEntry` returns nullptr on miss. The triage memo flagged this as the proximate crash and recommended a null-guard there.

The fixer ran `slangc -dump-ir` against the repro and found the *actual* crash at `source/slang/slang-ir-translate.cpp:347` in `specializeWitnessLookup` — a sibling lookup site, also unguarded, also reachable from the same `analyzeCall` path. Fixing the typeflow-specialize site alone would have left this one to crash. The adopted fix introduced a new `findWitnessTableEntryInInheritanceClosure` (cycle-guarded) utility and wired it into **5** dynamic-dispatch lookup sites — including both candidates plus three more I had not located.

**Rule:** for any IR-pass crash, the triage memo should either (a) include a `--dump-ir` step against the repro before committing to a single candidate fix site, or (b) explicitly tell the fixer "verify with `--dump-ir` before picking among the candidates" and rank candidates as hypotheses rather than directing to one. For this subsystem (witness-table lookup in dynamic-dispatch specialization) there are at least 5 unguarded `findWitnessTableEntry` callers, so any "missing null-check" hypothesis is plausibly multi-site. **How to apply:** when triaging a crash whose surface symptom is a witness-table or specialization-pass failure, grep the file family for the suspect lookup pattern and treat all matching call sites as candidate fix sites until `--dump-ir` (or the fixer's own diagnosis) narrows them.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780683697167-don-t-trust-the-stack-trace-implied-fix-site-alone.md`_
