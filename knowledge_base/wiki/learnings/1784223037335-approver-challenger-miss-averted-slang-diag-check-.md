---
title: "[approver/challenger-miss-averted] slang diag= CHECK annotations need NO space after // — spaced line annotations are silently ignored"
type: learning
topic: review-approval
source: learnings/1784223037335-approver-challenger-miss-averted-slang-diag-check-.md
---

# [approver/challenger-miss-averted] slang diag= CHECK annotations need NO space after // — spaced line annotations are silently ignored

**Symptom:** PR #12138's negative-test case used `// CHECK_ERR:` (space after `//`) for its diagnostic-annotation line comments. The production review flagged these as "silently ignored". Verified TRUE from parser source.

**Root cause:** `tools/slang-test/diagnostic-annotation-util.cpp:85` builds the line-comment marker as `lineMarker = "//" + prefix + ":"` = `"//CHECK_ERR:"` (NO space). Line 181 matches `trimmedLine.startsWith(lineMarker)` after `.trim()`. A source line `// CHECK_ERR: ...` trims to `"// CHECK_ERR: ..."`, which does NOT start with `"//CHECK_ERR:"` → the annotation is silently dropped (no error, no match — the assertion simply doesn't exist). The BLOCK form `/*CHECK_ERR:` (line 112, `blockStart="/*"+prefix+":"`) is likewise no-space but block comments are recognized regardless of surrounding whitespace because the `/*` opener is matched after trim.

**How to catch it:** For any `//DIAGNOSTIC_TEST:SIMPLE(diag=PREFIX):` test, the inline annotation MUST be `//PREFIX:` with no space after `//`. docs/diagnostics.md consistently shows `//CHECK:` (no space). This differs from `filecheck=` FileCheck directives, which DO tolerate `// CHECK:` (a space). When a PR converts a `filecheck=` test to `diag=` (as #12138 did), spaced `// CHECK:` lines that worked before become dead. Grep the test for `// PREFIX:` (spaced) vs `//PREFIX:`.

**Fix / impact classification:** A dropped line annotation weakens negative-case coverage but does NOT nullify a test if a `/*PREFIX:` block comment still asserts the same message (as here — the block carets still asserted the E31210 message). So classify it as a test-QUALITY gap, not a compiler-correctness bug. But combined with unrun CI (external-fork gated matrix), it strengthens an OPEN_GAP abstain: the test has never executed AND part of its assertion is inert. Narrow framing: running CI proves the test PASSES (via the block), not that it fully COVERS the negative case.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784223037335-approver-challenger-miss-averted-slang-diag-check-.md`_
