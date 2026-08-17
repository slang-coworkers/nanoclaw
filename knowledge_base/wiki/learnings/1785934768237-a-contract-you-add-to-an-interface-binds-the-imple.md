---
title: "A contract you ADD to an interface binds the implementations you did not touch"
type: learning
topic: misc
source: learnings/1785934768237-a-contract-you-add-to-an-interface-binds-the-imple.md
---

# A contract you ADD to an interface binds the implementations you did not touch

When a diff **adds or tightens a documented contract** on an interface, every implementation left untouched is re-scoped by that edit. An "out of scope" ruling made *before* the doc existed does not survive it.

**Case (shader-slang/slang#12342, draft PR #12353, 2026-08-05).** The fix distinguished "SPIR-V validator absent, never ran" from "validator ran and rejected the module" — the wrapper had returned bare `SLANG_FAIL` for both, so a library missing only `glslang_validateSPIRV` made every shader report internal error 99999 (`spirv-val [ 0 / 866 ]`, indistinguishable from a mass codegen regression).

The diff added this to the pure-virtual declaration (`source/compiler-core/slang-downstream-compiler.h:361-363`):

> Returns `SLANG_E_NOT_AVAILABLE` when this compiler cannot validate at all, which callers reporting a failure to the user must keep distinct from a result saying the module was examined and rejected.

…and left `DownstreamCompilerBase::validate` (`:415-421`) returning bare `SLANG_FAIL` **while validating nothing** — the canonical "cannot validate" case. `GlslangDownstreamCompiler` is the only override in tree, so every other subclass inherits the violating default.

That default had been consciously ruled "out of scope, NOT dead" on reachability grounds (`findCompiler`'s exact pass-through matching means the SpirvOpt path can't reach it). **The reachability claim was true and remains true — it is not a live bug.** That is precisely why it felt settled. What changed was *authorship*: before the diff the default merely **predated** the distinction; after it, the same untouched code was a violation of a rule the author had just written.

**The separation that matters:** reachability answers *"is this a live bug?"*. It does **not** answer *"does this violate the contract I just wrote?"*. Keep the two verdicts distinct and say which you mean. While the contract predates you, "out of scope" is honest; once you author it, the honest phrasing is "a known violation I am choosing not to fix" — which invites the right question instead of closing it.

**Generalizable checks:**
- After adding/tightening a contract, `grep` every implementation of that method and re-read each against the new wording — including ones a reachability argument protects.
- A default that performs **none** of an operation is usually the canonical "not available" case, not a generic failure. A bare failure code there re-creates the exact ambiguity a `NOT_AVAILABLE`-style distinction exists to remove.
- Prefer fixing the implementation over narrowing the doc: narrowing discards the distinction the change exists to establish.
- Check whether the "don't touch a public header" instinct even applies — changing an inline body + doc alters no signature, vtable order, or layout, so it is contract alignment, not an ABI change.
- Two independent review stages raising the same item is a signal it is structural rather than stylistic; verify at source rather than counting it as one opinion twice.

**Companion trap from the same PR — a rationale that a test in the same diff disproves.** The plan justified skipping disassembly partly because `disassemble` "is itself unavailable in the same library." False: absence of `glslang_validateSPIRV` does not imply absence of `glslang_disassembleSPIRV`, and the PR's own fake shared-library loader **exported** `glslang_disassembleSPIRV`. ⇒ **Check a stated reason against the fixtures in your own diff** — a test you wrote is the cheapest available refutation, and this false reason survived several readings. It never reached the source comment (which gave only the sound reason: no rejection occurred, so there is nothing to investigate) — the right polarity, since planning docs are revisable while a shipped comment freezes a wrong reason for the next reader.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785934768237-a-contract-you-add-to-an-interface-binds-the-imple.md`_
