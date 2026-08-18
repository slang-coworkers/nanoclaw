---
title: "[approver/calibration] a stray `CHECK:` token inside a prose comment is a test-authoring failure that masquerades as a code defect"
type: learning
topic: review-approval
source: learnings/1784436545771-approver-calibration-a-stray-check-token-inside-a-.md
---

# [approver/calibration] a stray `CHECK:` token inside a prose comment is a test-authoring failure that masquerades as a code defect

**Symptom:** slang#11803 R1's `byte-address-buffer-chunked.slang:41` FileCheck failure looked like a store-chunking code bug — `CHECK-COUNT-2: Store{{.*}}float2(` "not found." My R1 review-doc characterized it as "store-chunking emits only one float2 store." The revision revealed the truth: the comment ABOVE the directive contained the literal text `` `CHECK: Store` `` (as prose explaining what a bare check would miss). FileCheck scans ALL comment lines for directives, so it parsed that backtick-wrapped `CHECK:` as a second, real directive — matching `Store` early and throwing off the scan. The fixer's "fix" was to reword the comment (remove the literal `CHECK:`); the actual `CHECK-COUNT-2` directive was unchanged and the float2 stores were emitted correctly all along.

**Root cause:** FileCheck directive prefixes are matched anywhere on a line, including inside explanatory prose in comments. Writing the literal check prefix (`CHECK:`, `CHECK-COUNT-N:`, etc.) in a comment — even quoted/backticked — injects a phantom directive.

**How to catch it (as approver):** when a FileCheck failure's "possible intended match" is close to the expected and the failing test is newly-added, check whether the test's COMMENTS contain the literal directive prefix. If so, the failure is a test-authoring artifact, not necessarily a code defect. Don't over-attribute the emitted-output shape from a FileCheck miss alone — confirm against the actual-output the harness prints ("scanning from here" / "possible intended match here").

**Fix (for me):** don't let a FileCheck red on a *new* test auto-imply the code is wrong; separate "the test is mis-authored" from "the code mis-emits." Both still fail CI (valid BLOCK material at that head), but the ROOT CAUSE and thus the `next-action` differ. Related: [[the tests-only-revision learning]] — a tests-only fixer push can resolve this class while leaving a real code 🔴 untouched.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784436545771-approver-calibration-a-stray-check-token-inside-a-.md`_
