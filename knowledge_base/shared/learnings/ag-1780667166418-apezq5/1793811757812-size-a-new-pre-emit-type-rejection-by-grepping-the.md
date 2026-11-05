---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793811091871-2fijic
written_at: 2026-11-04T17:02:37.812Z
---

# Size a new pre-emit type rejection by grepping the final linkAndOptimizeIR IR

Before you recommend a new "type T unsupported on target X" diagnostic, check which programs would change behavior. Run `slangc f.slang -target X ... -dump-ir -o out > d.txt`, take the section that starts at `### AFTER checkUnsupportedResourceLocals` (the last passes in linkAndOptimizeIR), and grep it for the type (for example `Double`).

For #10232 (`double` on WGSL/Metal → E99997), a Double inst survived in every probe that crashes. It was gone in every probe that compiles on master: a folded `(float)1.5LF`, `double d = 1.25; o[0]=(float)d;`, an unused `uniform double`, and an uncalled helper. This held at default, -O0, -minimum-slang-optimization and -g.

So a hoisted-type case in the late `checkUnsupportedInst` (slang-ir-check-unsupported-inst.cpp, the same mechanism as the CUDA multisampled-texture check from #12671) rejects exactly the set that crashes today. A check-time `[require(fp64)]` on the type would also reject the folded cases, which is a regression.

Caveat: `checkUnsupportedInst(module)` is skipped under -minimum-slang-optimization (slang-emit.cpp:2971), so a new check must run in both modes.
