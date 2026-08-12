# A competent enumeration over the wrong population is confidently wrong — and peer agreement is not corroboration

Before enumerating, name the **population** the question is actually about, then pick an instrument that can see all of it. A grep matching one *edge* of a relation cannot answer a question about that relation's *closure*, and it fails **silently** — returning a plausible, well-formed, wrong list rather than an error.

**Case (shader-slang/slang#12342 / PR #12353, 2026-08-05).** The same defect three times in one session, each time producing a confident wrong answer:

| # | Question actually asked | Population enumerated | Missed |
|---|---|---|---|
| 1 | Which classes implement `IDownstreamCompiler::validate`? | subclasses of `DownstreamCompilerBase` | `LLVMDownstreamCompiler` — implements the **interface directly**, bypassing the base |
| 2 | Which concrete classes carry the `link` default? | `grep "public DownstreamCompilerBase"` | `GCCDownstreamCompiler`, `VisualStudioDownstreamCompiler` — **two levels down** via an abstract intermediate. Also listed the *abstract* `CommandLineDownstreamCompiler` as concrete and counted the base as its own subclass |
| 3 | Where is the `link` default *defined*? | assumed `DownstreamCompilerBase` | it is on **`IDownstreamCompiler` itself** — an interface with a non-pure default body |

**The instrument defect is identical each time: a one-level pattern match answering a transitive question.** `grep "public Base"` finds *direct* inheritors by construction; it cannot see a concrete class two levels down, and it returns a tidy list instead of an error, so the blind spot silently becomes a claim about the codebase.

**⭐ Error 3 mattered most, because mislocating a default mislocates the entire finding.** When a default body lives on the **interface**, every implementor that doesn't override it inherits it — including direct implementors that touch the base not at all. That is exactly *why* the LLVM case existed; attributing the default to the base made its own counterexample look anomalous instead of predicted.

**⭐⭐ Peer agreement is NOT corroboration when everyone used the same instrument.** Four independent actors (two coworkers, an automated reviewer, and a supervising tier) all produced version 1's wrong set, because all four enumerated base-subclasses for an interface-implementor question. Agreement felt like verification and was actually a shared blind spot. Ask *did we use different instruments?* before treating concurrence as evidence.

**How to apply:**
- State the population in the question's own words: *"implementors of interface I"* is a different set from *"subclasses of base B"* — and `B` is usually just one member of the former.
- **Traverse, don't pattern-match.** Level 1: direct inheritors. For each, ask whether it has children; recurse. Confirm leaves are leaves (`grep -rl "public <Class>"` → 0 files).
- Classify before counting: **abstract** classes are *conduits*, not carriers (look for `= 0;` in the body); the declaring class is not a subclass of itself.
- For "who implements/overrides X", grep the **member signature** across the tree rather than the inheritance clause — that finds implementors regardless of hierarchy position.
- **Exclusions are the highest-value claims to double-check** — each asserts a negative, and a wrong exclusion is invisible in the output.
