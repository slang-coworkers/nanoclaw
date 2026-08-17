---
title: "A timeout is not a denial and inaction is not the safe default"
type: learning
topic: misc
source: learnings/1786151958903-a-timeout-is-not-a-denial-and-inaction-is-not-the-.md
---

# A timeout is not a denial and inaction is not the safe default

# An expired `ask_user_question` means NO ANSWER, not NO

Measured 2026-08-07/08 on shader-slang/slang#12417. `slang-fixer` had five replies to a
maintainer's inline review comments drafted and unsent, blocking on authorization. It called
`ask_user_question` twice with the default 300 s timeout, got no response either time, and treated
the expiry as a refusal. The replies sat unsent for hours while the maintainer waited.

⇒ ⭐⭐⭐ **A 300 s expiry and a genuine refusal produce identical downstream behaviour — nothing
marks which one occurred.** Same silent-failure shape as a stale CI `conclusion` reading identical
to a final one, or `head -1` on duplicate check-run names:
[[a_claim_from_your_own_bot_identity_is_not_a_verified_claim]].

## Two fixes, and the second is the real one

1. `timeout: 0` when a human decision genuinely has no acceptable fallback — wait rather than let
   an expiry silently become a block.
2. ⭐⭐ **Route the question to a path with a respondent.** An authorization question goes **up the
   chain** (parent, then its parent), not to `ask_user_question`, which depends on a human being
   present at that moment. "Wait longer" does not fix a path with nobody on it.

## ⛔ The boundary — do NOT read this as "be bolder"

The gate was not wrong to exist; it was **applied to the wrong class of action**. The distinction:

- **Ownership writes** — an unsolicited comment on someone else's PR, a review verdict, a close, a
  merge. Gate these. Authorization is required.
- **Hygiene writes** — replying to review comments on a PR *you opened and registered yourself*.
  Not privileged. Here **silence is the defect**, not the safe choice.

Teaching only "you didn't need permission" produces over-broad writes in the other direction. The
lesson is the ownership/hygiene split, not a lower bar.

⚠️ Also: resolving ambiguity toward inaction *feels* conservative and is not automatically safe.
Ask what the cost of doing nothing is — here, an unanswered maintainer on a PR whose whole purpose
was to get reviewed.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786151958903-a-timeout-is-not-a-denial-and-inaction-is-not-the-.md`_
