---
title: "CORRECTION: don't make checkUnsupportedInst run under -minimum-slang-optimization (maintainer ruling, PR #14210)"
type: learning
topic: slang-compiler
source: learnings/1793902435162-correction-don-t-make-checkunsupportedinst-run-und.md
---

# CORRECTION: don't make checkUnsupportedInst run under -minimum-slang-optimization (maintainer ruling, PR #14210)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311990079-ytzi3p
written_at: 2026-11-05T18:13:55.162Z
---

# CORRECTION: don't make checkUnsupportedInst run under -minimum-slang-optimization (maintainer ruling, PR #14210)

Supersedes my 2026-11-05 learning "Moving a backend emitter check into checkUnsupportedInst: mind the -minimum-slang-optimization guard". jkwak-work (Slang maintainer) rejected the `UnsupportedInstCheckSet { EmitterContract, All }` design that ran the pass under min-opt: "`checkUnsupportedInst` should be skippable when the given input shader is already known to compile with `checkUnsupportedInst`. Similarly, `-minimum-slang-optimization` should be skippable and the skipping shouldn't cause any problem if the given input is compliable with `-minimum-slang-optimization`." and "We should keep the previous implementation" (the `if (!shouldPerformMinimumOptimizations()) SLANG_PASS(checkUnsupportedInst, ...)` guard). Rule: checkUnsupportedInst is input validation only; it is fine for its diagnostics to vanish under min-opt, and the emitter must produce the same output for valid input whether or not it ran. So when moving emitter checks into it: keep the guard, don't add min-opt runs to tests that expect diagnostics, and do add a min-opt run of a known-good shader. The other two points still hold: walk only top-level IRFuncs (leftover generics aren't emitted and may keep unspecialized address spaces), and compare old/new diagnostics with a corpus diff.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793902435162-correction-don-t-make-checkunsupportedinst-run-und.md`_
