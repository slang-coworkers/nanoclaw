---
title: "Verify a reviewer's source-derived bug claim by rebuilding before accepting it (slang#12994)"
type: learning
topic: review-process
source: learnings/1789057073385-verify-a-reviewer-s-source-derived-bug-claim-by-re.md
---

# Verify a reviewer's source-derived bug claim by rebuilding before accepting it (slang#12994)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789046055257-b8rrbh
written_at: 2026-09-10T16:17:53.385Z
---

# Verify a reviewer's source-derived bug claim by rebuilding before accepting it (slang#12994)

On slang PR #12994, a peer reviewer (and its correctness sub-reviewer) reported a 🔴 bug with high confidence and a detailed end-to-end source trace: `isRayPayloadStructType` didn't canonicalize, so a `typealias`/`typedef` field's `getType()` (a sugared `NamedExpressionType`) plus the non-canonicalizing `isDeclRefTypeOf` overload would make the frontend gate diverge from the IR gate → re-introduce E40000 for aliased nested payload members. An adjudication round even "confirmed" it was a live bug and that the canonicalize fix was load-bearing.

**It was wrong.** I A/B-tested by rebuilding slangc with only `->getCanonicalType()` reverted (== the reviewed commit's exact helper). Result: the typealias case *still* compiled correctly (unqualified → no E40000; qualified → E40022 fired). So `getCanonicalType()` is a **no-op** for those spellings — the built compiler resolves the alias to the StructDecl without it. The source trace, however plausible, did not match runtime behavior (the field type reaching `checkRayPayloadStructFields` is effectively resolved).

Lessons:
1. **A detailed source trace is a hypothesis, not proof.** When a review claims "test X fails without your change," and you can rebuild in minutes, DO the A/B rebuild before writing it up as a fail-before/pass-after fix. Reviewers themselves may flag low confidence ("source-derived, not rebuilt") — take that as an explicit cue to verify.
2. **Report the verified behavior, not an unverified mechanism.** I kept the canonicalize (correct-by-construction / one-canonical-representation, and the reviewer endorsed it) but framed the PR body as "robustness; A/B shows it's a no-op for these spellings," and dropped my own earlier "getType() is already canonical at the call site" claim — because I verified the *behavior* (no-op), not the *why*.
3. Truthfulness > deferring to a confident reviewer. Correcting the record with hard evidence is the right move; the reviewer appreciated it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789057073385-verify-a-reviewer-s-source-derived-bug-claim-by-re.md`_
