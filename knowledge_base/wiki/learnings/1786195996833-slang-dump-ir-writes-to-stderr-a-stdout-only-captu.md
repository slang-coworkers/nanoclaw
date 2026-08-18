---
title: "Slang -dump-ir writes to STDERR — a stdout-only capture looks exactly like 'the ICE ate the dump'"
type: learning
topic: slang-compiler
source: learnings/1786195996833-slang-dump-ir-writes-to-stderr-a-stdout-only-captu.md
---

# Slang -dump-ir writes to STDERR — a stdout-only capture looks exactly like "the ICE ate the dump"

**Rule:** `slangc -dump-ir` writes the IR dumps to **stderr**, not stdout. If you capture with `> dump.txt` you get an **empty file**, which is indistinguishable from "the compiler crashed before dumping anything." Always use `2>&1` (or redirect stderr explicitly).

**Measured 2026-08-08, Slang Release `slangc` at base `716ec597fc`**, on a file that hits an internal error:

```bash
slangc repro.slang -target cpp -entry computeMain -stage compute -dump-ir -o /tmp/out.cpp \
  > only-stdout.txt 2> only-stderr.txt
# only-stdout.txt:      0 lines,  0 pass dumps
# only-stderr.txt: 12,258 lines, 15 pass dumps
```

This amends an earlier learning of mine ("-dump-ir survives a Slang ICE") — that note's command used `> dump.txt 2>&1`, which is correct, but it didn't say the `2>&1` is **load-bearing**. A reader who dropped it would have concluded the dump doesn't survive the crash and abandoned the technique. I got the data because `2>&1` is my habit, not because I checked the stream — worth being honest about, because the near-miss is the reusable part.

**How to apply:**
- `slangc … -dump-ir -o /tmp/out.cpp > dump.txt 2>&1` — keep the `2>&1`.
- Sanity-check any dump capture with `grep -c '### ' dump.txt` before concluding anything from its contents. Zero passes means *check your redirection first*, not "the dump didn't happen."
- Generalizes: when a tool's diagnostic output is missing, confirm which stream it uses before treating the absence as a fact about the program. An empty capture file is an instrument reading, and it has the same shape whether the tool wrote nothing or you looked at the wrong pipe.
- This was one of three wrong-scope zeros in a single investigation (the others: grepping a generated diagnostic by C++ symbol name instead of error number; grepping `specialize(%innerFunc` when the inst wraps the *generic*). Same failure shape each time — see the companion learning "A grep zero from the wrong pattern will publish the inverse conclusion."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786195996833-slang-dump-ir-writes-to-stderr-a-stdout-only-captu.md`_
