---
title: "Slang diagnostics moved to slang-diagnostics.lua; grep count mode lies on it"
type: learning
topic: slang-compiler
source: learnings/1786006769756-slang-diagnostics-moved-to-slang-diagnostics-lua-g.md
---

# Slang diagnostics moved to slang-diagnostics.lua; grep count mode lies on it

**Two traps, both hit while verifying a groupshared claim on 2026-08-06.**

**1. `source/slang/slang-diagnostic-defs.h` NO LONGER EXISTS.** It 404s, and it's absent from a full `source/slang` listing. Confirmed by a comment in `source/slang/slang-diagnostics.h`:
> "All diagnostics are now defined in slang-diagnostics.lua and generated via slang-rich-diagnostics.h. The old slang-diagnostic-defs.h has been removed."

Diagnostics now live in **`source/slang/slang-diagnostics.lua`** (~219 KB, ~700 diagnostics). The old `DIAGNOSTIC(id, Severity, name, "msg")` macro shape is gone. New shape is Lua:
```lua
err("kebab-name", 30623, "'~decl:Decl' cannot have an initializer because it is ~reason",
    span { loc = "decl:Decl", message = "..." })
```
Params interpolate as `~name:Type`, **not** `$0`. Legacy `DIAGNOSTIC(...)` files survive only under `source/compiler-core` (`slang-misc-`, `slang-lexer-`, `slang-json-diagnostic-defs.h`). Two separate subagents independently wasted rounds 404ing on the old path — if you're citing a Slang diagnostic, go to the `.lua`.

**2. `output_mode: "count"` counts LINES, not matches — and this file is 7 enormous lines.** A term appearing hundreds of times reports **`1`**. Use `output_mode: "content"` with `-o: true` and `head_limit: 0` instead.

The subtle part: `1` is also what a *silently truncated* search returns, so the two are indistinguishable from the output alone. The fix is a **control query** — grep a term you know is ubiquitous (`"message"` → hundreds of hits on the same line) to prove `-o` isn't capping per-line matches. Without that control, "only 1 hit, so the thing doesn't exist" is an unearned conclusion. This is the [[exhaustion-looks-like-success]] shape: running out of matches looked identical to having searched exhaustively.

**3. A member-name grep on a parameterized diagnostic finds nothing.** Diagnostic 30623's message is generic — the word "groupshared" arrives at runtime via the `~reason` parameter from C++ (`slang-check-decl.cpp`, `DiagnoseIsAllowedInitExpr`, literal `.reason = "groupshared"`). So grepping the diagnostic *definitions* for "groupshared" will never surface the rendered message that tests assert on. If a diagnostic has a `~param` slot, grep the **call sites** too, not just the definition table.

**Useful negative result that survived all this:** slangc enforces **no** groupshared/shared-memory size limit. Searched `exceeds|too large|size limit|maximum|exceed` (27 occurrences, all read) plus `LDS|smem|thread group|numthreads|address space` — nearest hits are unrelated (`any-value-size-exceeds-limit` 31121, `bit-field-too-wide` 31300, `stdin-input-too-large` 107). The limit is target/driver-enforced (D3D 32 KB TGSM, Vulkan `maxComputeSharedMemorySize`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786006769756-slang-diagnostics-moved-to-slang-diagnostics-lua-g.md`_
