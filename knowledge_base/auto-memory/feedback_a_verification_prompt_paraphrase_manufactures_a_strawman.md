---
name: a-verification-prompt-paraphrase-manufactures-a-strawman
description: "Paraphrasing a claim into a verification prompt makes the verifier refute YOUR wording, not the claim — quote the claim verbatim and never add your own hedge, or you manufacture a correction that outranks the original in apparent rigor."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-05, slang#12342/PR #12353. I dispatched a subagent to verify two coworker code claims, it returned PARTIAL on both, I wrote both downgrades into the chain memo, and I was one step from correcting two coworkers. Both downgrades were wrong. The verifier had refuted MY PARAPHRASE, not their claims.** Caught before dispatch; nothing incorrect was sent.

**What each party actually said vs. what I asked:**
- Reviewer: *"`slang-ir.cpp:8148` is the only site emitting `<disassembly failed>`, and it's a single `else` swallowing every `disassembleWithResult` failure."* — precisely scoped to the call, **TRUE**.
- My prompt: *"contains code that collapses EVERY disassembly failure into a single literal string."* — I widened "every failure **of the call**" to "every **disassembly** failure."
- Verifier, correctly against my wording: `<unavailable disassembler>` (`:8153`) and `<binary blob>` (`:8159`) are distinguishable non-success paths ⇒ **PARTIAL**.
- But those are different **conditions**, not failures of the call: on both, `disassembleWithResult` is never invoked (`:8132 if (compiler)` is the branch that separates them). The reviewer's scope excluded them by construction.

Second instance, same turn: I wrote *"an out-of-line definition of a `getVersionString` **(or `disassemble`)** override"*. Nobody claimed DXC overrides `disassemble`. The verifier dutifully reported that half REFUTED, and I recorded a refutation of **my own hedge** as a correction to a coworker.

⭐⭐⭐ **A verification is only about the claim if the claim reaches the verifier verbatim.** Paraphrase silently substitutes a *different proposition*, and the verifier's rigor then attaches to the substitute. This is worse than skipping verification: the output arrives with file:line evidence, a VERIFIED/REFUTED verdict, and a fresh-measurement provenance that **outranks the original claim in apparent authority** — so it wins the disagreement it has no standing in.

⭐⭐ **Never insert your own hedge, guess, or "(or X)" alternative into a verification prompt.** A hedge is a new claim with no author. When it comes back REFUTED it reads as the coworker having overclaimed, and the correction lands on them. If I am unsure which method is meant, that is a question for the coworker, not a disjunction for the verifier.

⭐⭐ **The tell I should have caught earlier: a PARTIAL whose refuting evidence sits OUTSIDE the claim's stated scope.** Both downgrades cited lines (`:8153`, `:8159`) that the original claim never mentioned. When a verdict's evidence is adjacent-but-outside, suspect the prompt before the claim — and diff the prompt against the source text.

⭐ **Cheap procedure, no extra tool calls:** paste the coworker's sentence in quotes as the claim; add *"verify exactly this sentence as written — if it is ambiguous, report the ambiguity, do NOT resolve it, and do NOT evaluate a broader or narrower version."* Then before acting, diff the verifier's restatement against the quoted sentence.

**What survived and was worth the run:** the two genuine traps at `slang-dxc-compiler.cpp` — the `return SLANG_OK` at `:900` closes **`convert`** (`:860`, and `convert` *is* the DXC disassembly path via `dxcCompiler->Disassemble` at `:892`), and the 20-line `slang-dxc-compiler.h` holds **no class declaration** (body is in the `.cpp` at `:240`), so a header-only search returns nothing and reads as absence — the actual mechanism behind the fixer's `grep -A6` miss. Verification found real things; my framing invented the corrections. See [[project_12342_downstream_absent_capability_slangresult]], and [[feedback_control_the_instrument_not_the_reasoning]] — a subagent is an instrument, and its input wording is part of its calibration.
