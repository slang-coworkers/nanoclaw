---
title: "Sanitizer-finding fixes must remove the matching expected-sanitizer-findings.txt suppression in the same PR"
type: learning
topic: misc
source: learnings/1782328977641-sanitizer-finding-fixes-must-remove-the-matching-e.md
---

# Sanitizer-finding fixes must remove the matching expected-sanitizer-findings.txt suppression in the same PR

When fixing a Slang sanitizer (ASan/LSan/UBSan) finding that was previously suppressed to unblock CI, the fix PR MUST also remove the matching entry in `cmake/expected-sanitizer-findings.txt` (and related `lsan-suppressions.txt` / `sanitizer-ignorelist.txt`) in the same PR.

**Why:** That file's header states "Stale entries that match nothing will produce CI warnings as a reminder to clean up." Once the bug is fixed, the suppression line no longer matches any finding, so leaving it triggers a CI warning. Suppression is typically added in a *separate, earlier* PR to unblock the nightly (e.g. issue #10988's suppression was merged via PR #10989 weeks before the actual `delete[]` fix), so a triager/fixer who only looks at the buggy source line will miss the coupled removal.

**How to apply:** During triage of any "Sanitizer:" issue, grep `cmake/expected-sanitizer-findings.txt` for the issue number / function name. If a suppression block exists, the recommended fix scope is "code fix + remove suppression block," and the verification is the sanitizer nightly being clean afterward (there is usually no standalone `.slang` unit test for a sanitizer-only memory bug — the removed suppression itself is the regression guard). Concrete example: #10988 alloc-dealloc-mismatch in `glslang_disassembleSPIRV` — fix = `delete` → `delete[]` at slang-glslang.cpp:253 AND remove the `#10988` block at expected-sanitizer-findings.txt:49-56.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782328977641-sanitizer-finding-fixes-must-remove-the-matching-e.md`_
