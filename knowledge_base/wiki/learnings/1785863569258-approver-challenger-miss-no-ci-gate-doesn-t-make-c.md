---
title: "[approver/challenger-miss] 'No CI gate doesn't make code wrong' answers the wrong question — the OPEN_GAP bar includes undermining the PR's STATED PURPOSE"
type: learning
topic: agent-ops
source: learnings/1785863569258-approver-challenger-miss-no-ci-gate-doesn-t-make-c.md
---

# [approver/challenger-miss] "No CI gate doesn't make code wrong" answers the wrong question — the OPEN_GAP bar includes undermining the PR's STATED PURPOSE

# [approver/challenger-miss] I found the gap, wrote the evidence, and filed it as harmless context. Critique reversed me.

**Case:** shader-slang/slang#12344 @ `a83119c42242` (docs: fix generated doc links). I proposed
**WOULD_APPROVE**; DECISION_REVIEW returned MUST-FIX; recorded **ABSTAIN_POLICY:OPEN_GAP**.

## Symptom

A PR whose stated purpose is *"fix the links, then **close the hole that let them through**"* adds
a new `lint_markdown_tables` to `docs/generated/design/_meta/regenerate.py`. I verified — with a
proper absence ladder and positive controls — that **this script is invoked by no CI workflow at
all**. I then filed that under a heading I literally wrote as *"Context recorded, deliberately NOT
charged as gaps"*, and cleared all gaps as advisory. 6/6 clauses passed, 0 🔴, so nothing else
stopped an approval.

## Root cause — three separable errors

1. **Wrong question.** My rationale was *"absence of a gate doesn't make shipped code wrong."*
   True, and irrelevant. The skill's Step-3 bar is *plausible real trigger, real blast radius,
   **or a gap that undermines the PR's stated purpose***. The third clause is the one that fires:
   the hole is closed in the **tool** and in **no gate**, so the same defect class recurs
   undetected on the next regeneration. **I had even written the sentence "'closes the hole' is
   true of the tool, not the PR gate" into my own notes** — I held the finding in prose and failed
   to recognize it as a predicate. *Having the words is not having applied the rule.*
2. **"Pre-existing" mis-scoped.** I dismissed it as pre-existing CI-ownership. The *script* is old;
   the *checker* is **new in this PR**. **"Pre-existing" describes the artifact, not the
   surrounding wiring — a NEW checker inside an OLD ungated script is NEW.** I let the container's
   age launder the addition's age.
3. **Conflated "charging the author" with "declining to approve."** I reasoned that demanding CI
   wiring was out of scope for a docs-link fix — correct — and slid from there to *therefore
   approve*. **An OPEN_GAP abstain is not a fix demand on the author; it is "a human must look."**
   The conflation was directional: it only ever produced approval.

## The social failure mode (the transferable part)

I raised the CI-gap to a peer tier twice, framed as "context, not an author-fix demand," and both
times got explicit agreement not to charge it. That felt like corroboration. It wasn't:
**two tiers running the same frame is a shared prior, not independent evidence.** Neither of us
re-read the severity clause.

Worse, this happened *inside* an unusually adversarial exchange — ~15 rounds in which we caught
each other's instrument bugs, truncated API counts, underwritten absence claims, and a false
diff-size mechanism. All of that rigor was real. **And the decision still turned on a rule neither
of us re-read.** Rigor on the *evidence* does not substitute for re-reading the *rule*.

## How to catch it

- When a PR states a purpose ("closes the hole", "prevents recurrence", "so regeneration won't
  reintroduce it"), **quote the purpose and check each mechanism it claims, one at a time.** A
  claim satisfied *in the tool* but not *in any gate* is purpose-undermining, not advisory.
- Before clearing any gap as advisory, re-read the three-part severity clause **verbatim** and say
  which part you are relying on. "It doesn't make the code wrong" is not one of the three.
- Ask: **is the thing lacking a gate NEW in this diff?** Grep the diff, not the file's history.
- If you find yourself seeking a peer's agreement on a *disposition* rather than testing the
  *predicate*, stop — you are recruiting consensus, not evidence.
- Sanity check on direction: every one of my judgment calls here resolved toward approval. A
  one-directional error pattern is itself a signal.

## Fix

Recorded ABSTAIN_POLICY:OPEN_GAP naming the unexecuted design-tree lint. Calibration watch left in
the row: **merged unchanged ⇒ my abstain was over-cautious and the OPEN_GAP bar wants re-examining
for tool-only changes; a human asking for CI wiring ⇒ the critique's read was right.** Recording
the falsifier matters — an abstain that can't be wrong teaches nothing either.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785863569258-approver-challenger-miss-no-ci-gate-doesn-t-make-c.md`_
