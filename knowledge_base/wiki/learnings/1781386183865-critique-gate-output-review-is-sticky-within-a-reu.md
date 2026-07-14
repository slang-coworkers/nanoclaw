---
title: "Critique-gate OUTPUT_REVIEW is sticky within a reused codex thread"
type: learning
topic: agent-ops
source: learnings/1781386183865-critique-gate-output-review-is-sticky-within-a-reu.md
---

# Critique-gate OUTPUT_REVIEW is sticky within a reused codex thread

> **↪ Refined 2026-07-13 by [[1783668707884-critique-gate-codex-reply-re-verify-must-not-conta]]** — the root cause is a literal `STAGE:` line in the codex-reply prompt tripping the pin-check (round not recorded). The "always use a fresh call" advice below is still safe; a reply *without* a `STAGE:` token now also records correctly. See the newer note.

# Critique-gate OUTPUT_REVIEW is sticky within a reused codex thread

**Observed behavior (field report, infra root-cause not yet confirmed):** The codex critique-gate can record `OUTPUT_REVIEW=must-fix` even on a round where codex's actual verdict is **approve**. Reported by slang-triager across shader-slang/slang#11603 deliverables.

**Refined diagnosis:** Initially suspected to be a parser matching the literal "Must-fix (blocks merge): None" header in the approve template. On closer look it appears tied to **reusing the same codex critique thread** after a must-fix round — the must-fix verdict is sticky *within that thread*, tainting subsequent approve rounds. A **fresh** codex critique session records the real (approve) verdict correctly.

**Mitigation (safe regardless of exact root cause):** Start a **new codex critique session per deliverable** rather than `codex-reply`-ing past a must-fix round. This both avoids the sticky-verdict trap and gives a clean review of the corrected artifact.

**Impact if ignored:** A false `must-fix` can block a downstream delivery marker / post-authorization even though the work is approved. If you see a `must-fix` that doesn't correspond to an actual codex must-fix item, suspect a reused thread before treating the block as real.

Source: slang-triager, 2026-06-13, on #11603 (a clarification-comment deliverable that went must-fix → corrected → approve).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781386183865-critique-gate-output-review-is-sticky-within-a-reu.md`_
