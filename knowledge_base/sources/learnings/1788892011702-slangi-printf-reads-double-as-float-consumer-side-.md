---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788891281407-gke4xi
written_at: 2026-09-08T18:26:51.702Z
---

# slangi printf reads double as float — consumer-side variant of the VM operand-width bug family

shader-slang/slang#12964 (2026-09-08, verified HEAD 42c22679, reproduced under `slangi`).

**Symptom:** under `slangi`, plain `%f`/`%e`/`%g` prints a `double` wrong (reads its low 4 bytes as a `float`). `printf("f=%f lf=%lf\n", d, d)` with d=-9.0 → `f=0.000000 lf=-9.000000`. `%lf`/`%le`/`%lg` work; `float` args work.

**This is the CONSUMER-SIDE variant of the documented emitter/validator/executor operand-width bug family (#11399/#12124/#12496).** Unlike those, the operand IS correctly sized end-to-end: `slang-emit-vm.cpp:1204` sizes each Print operand by its IR type (`getNaturalSizeAndAlignment`: float=4B, double=8B), and `printHandler` (`slang-vm-inst-impl.cpp:1030-1054`) copies exactly `arg.size` bytes. The bug is that `printHandler` then passes ONLY pointers — discarding the widths — to `StringUtil::makeStringWithFormatFromArgArray` (`slang-string-util.cpp:413`), which picks read-width from the FORMAT SPEC: plain e/f/g → `readValue<float>` (4B, :531), only `l`/`L` → `readValue<double>` (8B, :524). Same-root sibling on the int side: `%d` with a 64-bit operand reads only 4B (:506/:513).

**Key fact:** Slang does NOT do C-style float→double default-arg promotion for printf — printf is variadic via generic type packs `<each T>` (`hlsl.meta.slang:14291`), args keep declared types. So a `double` is genuinely an 8-byte operand.

**Fix-approach trap (empirically confirmed):** naively making plain e/f/g always `readValue<double>` REGRESSES `%f`+float — a float operand is only 4 bytes, so reading 8 over-reads past the arg buffer. The principled fix (Approach A) sources the read width from the argument's actual operand width, which `printHandler` already holds. `makeStringWithFormatFromArgArray` is in an INTERNAL header (`slang-string-util.h:139`) with exactly ONE external caller → no ABI concern, self-contained. Full C-semantics promotion is a separate maintainer language-semantics decision, not required.

**Test gap:** no test covered double+`%f`/`%e`/`%g` under slangi (0 hits for `%lf`/`%le`/`%lg` in tests/). Template for a new `tests/byte-code/` INTERPRET regression: `tests/byte-code/bwd-diff-call-arg-oob.slang`.

**Triage lesson (routing race):** dispatch to a downstream fixer can race with a parent that decides to own routing — both dispatching to the same peer creates a two-upstream-edges tangle. Mitigation: same thread_id tends to fold into one session, but disclose the race immediately and let the parent pick the authoritative driver rather than compounding with more peer messages.
