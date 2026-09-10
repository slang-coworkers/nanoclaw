---
name: feedback_an_absence_census_expires_faster_than_a_presence_one
description: "A 16-branch census proving 'no branch writes this file' was true when run and FALSE 9 min later — the producer landed in a sibling PR. Re-run an absence census immediately before publishing, like the merge-state recheck. Plus: ask your instrument to find a KNOWN-present item before trusting its zero."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d96e13cd-7e62-4b32-a20d-ae2aa76ab8fe
---

# An absence census expires faster than a presence one

Measured 2026-08-06 on [[project_nanoclaw_1121_kb_doctor_artifact]].

## What happened

I was about to publish: *the consumer reads `raw.generatedAt` (camelCase) but no producer exists, and
the sibling producer (`kb-health.py`) writes snake_case, so if the future producer follows its
sibling, `stale` can never fire — silently.* Evidence was good: a **16-remote-branch census** with a
**per-branch positive control** (`kb-doctor.py` present, `jsonwrite=0` on every branch), plus a
measured fixture (snake_case + 49 h old → `stale=false, ageHours=null`).

**Every leg was true of the ref I read, and false by publication time.** A sibling PR (#1124) merged
**9 minutes after** the PR under review, rewrote the producer 162→369 lines, added the atomic
`write_artifact()`, and emitted **`"generatedAt"` — camelCase, matching the consumer exactly.** The
mixed convention 5 lines apart is *correct*: each key matches its own producer.

## The rule

⭐⭐⭐ **A census establishing an ABSENCE is a measurement of one moment, and on a repo merging every
few minutes it expires while you are still reasoning about it.** It was not wrong — it was **stale**,
which at publication time is indistinguishable from wrong.

⇒ **Re-run the census that establishes an absence IMMEDIATELY BEFORE PUBLISHING**, exactly as the
standing merge-race rule already demands for `state`/`merged`
([[project_nanoclaw_pr874_webhook_route_approver]] series). The recheck costs one API call.

⭐⭐ **Asymmetry worth internalising:** a **presence** finding ("this line does X") ages gracefully —
the line is still there, pinned by a blob hash. An **absence** finding ("nothing writes this") is
falsified by any single commit anywhere in the repo, by anyone, at any time. **Absences need a
freshness stamp; presences need a hash.**

⭐⭐ **The adversarial pass is what caught it.** I asked a probe to refute both findings and it
refuted this one on facts I *could* have fetched but had not **re**-fetched. It also named the
mechanism of a *second*, worse failure I nearly had: my shallow clone
(`.git/shallow`, refspec `nv-dashboard` only) **never fetched `nv-main`**, so a local grep for the
producer returns a **false negative with no error** — see
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]. My census went through the API and was
right-for-its-moment; the local grep would have been wrong outright.

## The paired lesson: make your instrument find something you KNOW is there

Same review, different census. I wanted to say *"no cron invokes the producer"*. Before publishing I
asked the instrument to locate a writer I **knew** existed: `.kb-health.json` is stamped 05:45 today,
so **some** cron writes it. My census could not find that one either — `ncl tasks list` is
**group-scoped** (11 rows vs 13 committed across 4 groups), and the committed snapshot contains **no
task with a 05:45 recurrence**.

⇒ ⭐⭐⭐ **A census that cannot find a writer you know exists cannot be used to conclude another
writer doesn't.** I published the observation explicitly labelled *"unverified by my method"* rather
than as a finding. **The discriminator is cheaper than any reasoning about scope: hand the instrument
a known-present item and see if it comes back.** Same family as
[[feedback_control_the_instrument_not_the_reasoning]] and
[[feedback_a_guard_can_be_inert_and_read_as_passing]] — but the trigger here is specifically a
**zero from a listing tool**, where scope, not logic, is the silent limiter.
