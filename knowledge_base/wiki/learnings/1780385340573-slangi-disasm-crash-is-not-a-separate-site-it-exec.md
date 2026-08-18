---
title: "slangi `-disasm` shares the run-path crash — NOT a separate site (corrects a prior #11399 learning)"
type: learning
topic: slang-compiler
source: learnings/1780385340573-slangi-disasm-crash-is-not-a-separate-site-it-exec.md
---

# slangi `-disasm` shares the run-path crash — NOT a separate site (corrects a prior #11399 learning)

A prior shared learning (1780332260528-slangi-printf-s…) and the #11399 triage both claimed that
`slangi repro.slang` and `slangi -disasm repro.slang` crash at **different** sites, and that a
runtime print-handler fix would NOT cover `-disasm`. **That is wrong.** Verified against
shader-slang/slang while fixing #11399 (PR #11415):

- `tools/slangi/main.cpp`: under `-disasm` it runs the disassembler, prints it, and **then always
  falls through to create the byte-code runner and execute** the module. There is no early return.
- With line-buffered stdout (`stdbuf -oL slangi -disasm f.slang`), the **full disassembly prints
  successfully** and only THEN does it segfault — i.e. the disassembler is fine; the crash is the
  same `printHandler` over-read during the post-disasm execution.
- Net: ONE runtime fix (printHandler, `source/slang/slang-vm-inst-impl.cpp`) fixes BOTH invocations.
  No separate `-disasm` investigation needed. Don't burn time hunting a phantom disassembler bug.

**Why the earlier hypothesis looked plausible but was wrong:** reading only `slang_disassembleByteCode`
(`slang-vm.cpp`) shows a disasm path that never calls `printHandler`, suggesting a separate site. But
the slangi *tool* disassembles AND then executes — the execution crashes. **Meta-lesson:** when
reasoning about a *tool's* crash, trace the TOOL's top-level flow (`tools/.../main.cpp`), not just the
library entry point whose name matches the flag. Label such cross-path claims as hypotheses and confirm
with a runtime backtrace before treating them as fact.

**How to pin a slangi crash with no debugger** (this env has no gdb/lldb/valgrind; cores pipe to
apport): run `stdbuf -oL -eL slangi -disasm f.slang` — whatever prints before the segfault tells you
how far it got. The disasm output also shows each operand's section label (`str:` = strings section,
`ws:` = working set), which is enough to reason about operand-level bugs.

**Tooling:** clang-format for the per-commit hygiene check installs via
`pip install --break-system-packages clang-format==17.0.6` (repo's `extras/formatting.sh` requires
[17,18); 18.x is rejected as "too new"). gersemi/shfmt may be absent → CI is the formatting authority.

**Discriminator gotcha (VM):** to special-case strings-section operands at runtime, match the section
pointer (`arg.section == &interp.m_stringLitsPtr`), NOT `getType()==String` — `allocReg` in
slang-emit-vm.cpp emits working-set operands without initializing the `type` bitfield, so a non-string
working-set arg can falsely read as String.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780385340573-slangi-disasm-crash-is-not-a-separate-site-it-exec.md`_
