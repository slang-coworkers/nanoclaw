---
title: "[approver/challenger-calibration] reflection-JSON additive consistency/coverage gaps merge as-is — test regressive-vs-additive before leaning OPEN_GAP"
type: learning
topic: review-approval
source: learnings/1789079564809-approver-challenger-calibration-reflection-json-ad.md
---

# [approver/challenger-calibration] reflection-JSON additive consistency/coverage gaps merge as-is — test regressive-vs-additive before leaning OPEN_GAP

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788383018208-rrjkcg
written_at: 2026-09-10T22:32:44.809Z
---

# [approver/challenger-calibration] reflection-JSON additive consistency/coverage gaps merge as-is — test regressive-vs-additive before leaning OPEN_GAP

**Symptom.** On shader-slang/slang#12850 (`slangc -reflection-json`: reflect through pointers into the pointee struct), the production reviewer (github-actions[bot]) posted **🟡 Has issues — 0 bugs, 3 gaps** at head: (1) the new `ReflectionTracker` is a document-global, never-popped `HashSet<TypeReflection*>` (comment claims "active path"), so `valueType`/`targetType` becomes an order-dependent, *polymorphic* field — same struct expanded in one section/occurrence, collapsed to a bare name string in another; (2) the type-info path expands *any* pointee while the layout path expands *only* struct pointees, so `int*` renders as an object in one path and a string in the other; (3) the new `ptr-revisit.slang` covers only direct siblings + a single pointer, not the divergent sibling-pointer / cross-section / `targetType` cases. My challenger would plausibly have leaned **ABSTAIN:OPEN_GAP** on these (real trigger, real-if-bounded blast radius, uncertainty) had Step-1 clauses passed. **Outcome: `jkwak-work` merged the PR AS-IS at the exact reviewed commit (67f369476634), ~8 days later, no follow-up commits — the 3 gaps shipped unchanged.**

(The recorded decision was ABSTAIN_POLICY on a Step-1 clause fail — external author/fork/638-line diff — which is *excluded from agreement scoring* and was correct regardless. This learning is about the challenger's would-be gap-severity lean, not the policy gate.)

**Root cause / why it was safe to ship.** The change is to a developer-tooling JSON *output*, not an ABI or compiler-correctness contract. It is **strictly additive**: every "collapsed to a name" branch is byte-identical to pre-PR behavior (in the layout path, pointer targets were *always* name-only before this PR), so no existing consumer regresses — only the newly-*expanded* form is new. Recursion provably terminates (all `test-slang` jobs green on every platform, incl. recursive `ptr-generic` + repeat `ptr-revisit`). The flagged "inconsistency" is a design wart, not a correctness bug, and a maintainer consciously accepted it (CodeRabbit had rated Merge Risk 🔵 Low, "mergeable with owner awareness/follow-up").

**How to catch it (sharpen Step-0 recall for reflection-output PRs).** Before leaning OPEN_GAP on a *consistency* or *coverage* gap in reflection/tooling **output**, ask the additive-vs-regressive question: does the flagged form **regress** an output that worked before, or is it merely a **new** inconsistency layered on top of unchanged old behavior? If the "worse" branch == the prior behavior (additive-only), it is mergeable and should clear as advisory. Reserve OPEN_GAP for gaps that (a) regress an output existing consumers relied on, (b) can crash / emit malformed JSON, or (c) defeat the PR's stated purpose.

**Fix.** Weight two axes in the 🟡 gap-severity call: *additive vs regressive*, and *tooling-output vs load-bearing contract*. A 🟡 consistency/coverage gap on additive tooling output, with no regression and no crash/malformed-output path, → lean **clear (advisory)**, not OPEN_GAP. Keep the conservative-lean bar for regressions, crashes, and purpose-defeating gaps.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789079564809-approver-challenger-calibration-reflection-json-ad.md`_
