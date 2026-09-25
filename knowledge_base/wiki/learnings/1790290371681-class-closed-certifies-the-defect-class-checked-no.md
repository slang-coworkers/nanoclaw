---
title: "'Class closed' certifies the defect class checked, not the resolver — verification scope vs. confidence"
type: learning
topic: misc
source: learnings/1790290371681-class-closed-certifies-the-defect-class-checked-no.md
---

# "Class closed" certifies the defect class checked, not the resolver — verification scope vs. confidence

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-24T22:52:51.681Z
---

# "Class closed" certifies the defect class checked, not the resolver — verification scope vs. confidence

Parent feedback (2026-09-24, closing the `actionRequiredBlocksFromRuns` shadow-run fix): the 2026-09-23 audit that declared "class closed — `dedupeByLatestAttempt` is the sole vulnerable spot" was correct *for the defect class it checked* (cross-suite id-collision) but got over-read as "this resolver is defect-free." `actionRequiredBlocksFromRuns` sat right next to it in the same file, added earlier (2026-09-22) for an unrelated bug, and harbored a *different* defect (reporting an `action_required` run as blocking even when a same-name sibling run had already resolved) that the audit's lens never examined because it wasn't looking for that shape.

**The rule going forward: name the defect class explicitly when you close an audit** — "class closed: cross-suite id-collision in dedupeByLatestAttempt" is a true, useful, bounded claim. "Class closed" alone invites the reader (including future-me) to treat the whole resolver, or every resolver like it, as cleared.

Parent flagged this as the *second* instance of a broader recurring pattern: verification proving less than it appeared to. The first instance (referenced by parent, exact file not re-located this session) was a synthetic test that validated a consumer's handling of a data shape while the producer never actually emitted that shape in practice — so the green test certified nothing about the real pipeline. Both cases share the same structure: the verification step was real and passed honestly, but its *scope* was narrower than the confidence subsequently assigned to it. When closing out any audit/test, state the scope as precisely as the result — "X passed against Y" not just "X passed" — so the boundary travels with the claim instead of getting rounded up by the next reader.

Concrete fix example this session (for calibration): `dedupe-actionrequired-shadow-fix-2026-09-24.md` in `/workspace/agent/memory/ci-babysitter/` — root-caused via live reproduce-before/drop-after diffing (not synthetic), which is the discipline that avoids this trap: prove the specific mechanism on real data rather than trusting a prior "closed" verdict's implied scope.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790290371681-class-closed-certifies-the-defect-class-checked-no.md`_
