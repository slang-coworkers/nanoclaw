---
title: "Four errors, one shape: we verified a proxy instead of the thing"
type: learning
topic: verification
source: learnings/1785775797519-four-errors-one-shape-we-verified-a-proxy-instead-.md
---

# Four errors, one shape: we verified a proxy instead of the thing

**Context:** shader-slang/slang #12192, 2026-07-22 → 08-03. Four independent errors across two tiers in one chain. They look unrelated; they are the same mistake.

| # | What we checked (the proxy) | What we claimed | Why it carried no information |
|---|---|---|---|
| 1 | `grep` found `SLANG_UNEXPECTED` still in the switch | "PR #12186 never added the diagnostic, so no consumer exists — park" | The abort arm is unreachable for buffer handles; they route out earlier. **Found the sink, never traced the path.** |
| 2 | Emitted SPIR-V byte-identical at `-g1/-g2/-g3` | "the patch is effectless" | `OpLine` emits only from statement-granularity marker insts, so a value-inst `sourceLoc` change *cannot* alter output. **The test could not fail.** |
| 3 | A line number cited by the tier holding the clone | "the fix site is `:2035/:2272`" | Those lines are in two *other* functions — one early-returns for the type in question, one is the matrix path. **Line number stood in for enclosing function.** |
| 4 | A single `total > 0` non-vacuity guard over two assertion sites | "the IR test is non-vacuous" | Site 2 needs an instruction the test input never produces; site 1's count alone satisfies the guard. **Aggregate stood in for per-site coverage.** |

**The generalization:** each check was *real* — it ran, it passed, it produced output. None of them could have come out differently if the claim were false. That is the property to test for, and it is not the same as "did I verify something."

**The reflex to install.** Before treating a check as evidence, ask: *if the claim were false, would this specific check have told me?* If you cannot describe the failing output, you have a proxy, not a verification. Then:

- **Aborts/diagnostics:** trace the dispatch routing to your input; presence in a switch proves nothing about reachability.
- **Golden/output diffs:** confirm the layer can *express* the property. Match assertion layer to contract layer — an IR invariant is asserted on post-pass IR, not downstream of a lossy emitter.
- **Coordinates:** function name is the durable handle; a line number is a cache entry. Never convert a second-hand line into an instruction — demand `function + sha`. (Orchestrator-specific: relaying a specialist's coordinate faithfully still makes it *your* instruction. Requiring the durable handle is your job, not theirs.)
- **Non-vacuity guards:** one counter per assertion site, one revert drill per site. An aggregate guard hides a vacuous half.

**Cost when you don't:** we recommended parking maintainer-authorized work, posted a false claim about the maintainer's own PR, sent an implementer to patch two locations where the fix could not work, and nearly shipped a half-untestable test. The implementer's 6-day silence was downstream of *our* bad coordinates — it was holding on a blocker we manufactured, waiting for a decision that had already been overruled.

**Corollary on blame:** when a specialist stalls after a directive you wrote, suspect the directive before the specialist.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785775797519-four-errors-one-shape-we-verified-a-proxy-instead-.md`_
