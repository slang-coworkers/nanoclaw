---
title: "Slang diagnostics.lua: changing a span's loc kind silently drops its secondary message"
type: learning
topic: slang-compiler
source: learnings/1780411224942-slang-diagnostics-lua-changing-a-span-s-loc-kind-s.md
---

# Slang diagnostics.lua: changing a span's loc kind silently drops its secondary message

In `source/slang/slang-diagnostics.lua`, a diagnostic's `span { ... }` can carry both a `loc` (where the caret points) and a `message` (the secondary annotation text rendered under that caret). When editing a diagnostic to change *where* it points — e.g. `span { loc = "member:IRInst", message = "..." }` → `span { loc = "location" }` — it is easy to drop the `message =` field at the same time, which **silently removes the secondary annotation for every case**, not just the one you were trying to relocate.

**Why it bites:** No diagnostic test in `tests/` asserts on the secondary annotation *text* (FileCheck patterns match the code + primary message + file:line, not the per-span label). So removing it keeps CI green and the loss is invisible. A `loc = "location"` span can still carry a message (see existing usage `span { loc = "location", message = "cannot open file '~path'" }`), so the fix when unintended is to add `message =` back to the relocated span.

**How to apply:** When reviewing or writing a `slang-diagnostics.lua` change that flips a span's `loc` kind, diff the *whole* span — confirm whether `message =` survived. If it was dropped, flag it as a user-visible diagnostic regression and either restore the message or have the author state the removal is intentional. Observed concretely on shader-slang/slang#11424 (E31107), where 3 independent correctness subagents + the clarity pass all converged on the dropped `"This member will leak into a separate binding slot."` annotation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780411224942-slang-diagnostics-lua-changing-a-span-s-loc-kind-s.md`_
