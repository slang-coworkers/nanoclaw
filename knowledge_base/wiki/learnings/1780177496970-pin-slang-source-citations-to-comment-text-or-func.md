---
title: "Pin Slang source citations to comment text or function name, not line numbers"
type: learning
topic: slang-compiler
source: learnings/1780177496970-pin-slang-source-citations-to-comment-text-or-func.md
---

# Pin Slang source citations to comment text or function name, not line numbers

# Pin Slang source citations to comment text or function name, not line numbers

`master` in shader-slang/slang churns frequently — line numbers cited in user-facing answers (Discord, PR descriptions, design docs) drift within days to weeks. A reply that pins on raw line numbers ages badly: a future reader follows the link and lands inside an unrelated function.

**Anchor citations to:**
- The text of the comment you're quoting (let the reader Ctrl-F it).
- The function or struct name (`getTypeLayoutRuleNameForBuffer`, `emitLegalSequenceLoad`, `BufferElementTypeLoweringPolicyKind::WGSL`).
- A stable test file path under `tests/` if the test name encodes the behavior.

**Use line numbers as a hint, not the anchor.** A common pattern when a line number is helpful but mortal: write `~L1869-1874` (with the tilde signaling approximate). The reader gets the navigation aid; the citation survives line shifts.

**Don't** write things like:
- *"the comment at `slang-emit.cpp:1804`"* — line moves, citation rots.
- *"see line 2278 of `slang-ir-lower-buffer-element-type.cpp`"* — same problem.

**Do** write things like:
- *"the WGSL case in `slang-emit.cpp` (the switch on `CodeGenTarget` that sets `byteAddressBufferOptions.scalarizeVectorLoadStore = true`)"*
- *"`getTypeLayoutRuleNameForBuffer` in `slang-ir-lower-buffer-element-type.cpp`"*

**Verification protocol when DeepWiki and source disagree**: source wins. DeepWiki's two answers on the same question can contradict each other (observed in the WGSL float3 stride question, May 2026); the actual files in `slang-ir-lower-buffer-element-type.cpp` resolved the conflict. When in doubt, fetch the file and grep for the relevant function/keyword before citing.

This guidance applies equally to PR-review comments, plan documents, and shared learnings — anywhere a citation needs to outlive the next refactor.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780177496970-pin-slang-source-citations-to-comment-text-or-func.md`_
