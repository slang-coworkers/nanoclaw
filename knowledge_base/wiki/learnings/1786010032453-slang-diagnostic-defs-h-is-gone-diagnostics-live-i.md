---
title: "slang-diagnostic-defs.h is GONE — diagnostics live in slang-diagnostics.lua (a grep of the old path is a false negative)"
type: learning
topic: slang-compiler
source: learnings/1786010032453-slang-diagnostic-defs-h-is-gone-diagnostics-live-i.md
---

# slang-diagnostic-defs.h is GONE — diagnostics live in slang-diagnostics.lua (a grep of the old path is a false negative)

**Verified 2026-08-06 against shader-slang/slang master.** `source/slang/slang-diagnostic-defs.h` returns **HTTP 404**. So does `source/compiler-core/slang-diagnostic-defs.h`. Any search for a diagnostic id/message in that path returns **zero hits that look exactly like "no such diagnostic exists"** — a false negative, not a negative result.

Diagnostics migrated to a **Lua/FIDDLE generator**:
- `source/slang/slang-diagnostics.lua` — **206,809 bytes / 6,171 lines**, the actual definitions.
- `source/slang/slang-diagnostics-helpers.lua` — 43KB, defines `err()` / `warning()` / `standalone_note()`.
- `source/slang/slang-diagnostics.h` is only 3,541 bytes now (includes + guards; no `DIAGNOSTIC(` macros at all).

**Entry shape** (not the old `DIAGNOSTIC(id, severity, Name, "msg")`):
```lua
warning(
    "parameter-bindings-overlap",     -- the [allow("...")] name
    39001,                            -- the E-code users see
    "explicit binding overlap",
    span { loc = "paramA:Decl", message = "explicit binding for parameter '~paramA' overlaps with parameter '~paramB'" },
    note { message = "see declaration of '~paramB'", span { loc = "paramB:Decl" } }
)
```
**Severity is carried by which helper wraps it**, not by a field: `slang-diagnostics-helpers.lua:436-444` — `err()` → `"error"`, `warning()` → `"warning"`. To answer "is diagnostic N an error or a warning?" you must find the wrapping call, not grep for a severity token.

**Two practical consequences:**
1. The **first string** in the entry is the `[allow("<name>")]` / `-warnings-disable` name; the **number** is the `E`-code in compiler output. A subagent reported the opt-out for 39001 as `[allow("overlapping-bindings")]` — plausible, wrong; the real name is the `name` field `"parameter-bindings-overlap"`. **Read the name field; don't paraphrase the title.**
2. Grepping for `DIAGNOSTIC(` to enumerate diagnostics returns **0** on master. Use `grep -nE '"[a-z-]+",$' slang-diagnostics.lua` or search the id number.

**Method note:** my fetch of the dead path returned a 14-byte body — the literal text `404: Not Found`. I nearly counted that as "searched, found nothing." **Always check the byte count / positive control before treating an empty search as evidence of absence** — a 14-byte "file" and a real 206KB file are trivially distinguishable if you look. Same family as the `hlsl.meta.slang` empty-content trap.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786010032453-slang-diagnostic-defs-h-is-gone-diagnostics-live-i.md`_
