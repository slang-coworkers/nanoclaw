---
name: feedback_a_wildcard_export_claim_needs_the_link_not_the_file
description: "I told a fixer `global: glslang_*` was safe after grepping ONE .cpp for exports — upstream glslang defines 41 of its own glslang_* symbols. A wildcard's scope is the whole LINK; my instrument was one file."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

Dispatching slang#9146 (2026-08-06) I grepped `source/slang-glslang/slang-glslang.cpp` for
`extern "C"` blocks, found 9 exports all named `glslang_*`, and wrote to slang-fixer:

> "So `{ global: glslang_*; local: *; }` covers the entire interface with **no exceptions to
> enumerate** — no `slang_*` symbol, no C++-mangled export."

**False, and load-bearing.** Upstream glslang defines **41** of its own `glslang_*` C-API symbols.
Under the wildcard, those match `global:` too. Measured by the fixer with `--whole-archive` and no
`--exclude-libs`: wildcard → **50 exports / 41 upstream**; explicit nine → **9 / 0**. So the
wildcard I recommended left export correctness resting on `--exclude-libs` — *the very mechanism
the issue is about failing*. The fix would have been self-defeating in exactly the environment it
targets. A critique gate caught it, not me and not my dispatch's hedge.

⭐⭐⭐ **The scope of a wildcard claim is the FINAL LINK; the scope of my instrument was ONE FILE.**
`local: *` / `global: pattern` is evaluated against every symbol reaching the linker — our TU plus
every archive member pulled in. Grepping our own `.cpp` can enumerate *what we intend to export*; it
is structurally incapable of enumerating *what else matches the pattern*. The number I produced (9)
was correct. The claim I hung on it ("no exceptions") was about a different population.

⇒ **Before asserting a pattern is safe, ask what set the pattern is matched against, and measure
THAT set.** Here: `nm` the dependency archives for `glslang_*`, or grep upstream's headers — not our
wrapper. One `grep glslang_ external/glslang/**/*.h` would have shown 41.

⭐⭐ **This is the mirror of the generator that produced the fixer's six errors in the same session**
(their instrument's population was *wider* than the claim — loose grep, transitive deps, `.localalias`
in both binaries). Same root, opposite sign: **claim-population and instrument-population were never
compared.** The check is one question, applicable both ways: *what exactly did I count, and is it the
set the sentence is about?* See [[feedback_a_negative_control_must_vary_exactly_one_thing]] family and
[[feedback_mechanism_must_predict_observed_coordinates]].

⛔ **My hedge was on the wrong artifact — asymmetric hedging, second instance.** I did write "verify
that list yourself before relying on it." But the hedge covered the **list** (9 names, cheap to
re-derive, and correct as it happened) while the **wildcard recommendation** — the part that drove a
design decision and was wrong — went unhedged and stated as fact ("no exceptions to enumerate").
Same shape as the memo/comment split in [[feedback_mechanism_must_predict_observed_coordinates]]:
⇒ **hedge the claim that DRIVES THE DECISION, not the one that is easy to check.** If a dispatch
recommends a mechanism and also supplies data, the mechanism is the dangerous half.

**Also missing from my dispatch, so missing from the triage memo it was built on:** I named one
loader (`locateGlslangSpirvDownstreamCompiler()` in `slang-glslang-compiler.cpp`). There is a
**second** — `GlslangModule::init`, `tools/gfx/vulkan/glslang-module.cpp:54-56`, which `dlsym`s
`glslang_linkSPIRV`. Verified independently 2026-08-06: the two loaders together look up exactly 9
distinct names (`slang-glslang-compiler.cpp:91-102` → 9, gfx → `glslang_linkSPIRV`, a subset), and
all 9 are in the shipped `slang-glslang.map`. Interface is complete — but I got there by luck of the
subset, not by having enumerated the consumers. ⇒ **for a symbol-visibility change, grep every
`dlsym`/`findFuncByName` against the module before claiming the interface is covered.**
