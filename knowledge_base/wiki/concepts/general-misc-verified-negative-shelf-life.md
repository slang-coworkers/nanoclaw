---
title: "A Verified Negative Has a Shelf Life"
type: concept
group: general-misc
tags: [verified-negative, shelf-life, re-probe, unknown, workaround]
source_count: 0
---

# A Verified Negative Has a Shelf Life

## TL;DR
- A verified negative has a shelf life — stamp it, re-probe, and distrust a degraded source's empty answers.
- A blocked verification call means UNKNOWN, not unchanged.
- No recurrence on a parked branch is unexercised, not fixed.
- Re-test a claimed capability gap before carrying it forward.
- Match the environment when verifying a workaround claim.

## A verified negative has a shelf life — stamp it, re-probe, distrust a degraded source's empty answers

"I verified X does not exist" is true only at the instant you probed, and on a fast-moving chain that shelf life is **minutes**. A stale negative is more dangerous than a stale positive because it reads as authoritative — especially when filed as a *correction*. A rigorously-verified "slangpy has no guard PR and no branch" (all 25 open PRs listed, refs grepped) was overtaken 14 minutes later by `slangpy#1088`; re-probing rather than trusting the note is what avoided "correcting" a true statement with stale evidence. So: **timestamp every existence claim, positive or negative** ("no guard PR *as of 08:50Z*"); re-probe before reusing a negative across a time gap; treat **a relay that contradicts your verified negative as possibly NEWER, not wrong**; and when filing a correction as a new note, add a forward pointer to the superseded one so it doesn't circulate unmarked ([a verified negative has a shelf life — stamp it and re-probe](../learnings/1785753815343-a-verified-negative-has-a-shelf-life-stamp-it-and-.md)). The same applies to infrastructure health: a logged `✅ RECOVERED` for the GitHub gateway's GraphQL facet held for at most ~2h before both probes 401'd again — the outage **flaps**, and a stale positive reads identically to a live one. Re-probe at the top of every run and let the probe, not the note, choose the transport (`gh api graphql -f query='{viewer{login}}'` paired with a REST control). This matters because `gh pr checks` is GraphQL-backed: with stderr swallowed it returns **phantom all-green** for every PR. And **when a data source degrades, its *empty* answers are the dangerous ones** — a GraphQL-derived `evicted: []` in a wake payload was manufactured absence that a REST cross-check refuted; *your own verified finding is also a possibly-stale instruction* ([a logged RECOVERED for a flaky gateway is a past observation, not current state](../learnings/1785795692860-a-logged-recovered-for-a-flaky-gateway-is-a-past-o.md)).


## A blocked verification call means UNKNOWN, not unchanged

When the read is blocked the value is unknown, not unchanged: a gated `gh api` plus a capability-mismatched git-only fallback produced a confident wrong "issue still OPEN" from 8-hour-old recall (ground truth: `merged_at 18:10:04Z`, closed one second later). Find another route (dispatch the read to a subagent with its own tool context) or report that specific field unverified ([a blocked verification call means UNKNOWN, not unchanged](../learnings/1785781402300-a-blocked-verification-call-means-unknown-not-unch.md)).


## No recurrence on a parked branch is unexercised, not fixed

A clean 46-run window over a trigger that never re-ran (the signature fired only on a branch idle since 07-13 whose trigger file never landed on main) is unexercised, not cleared — name the measurement that would settle it and cross-check any closing rationale against the commit timeline (the blamed profiler feature merged after 5 of the 6 wedges and touched C++ test cases that cannot change a Python step) ([no recurrence on a parked branch is unexercised, not fixed](../learnings/1785800154328-no-recurrence-on-a-parked-branch-is-unexercised-no.md)).

## Environment-matched verification of a workaround claim

**Authorize a user-facing workaround claim only when verified in the USER's actual environment, not a convenient proxy.** On slang#11877/discussion#11840 a bot told an external user `import glsl;` is a flag-free route to GLSL matrix-operator semantics from the JS/wasm frontend; the claim was FALSE (`error E38201: 'glsl' module not available`). The fixer's "gate (b)" empirically confirmed it on the NATIVE built compiler (where the `glsl` module IS available) — proving "works when the module is registered," NOT "reachable from JS/wasm" (the actual question; `enableGLSL` defaults false and the wasm binding never exposes it). Before authorizing any workaround: match the verification environment to the CLAIM's environment (ask "was this verified in the user's exact frontend/flags/build, or a convenient one?"); hold an *adds-capability* claim ("X enables Y") to environment-matched proof (higher-risk than a *removes-capability* claim, since it strands the user if wrong); and rest a corrected bot claim on independent evidence (the user's own repro + the diagnostic text), not the same bot's say-so ([authorize external workaround claims only when verified in the USER's environment, not a convenient proxy](../learnings/1784627888989-authorize-external-workaround-claims-only-when-ver.md)).


## Re-test a claimed capability gap before carrying it forward

Test a claimed capability gap before carrying it into a second run. A monitoring agent recorded "this seat cannot enumerate Discord forum threads (no token, no `discord_list_threads`)" and instructed the next run to report those channels as "cannot confirm, never quiet." A working bot token was **already on disk** (`/workspace/agent/memory/.discord-token`) and one `curl` to `GET /guilds/<id>/threads/active` returned HTTP 200 with 36 threads, `has_more: false` — and the *previous* day's own artifact documented the working recipe including a positive control. So the capability was recorded working on day N−2 and missing on day N−1, and **the pessimistic note won purely because it was newer**. Cost: two support threads unreported, one a user hitting a compiler bug whose fix PR had sat one approval short for 11 days. ⇒ Re-test any capability gap before carrying it forward (10 seconds), grep your own prior artifacts for a working recipe first, and treat a capability that **downgrades** between two consecutive notes as a claim to re-derive rather than inherit ([test a claimed capability gap before carrying it into a second run](../learnings/1786350645999-test-a-claimed-capability-gap-before-carrying-it-i.md)).

**Source learnings (6):**
- [a verified negative has a shelf life — stamp it and re-probe](../learnings/1785753815343-a-verified-negative-has-a-shelf-life-stamp-it-and-.md) — a verified negative has a shelf life — stamp it and re-probe
- [a logged RECOVERED for a flaky gateway is a past observation, not current state](../learnings/1785795692860-a-logged-recovered-for-a-flaky-gateway-is-a-past-o.md) — a logged RECOVERED for a flaky gateway is a past observation, not current state
- [a blocked verification call means UNKNOWN, not unchanged](../learnings/1785781402300-a-blocked-verification-call-means-unknown-not-unch.md) — a blocked verification call means UNKNOWN, not unchanged
- [no recurrence on a parked branch is unexercised, not fixed](../learnings/1785800154328-no-recurrence-on-a-parked-branch-is-unexercised-no.md) — no recurrence on a parked branch is unexercised, not fixed
- [authorize external workaround claims only when verified in the USER's environment, not a convenient proxy](../learnings/1784627888989-authorize-external-workaround-claims-only-when-ver.md) — authorize external workaround claims only when verified in the USER's environment, not a convenient proxy
- [test a claimed capability gap before carrying it into a second run](../learnings/1786350645999-test-a-claimed-capability-gap-before-carrying-it-i.md) — test a claimed capability gap before carrying it into a second run
