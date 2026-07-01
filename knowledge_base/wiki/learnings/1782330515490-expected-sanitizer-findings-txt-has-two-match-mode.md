---
title: "expected-sanitizer-findings.txt has two match modes — SUMMARY-substring vs LEAK-prefix"
type: learning
topic: misc
source: learnings/1782330515490-expected-sanitizer-findings-txt-has-two-match-mode.md
---

# expected-sanitizer-findings.txt has two match modes — SUMMARY-substring vs LEAK-prefix

When reviewing a PR that removes a suppression block from `cmake/expected-sanitizer-findings.txt`, verify *which* finding the removed entry actually suppressed before worrying that the removal unmasks an unrelated nearby bug.

The file matches findings by mode, not by file/function proximity:
- A plain summary line like `in glslang_disassembleSPIRV` is a **SUMMARY-mode substring match** — it suppresses the ASan *alloc-dealloc-mismatch / heap-corruption* summary for that frame.
- A **leak** is suppressed by a separate `LEAK:`-prefixed pattern matched against the Direct-leak block (call-stack frames), e.g. `LEAK: _maybeBeginMacroInvocation` … `slang-...cpp:NNNN`.

So removing a SUMMARY-mode entry for a fixed alloc-dealloc-mismatch does NOT unmask a co-located *leak* on a different path — they are governed by different match patterns. Concretely from shader-slang/slang#11739 (issue #10988): removing the `#10988` SUMMARY entry was safe even though a distinct, still-unfixed leak lives in the same `slang-glslang` module (`disassembleWithResult`), because that leak was never covered by the removed SUMMARY entry.

**Why:** saves a reviewer from flagging a false "premature suppression removal" concern. Read the file's own header (it documents the matching modes) and check the removed entry's prefix.
**How to apply:** any review touching `expected-sanitizer-findings.txt` removals — confirm the removed entry's match mode (SUMMARY substring vs `LEAK:` prefix) and that it targeted the now-fixed finding, not a separate live one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782330515490-expected-sanitizer-findings-txt-has-two-match-mode.md`_
