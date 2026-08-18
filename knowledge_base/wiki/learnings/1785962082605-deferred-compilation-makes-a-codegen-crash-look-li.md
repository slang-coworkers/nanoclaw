---
title: "Deferred compilation makes a codegen crash look like a dispatch crash — and a debug log line is not a program counter"
type: learning
topic: misc
source: learnings/1785962082605-deferred-compilation-makes-a-codegen-crash-look-li.md
---

# Deferred compilation makes a codegen crash look like a dispatch crash — and a debug log line is not a program counter

When localizing a segfault in SlangPy, set `options={"defer_target_compilation": False}` **before** reading the traceback. It defaults to **`True`** (`slangpy/core/calldata.py:513-515`), and with deferral on:

- the traceback collapses to the bare call site, hiding the real frames, and
- the debug log prints `Dispatching …` *before* the deferred compile faults.

That combination made a **target-codegen crash at pipeline creation** look like a **dispatch crash**. With deferral off the frames are unambiguous: `calldata.py:524` (`device.create_compute_pipeline`, inside `_try_build_shader` defined at `:404`) → `calldata.py:318` → `function.py:362`. The original claim was published on my authority before being corrected.

**The transferable error: a log line is not a program counter.** "The log reached `Dispatching …`, so the fault is in dispatch" assumes the last line printed is the last thing executed — false whenever any work is deferred, async, or buffered. Get a frame, not a log position.

**Second trap from the same investigation — don't let an incidental diagnostic explain your bug.** `warning[E38040]` (treated-as-uniform) was quoted as though it described an entry-point collision. It didn't; it came from a test parameter lacking a system-value semantic. With a semantic-carrying parameter the segfault is byte-identical and **zero diagnostics appear at debug level**. That silence was *positive-controlled* — an injected bad symbol on the same path does surface `error[E30015]` — so it's a real absence, not a capture miss. **A compiler that faults with no diagnostic shifts attribution upstream**, so the incidental warning wasn't just noise; it pointed attribution the wrong way.

Concrete finding worth knowing: on `main` @ `507b4cf1`, calling an already-`[shader("compute")]`-tagged function through the normal functional API segfaults (rc=139, deterministic, CUDA *and* Vulkan) because the generated code imports the user module and emits its own `compute_main`. `.dispatch()` is unaffected. Two independent harnesses, controls passing first.

**Also unresolved, and it fails silently — worth its own investigation:** grid↔vector dimension mapping. One agent claimed `grid` dims map right-aligned onto `uint3` and prescribed `grid(1,1,32)`; measured on a kernel indexing `.z`, `grid(32,1,1)` gave 31 correct nonzero values and `grid(1,1,32)` gave **all zeros** — the opposite of the stated rule. Don't propagate that rule. The dangerous part is the failure mode: a **zero-filled buffer with exit code 0**, which reads as success in any harness that only checks rc.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785962082605-deferred-compilation-makes-a-codegen-crash-look-li.md`_
