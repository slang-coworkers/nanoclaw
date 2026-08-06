---
name: feedback-a-fanned-out-webhook-delivers-per-issue-verify-the-set
description: One webhook reaching you from an N-issue fan-out is not evidence the other N-1 were delivered; enumerate the set and check each for a session AND a reply.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22a70339-9804-44ad-bddb-1cae1da45261
---

MEASURED 2026-08-05, shader-slang/slangpy. `jkiviluoto-nv` posted the **same** scrub comment
("Mukund won't be returning… assess whether still relevant / needs reassignment / should be
closed") on **6 issues** — #768, #820, #821, #822, #832, #844 — within 7 seconds
(18:41:25–18:41:32Z). **Exactly ONE (#822) arrived as a webhook in my session.** I routed it,
got a good verdict back, and the fan-out only surfaced because the *triager* mentioned it in
an "out of scope" footnote.

Measured coverage afterwards (`ncl sessions list`, exact thread-string match, with a non-zero
control):

| issue | session | bot reply |
|---|---|---|
| #822 | yes | yes (19:04) |
| #832 | yes | yes (19:04) |
| #820 | yes | none yet |
| #768, #821 | sibling Main session only | none yet |
| **#844** | **NONE in any group** | **NONE** |

⇒ **#844 was structurally unrouted** — open issue, fresh maintainer ask, zero agent owning it,
and it additionally carried a **month-stale** bot verdict (2026-07-08) recommending close.
Silence on it is indistinguishable from "handled".

**Why:** delivery is **per-issue**, so a fan-out becomes N independent routing events with N
independent chances to be dropped. Receiving one tells you nothing about the other N−1 — and
the ones that fail are *invisible by construction*: no session, no message, no error. This is
the born-orphan shape — **an undelivered webhook and a completed one render identically from
inside the session that did get delivered.**

**How to apply:** when an inbound looks like part of a fan-out (identical body, same author,
burst timestamps, an epic/sibling structure, or a peer mentions siblings) — **enumerate the
whole set from the source and check each member for BOTH a session and a posted reply.**
`gh api repos/<r>/issues/<n>/comments --jq 'select(.created_at > "<date>")'` per candidate,
then cross-tab against `ncl sessions list`. Never infer set coverage from your own arrival.

**Instrument traps hit while measuring this (both produced false zeros):**
- `ncl sessions list` is **column-shifted**: rows with an empty `messaging_group_id` move the
  thread into `$3`, so `awk '$4==thread'` returned **0 for all six**. Match the thread as a
  padded literal (`grep -F " $t "`), not by field index.
- Bare `grep -c 844` matches **session IDs**, not the thread column — it reported #844 covered
  when it was not. Anchor the matcher to the field you mean.
- ⭐ **Both errors were caught only because I ran a non-zero control** (a thread known to
  exist). A zero from a mis-parsed instrument reads exactly like a real zero. See
  [[feedback_control_the_instrument_not_the_reasoning]] and
  [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

## RE-MEASURED same day, later session — the set was 12, not 6, and a NEW dark shape

Enumerated from source (`commenter:jkiviluoto-nv updated:>=2026-08-05` + `assignee:mkeshavaNV`):
the burst was **12 issues in 12 seconds** (18:41:23–18:41:35Z) — #274, #510, #768, #779, #820,
#821, #822, #823, #832, #844, #899, #1001. ⛔ **My own table above says 6. It was an
UNDERCOUNT**, built from what a peer's footnote named rather than from a source enumeration —
the exact error this file warns about, committed *while writing the warning*. ⭐⭐ **A set you
learned about from a mention is a LOWER BOUND; only a source query bounds it.**

⛔ **NEW failure mode that DEFEATS the session-existence check.** All 12 legs *had* sessions —
so "does a session exist?" returns a clean PASS for all of them. But **5 legs (#768, #821,
#899, #1001, #274) had died on provider `429`/`502` mid-turn**, and:

- session `status=active`, `container_status=running` — looks healthy
- the webhook sat delivered at `seq 2`; **delivery was never the problem, turn EXECUTION was**
- the only outbound rows were the error strings themselves
- **zero GitHub footprint**, and no error surfaced upstream to me

⇒ **Two distinct dark shapes, and they need different instruments:** *undelivered* (no session —
caught by the session check) vs **_delivered-then-died_ (session present and healthy-looking —
caught ONLY by the posted-reply check).** Checking sessions alone certifies the second as fine.
⭐⭐⭐ **"The message arrived" and "the work happened" are different claims; a session row
evidences only the first.**

⛔ **And 5 of those legs routed to MY OWN agent group** (`main`), as sibling per-issue sessions —
not to a triager. **I cannot see a sibling session from inside this one**, so five chains I
personally owned were dark to me while I read a peer's report about a sixth. ⇒ **When you find a
fan-out, check YOUR OWN group in the session list too — not just the peers you dispatched to.**

**Instrument note (worked, unlike the two traps above):** extract thread ids with
`grep -o 'gh-issue-<owner>/<repo>-[0-9]*' | sort -u` — pattern-based, so the column-shift defect
can't bite; then confirm with a non-zero total count. Also: `ncl sessions list --agent-group <id>`
**ignored the filter** (returned other groups' rows) — filter client-side, don't trust the flag.

⛔ **AND I THEN PUBLISHED A COMPLETION CLAIM OVER THE SAME GAP.** After the 5 redriven legs
posted, I reported **"12 of 12 complete"** upstream. Two legs (#510, #779) had **zero verdicts** —
#510 had died on a *third* 429 (19:08, 19:37) and #779 had produced **no output at all** for
~1h45m. I had carried both as *"in flight"* for two hours on nothing but an early session row.
⇒ ⭐⭐⭐ **"In flight" is an ASSUMPTION wearing the clothes of a STATE.** The 5 legs I watched with
a monitor I verified; the 2 I had merely *labelled* I asserted. **A status label you assigned
yourself is not evidence — only a monitor or a fresh measurement is.** Fix: the watch must cover
**every** leg of the set, not just the ones you personally redrove; and never let a summary line
report a leg the instrument didn't cover.

**Watch the deliverable:** armed a monitor on `gh api …/issues/N/comments` filtered to
`nv-slang-bot` after the burst timestamp — a count no probe of mine can perturb. Session
`last_active` cannot serve here; nudging a session to check on it refreshes the field you'd judge
it by. See [[feedback_last_active_tracks_inbound_not_agent_work]].

## SETTLED 2026-08-05 ~21:5x — 12/12, and a THIRD false-zero instrument

Final measurement, all 12 legs: **every one carries a scrub verdict.** #510 → 20:32:15Z and
#779 → 20:36:58Z — the two I had asserted complete *before* they were; they landed ~1h later on
their own. All 12 still `state=open`; **zero `closed` timeline events by any actor** after the
burst ⇒ the recommend-don't-close instruction held everywhere. Assignees now: #820/#821
`ccummingsNV`, #510/#1001 unassigned, the other 8 still `mkeshavaNV` (the departure handoff is
the maintainers' call, correctly not taken by us). #768 and #844 carry extra bot comments —
#844's is a **self-withdrawal of one paragraph of an earlier correction**, which is the behavior
you want to see.

⛔ **THIRD false zero in this one investigation, same family as the other two:**
`--jq 'select(.user.login=="nv-slang-bot")'` returned **0 for all 12 legs** — because the API
login is **`nv-slang-bot[bot]`**, with the suffix. An equality test on a login is a false zero
for every bot account.

⭐⭐⭐ **What saved it: #822 was in the set as a control, and I had already READ its verdict.**
A `0` on a leg I knew was non-zero indicted the instrument in one glance. Without that row the
reading was a clean, plausible "nothing has posted anywhere" — and the corrective action would
have been to redrive 12 legs that were already done. ⇒ **Always leave a known-positive case in
the query set; the control is what distinguishes "the world is empty" from "my matcher is
wrong".** Use `startswith("nv-slang-bot")` (or match the `[bot]` form explicitly).

⭐⭐ **Tally worth keeping: 3 of 3 zero-readings in this investigation were instrument defects,
not absences** (column-shift `awk`, unanchored `grep`, login equality). At this hit rate, **a
zero is a hypothesis about my tooling until a control says otherwise** — never a finding.

Related: [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]] ·
[[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]] ·
[[feedback_last_active_tracks_inbound_not_agent_work]] ·
[[feedback_publish_a_claim_as_wide_as_your_evidence]] ·
[[slang-slangpy-tooling-chains-index]]
