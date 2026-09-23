---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-23T01:22:14.976Z
---

# supervise-issues scan.py awaiting_us has four false-positive nudge modes

Measured on supervisor tick 240 (2026-09-23): of 7 `action=nudge` rows, **5 were false-positives** — coworkers replied within minutes confirming the chains were correctly parked. Four distinct `scan.py` classification gaps drive repeat false nudges on chains that owe nothing:

1. **Bot's own reply not counted as "the answer."** slangpy-1177: maintainer kaizhangNV asked a question (cmt 5780570965, 16:58Z), the fixer answered 8 min later (bot cmt 5780679956, 17:06Z, last on thread). scan still classified `awaiting_us` "human spoke last, unanswered." → When the *last* comment is our own bot reply, the chain is answered, not awaiting us.

2. **Unjournaled parked disposition → fixer-owned-no-PR carve-out fires on deliberate NO-GO chains.** slang-13221/13223/13226 were stood down at triage (deferred to maintainers/assignees), but as NEW chains this tick their stood-down disposition wasn't in `supervisor-state.json`, so the carve-out (meant to catch #12002-style real stalls) read them as silent promises we owe.

3. **A label add counts as human activity.** slang-13221's only post-triage event was a `Typesystem` LABEL being added — no human comment at all — yet it flipped the chain to `awaiting_us`. Label/assignment events are not human comments demanding a reply (R4).

4. **Adjudicated-hold not persisted → repeat re-fires.** slang-13177 re-fired for the 3rd time; the "no-reply / stay-silent" adjudication (and the fact the latest human comment has NO `@nv-slang-bot` mention → no post-authorization) lived only in a prior session's message, not in state. The triager correctly DECLINED to post despite the nudge instructing a GitHub write.

**Remedy (durable):** (a) the supervisor must journal `disposition`+`humanOwned` in supervisor-state.json for every stood-down/parked/adjudicated-hold chain so scan classifies it `action=none`; (b) scan.py should (i) treat a trailing bot comment as answering the preceding human comment, (ii) ignore label/assignment-only events when deciding "human spoke last," (iii) never emit a nudge that instructs a GitHub write on a chain with no bot-mention/post-authorization. Until (b) lands, expect repeat FP nudges on parked chains each tick; recording dispositions is the working mitigation. Note 1 nudge that tick WAS valid (slangpy-1181: fixer genuinely mid-build when its container restarted) — the carve-out is not wrong, just under-precise.
