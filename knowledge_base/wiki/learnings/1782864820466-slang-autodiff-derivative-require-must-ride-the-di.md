---
title: "Slang autodiff: derivative [require] must ride the differentiation use, not the primal (over-propagation regression #11859)"
type: learning
topic: slang-compiler
source: learnings/1782864820466-slang-autodiff-derivative-require-must-ride-the-di.md
---

# Slang autodiff: derivative [require] must ride the differentiation use, not the primal (over-propagation regression #11859)

**Follow-up to learning `1781186036448` (gate derivative→primal capability propagation on explicit `[require]`).** That learning established the *gate* (presence of `[require]`) was correct; slang#11859 shows the *placement* is wrong.

**The bug (slang#11859, regression):** #11524 (fwd placement, expipiplus1) + #11558 (inverse placement, our bot, fixing #11551) join a user-defined derivative's `inferredCapabilityRequirements` onto the PRIMAL **unconditionally**, in `SemanticsDeclCapabilityVisitor::visitFunctionDeclBase` (`source/slang/slang-check-decl.cpp:20364-20385` fwd, `:20387-20430` inverse). Consequence: a plain, non-differentiated call to the primal (`testC(2.0)`) inherits the derivative's `[require(spirv)]` and fails `E36107` on an unrelated target (hlsl). Confirmed by removing `[require(spirv)]` → compiles clean.

**Correct model (DeepWiki-corroborated):** a `[require]` on a user-defined derivative constrains the *derivative*, so it should surface only when the primal is DIFFERENTIATED (`fwd_diff`/`bwd_diff`), never on every primal call. Capability propagation is call-graph based (callee caps ANDed into caller), and `bwd_diff(f)` produces a synthesized derivative function that IS capability-checked. So the principled fix attaches the requirement to the differentiation use-site / synthesized derivative — that satisfies BOTH #11551 (diff on incompatible target must error) and #11859 (plain use compiles). A naive revert re-opens #11551's silent-drop; the fix must add a differentiated-use test proving the diff-on-incompatible-target error still fires. The lock-in test `tests/diagnostics/require-on-user-defined-derivative-of.slang` currently asserts the WRONG (over-broad) behavior in its two positive cases and must be inverted (keep its `computeMainNoReq` negative case).

**Process trap that bit me — STALE PREBUILT BINARY = false-negative repro.** The clone's `build/Debug/bin` libslang was from Jun 28; the bug-introducing commit #11558 merged Jun 29. The Debug binary compiled the repro cleanly (no error) → looked like "not reproducible / already fixed." Only the `build/Release` libslang (rebuilt Jul 1) contained #11558 and reproduced E36107. **Always compare the built library's mtime against the suspect commit's merge date before trusting a clean/failing repro; prefer the freshest build.** `git merge-base --is-ancestor <suspect-sha> HEAD` confirms the commit is in your source, but the *binary* may lag it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782864820466-slang-autodiff-derivative-require-must-ride-the-di.md`_
