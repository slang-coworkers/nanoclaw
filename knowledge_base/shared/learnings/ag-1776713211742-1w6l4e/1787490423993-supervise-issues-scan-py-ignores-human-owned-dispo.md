---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-23T13:07:03.993Z
---

# supervise-issues scan.py ignores human-owned disposition on ball==ours

**Finding (measured 2026-08-23, supervisor tick 183):** `scripts/scan.py`'s `classify()` applies the `HUMAN_OWNED_DISPOSITION` guard ONLY in the `ball=="human"` branch (via `we_owe_next_step`), NOT in the `ball=="ours"` branch (scan.py:330-335). So a chain where a human commented last on GitHub (`ball=ours`) but our disposition is `maintainer-driving`/`advisory`/`external-pr`/etc. returns `awaiting_us` + `action=nudge`, ignoring the disposition. SKILL.md claims "a human-owned disposition never reaches needs_nudge" — that contract is FALSE for the ball==ours path.

**Verified by execution** (not just reading): synthetic payload, `ball==ours` (human comment after our bot activity) + `disposition='advisory:maintainer-driving'` → `state=awaiting_us action=nudge`, byte-identical to the `disposition=None` control.

**Impact:** `must_nudge` inflated. Tick 183: `must_nudge=184` on a board where `new=0 updated=0 same=436` (nothing changed since prior tick). Of the 184: ~81 parked by prose disposition (maintainer/handed_off/design-gated/awaiting_human — many outside scan.py's 7-token set too), ~89 already nudged ≥2× (escalate, don't re-nudge), only ~8 genuinely actionable. Prior ticks did NOT fire this volume (178/184 nudged before but only 21 within last ~26h).

**Why:** the disposition prose vocabulary in the field vastly exceeds scan.py's `HUMAN_OWNED_DISPOSITION = (human-debate, external-pr, maintainer-driving, awaiting-pickup, closed-by-us, stood-down, advisory)` — real dispositions read `handed_off:`, `parked:design-gated`, `human-gated`, `awaiting_human`, `resolved_no_pr`, `held:`, `triaged:PARKED`, `no work owed`, `two-track`, none of which match.

**Fix (for a maintainer of the skill):** move the `HUMAN_OWNED_DISPOSITION` check to the top of `classify()` before the ball branch, and/or widen the token set. Until fixed, the supervisor must NOT blast `must_nudge` — treat `sent_nudges != must_nudge` as the designed `[SUPERVISOR INVARIANT VIOLATION]` → escalate to operator (which is what tick 183 did: 8 sent, gap escalated).

Related: [[feedback_a_control_built_from_the_matchers_own_assumption_is_blind]] — the nudge gate is built from an assumption (disposition set) narrower than reality.
