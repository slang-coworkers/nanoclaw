---
title: "Un-expanded bot task amid unconverged maintainer design debate = correct restraint, not a dropped chain"
type: learning
topic: misc
source: learnings/1785399716488-un-expanded-bot-task-amid-unconverged-maintainer-d.md
---

# Un-expanded bot task amid unconverged maintainer design debate = correct restraint, not a dropped chain

When a maintainer tells the bot "go ahead and implement X" but that directive lands **inside an unconverged design debate** — a second maintainer objects to the same direction, and any change is gated on a third's sign-off that hasn't come — the bot NOT implementing is **correct restraint**, not a dropped/overdue task. Do not re-derive an "expansion/implementation overdue" chain-liveness trigger from the raw "directed but not done" view.

**Concrete case (shader-slang/slang #11631, 2026-07-23→30):** pdeayton-nv proposed a specific 3-diagnostic scheme AND told nv-slang-bot "please go ahead with expanding draft #11633." But tangent-vector (senior) then pushed back on that exact direction ("a distinct diagnostic keyed on whether `[require(...)]` appeared would promote a bad mental model") and gated any semantic change on "if it has @csyonghe's blessing" — which never came. So two maintainers disagreed, conditioned on a third's ruling. Expanding #11633 then would mean implementing pdeayton's proposal over tangent-vector's live objection before csyonghe adjudicated — the "don't build on an unconverged proposal" trap. #11633 correctly stayed version-half-only.

**Why this matters:** the daily-report staleness discipline (carry in-flight bot deliverables, flag dropped ones) creates a bias toward reading any "directed but not delivered" item as a dropped dispatch to nudge. That bias inverts the correct action here — nudging "expansion overdue" would push the bot to pre-empt a live maintainer design debate. A single maintainer's "go ahead" is NOT a converged directive when another maintainer is actively objecting and a sign-off is pending.

**How to apply:** before flagging a directed-but-undelivered bot implementation as overdue/dropped, read the full thread for (a) a *second* maintainer objecting to the same direction, and (b) an explicit gate on someone's approval. If either is present → disposition is "🟡 design unconverged, maintainer-owned, NO coworker action, do NOT nudge." The genuine re-escalate condition is: the design *converges* and THEN the directed implementation goes silent, OR the debate itself goes fully dark for weeks (a stalled-design nudge, still maintainer-owned). Distinguish this sharply from a true dropped-fixer/reviewer deliverable (no design ambiguity, work simply died on session teardown).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785399716488-un-expanded-bot-task-amid-unconverged-maintainer-d.md`_
