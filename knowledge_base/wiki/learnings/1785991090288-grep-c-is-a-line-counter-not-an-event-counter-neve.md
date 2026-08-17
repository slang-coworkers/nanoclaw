---
title: "grep -c is a LINE counter, not an event counter — never publish it as 'N errors'"
type: learning
topic: misc
source: learnings/1785991090288-grep-c-is-a-line-counter-not-an-event-counter-neve.md
---

# grep -c is a LINE counter, not an event counter — never publish it as "N errors"

**Rule:** `grep -c '<pattern>' log` counts *matching lines*, which is almost never the number of *events* you want to report. Never publish its output as "N errors" / "N warnings" / "N occurrences" without a second command that pins what those lines actually are.

**How it bit us (slang#12371, 2026-08-06):** reporting a compile's SPIR-V validation failure, I ran `grep -c 'Capability Linkage' cellA.txt` → **3** and reported "3 `Capability Linkage` errors". A peer tier had published **2** for the same cell at the same commit. Reconciling showed *both figures were wrong as stated*. The three lines were three different KINDS of output:

```
:13  error: line 1: Capability Linkage is not allowed by Vulkan 1.4 specification   <- the actual diagnostic
:14    OpCapability Linkage                                                         <- echo of the offending inst INSIDE that diagnostic
:21                 OpCapability Linkage                                            <- an occurrence in the disassembly dump
```

Actual validator errors objecting to Linkage: **1**. `grep -c '^error: line .*Capability Linkage'` → 1.

**Why it's dangerous specifically:** this is the instrument-validity tell — *output formatted identically whether or not it measured the thing you claimed*. `grep -c` returns a plausible small integer for any pattern against any file, so no downstream step fails when the number means something other than its label. A tool that errored on a bad pattern would be safer.

**How to apply:**
- Anchor the pattern to the diagnostic's own line shape when counting diagnostics: `grep -c '^error: '`, `grep -cE '^(error|warning)\[E[0-9]+\]'` — not a bare substring that also appears in echoes, disassembly, source quotes, and context lines.
- Compilers echo the offending source/instruction *inside* the diagnostic, so any substring shared by the message and the echo double-counts by construction. Same for `-C`/`-A`/`-B` context and any dump in the same stream.
- Sanity-check before publishing: `grep -n` (not `-c`) and LOOK at the lines. Three seconds; it is what caught this.
- **Best fix for a derived figure nothing depends on: delete it.** "exit 255, no output, rejected for `OpCapability Linkage`" carries the whole argument with nothing to get wrong. A number no downstream step consumes is exactly where unverified arithmetic hides.
- Extra cost when it's public: two bot tiers publishing different counts of the same measurement discredits every correct figure next to them. If you do keep a count, say which invocation produced it — different probe shapes legitimately differ.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785991090288-grep-c-is-a-line-counter-not-an-event-counter-neve.md`_
