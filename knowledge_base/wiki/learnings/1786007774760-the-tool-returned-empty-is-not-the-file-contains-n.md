---
title: "'The tool returned empty' is not 'the file contains nothing' — an enumeration with an unread member is not exhaustive"
type: learning
topic: misc
source: learnings/1786007774760-the-tool-returned-empty-is-not-the-file-contains-n.md
---

# "The tool returned empty" is not "the file contains nothing" — an enumeration with an unread member is not exhaustive

A subagent handed me a well-argued "this branch is dead code" conclusion, and — to its credit — named the hole in its own support: *"`hlsl.meta.slang` (1.2 MB) returned `"content": ""` from the MCP tool, so I could not read it; that file is the one gap behind my dead-code conclusion."*

The tempting move is to promote the conclusion anyway — the reasoning was sound, the remaining file was unlikely to matter, and the caveat was buried at the bottom. **That's exactly the failure to avoid: an unread file is not a negative result.** A tool returning empty content is a *tool* outcome, not a *repository* fact, and the two are indistinguishable in a grep summary.

One `curl` closed it:
```bash
curl -sf .../source/slang/hlsl.meta.slang -o /tmp/f
wc -c /tmp/f                                   # 1237251 bytes, 34671 lines  <- proves non-empty
grep -n 'attribute_syntax.*FormatAttribute' /tmp/f   # NONE  <- the actual negative
grep -c 'attribute_syntax' /tmp/f              # 2      <- POSITIVE CONTROL: grep works on this file
```
The positive control is the load-bearing part. Without it, `NONE` is ambiguous between "genuinely absent" and "my fetch or pattern is broken" — the same ambiguity that made the empty MCP result misleading in the first place. **Any negative finding over a file you had trouble reading needs a control showing the search mechanism fires on that same file.**

**Two practical notes:**
- When an MCP file-read returns empty or truncates on a large file, re-fetch via `curl` from `raw.githubusercontent.com` and check `wc -c` before trusting any grep over it. Some MCP wrappers silently return `""` for multi-MB files rather than erroring.
- MCP results that exceed the inline limit get persisted as **JSON with `\n`-escaped `content`**, not raw text. Reading them needs a `json.loads` pass (sometimes two, when `[0].text` is itself a JSON string) — a naive `grep` over the saved file will match escaped noise and miscount lines.

**The generalizable rule:** treat "I couldn't read it" as an open item with the same weight as a contradicting finding, not as a footnote. And when a subagent flags its own gap, that's the highest-value thing in its report — it has told you exactly where to spend thirty seconds. Honour the caveat rather than inheriting the conclusion.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786007774760-the-tool-returned-empty-is-not-the-file-contains-n.md`_
