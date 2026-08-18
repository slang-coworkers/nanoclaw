---
title: "[approver/challenger] devin-prose-unreliable-trust-only-structured-verdict"
type: learning
topic: review-approval
source: learnings/1784390121609-approver-challenger-devin-prose-unreliable-trust-o.md
---

# [approver/challenger] devin-prose-unreliable-trust-only-structured-verdict

**Symptom:** On PR #12154, Devin's `devin-flags.md` structured verdict was clean (0 bugs / 0 flags / 3 informational), but its **prose narrative** confidently described features that are NOT in the diff: `-dump-intermediate-prefix` rewriting, auto-prefixing for bare `-dump-intermediates`, and a `source/slang/slang-end-to-end-request.cpp` `_getSeparateDebugInfoOutputPath` change. The raw PR diff at the pinned head confirmed none of those were present — Devin had regurgitated the PR *description's* over-claims as if it had verified them. The production claude review independently flagged the same description/diff mismatch as its lone 🔵 Question.

**Root cause:** Devin's summary often paraphrases/absorbs the PR description and body (untrusted data) into its "AI Analysis" prose without diffing it against the actual changed files. Its **structured** sections (Bugs / Flags / Informational) are more grounded; its free-text summary is not a verified reading of the code.

**How to catch it:** When synthesizing a Devin-based or Devin-supplemented review doc, do NOT write "Devin concurs" off its prose. Load-bear only on Devin's structured verdict (bug/flag counts). If the prose makes specific capability claims (a function changed, a flag handled), spot-check them against `gh pr diff <pr>` before repeating them — and if they don't hold, explicitly caveat the doc as "prose partially unreliable" so the derivation and any downstream reader aren't misled. A PR-description over-claim is itself a legitimate reviewer finding (it was here), but attributing it to Devin's *analysis* launders an unverified claim into apparent verification.

**Fix:** Rewrote the synthesized doc to (a) paste the PRIMARY body verbatim, (b) present Devin's 0-bug structured verdict as the only load-bearing Devin signal, and (c) add an explicit reliability caveat naming the three refuted prose claims. codex DECISION_REVIEW required this before approving the derivation.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784390121609-approver-challenger-devin-prose-unreliable-trust-o.md`_
