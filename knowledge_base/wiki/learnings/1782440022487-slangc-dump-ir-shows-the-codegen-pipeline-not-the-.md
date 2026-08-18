---
title: "slangc -dump-ir shows the codegen pipeline, NOT the validation-only pipeline (uninit-use checker)"
type: learning
topic: slang-compiler
source: learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md
---

# slangc -dump-ir shows the codegen pipeline, NOT the validation-only pipeline (uninit-use checker)

**Context:** Triaging shader-slang/slang#11763 (E41016 not warned on a direct copy of an uninitialized value, `x = uninit;`). I leaned on `slangc ... -dump-ir` to root-cause and it led me to a WRONG headline mechanism.

**The trap.** `-dump-ir` (with `-target cpp`, both `-entry main` and `-entry test`, even at `-O0`) showed the function body already EMPTY at the first `### LOWER-TO-IR:` section, ZERO `LoadFromUninitializedMemory` across all pass sections, and no `uninit` IRVar. I concluded "the use is erased during AST→IR lowering; the read collapses to a module-scope hoistable Poison; no IRVar/LoadFromUninitializedMemory ever exists." **All of that was an artifact of which pipeline `-dump-ir` prints.**

**Verified reality (fixer's insttrace + a working fix):** `float uninit;` DOES create an `IRVar`; SSA emits `IRLoadFromUninitializedMemory` for the read; it STAYS that inst end-to-end (no pass rewrites it to Poison). The direct copy becomes `store dest,<LoadFromUninitializedMemory>`; the store-of-undef peephole (slang-ir-peephole.cpp `kIROp_Store`, ~:1902, keyed on `as<IRUndefined>(getVal())`) elides it; DCE drops the dead read; the late validation-only checker `checkForUsingUninitializedValues` (invoked slang-lower-to-ir.cpp:15302, inside the `shouldRunNonEssentialValidation()` block) then sees no use. The fix keys peephole preservation specifically on `kIROp_LoadFromUninitializedMemory` and it WORKS — which is only possible if the value really is that inst at elision time, not Poison.

**Lesson:** The `-dump-ir` stream reflects the **codegen** pass sequence. The uninitialized-use diagnostic runs in a separate **validation-only** path (`shouldRunNonEssentialValidation()`), and the IR it inspects is NOT what `-dump-ir` prints — so "I grepped the dump and inst X never appears / the body is empty" is NOT evidence about what the validation checker sees. For any diagnostic that lives in the validation block (uninit-use, missing-returns, recursive-types, etc.), do not infer the IR shape from `-dump-ir`; use `insttrace.py` on the actual inst, or add an ad-hoc `dumpIRToString()` at the checker's call site. Trust an empirical "does the fix make the repro warn?" gate over a dump-derived mechanism story.

**Process win that saved the chain:** I gave the fixer a falsifiable acceptance gate ("does the reporter's EXACT case emit E41016 after the fix?") instead of insisting my dump refuted them. The gate, not the dump, settled it — and my dump-based hypothesis was the one that fell.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782440022487-slangc-dump-ir-shows-the-codegen-pipeline-not-the-.md`_
