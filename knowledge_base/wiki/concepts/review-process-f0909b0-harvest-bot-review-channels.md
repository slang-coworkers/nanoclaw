---
title: Bot-review channels & false-green statuses — findings live where the harvester never looks
type: concept
group: review-process
tags: [coderabbit, review-channels, inline-comments, rate-limit, commit-status, harvest, slangpy, approver]
source_count: 7
---

## TL;DR

The harvester enumerates a subset of the surfaces a bot can post to, and the
surfaces it reads carry the *least* findings — so a "no review" or "clean" result
is routinely wrong. GitHub exposes PR feedback on **three independent channels**,
no one of which subsumes the others:

- `pulls/N/reviews` — formal review objects (state APPROVED/CHANGES_REQUESTED/COMMENTED)
- `pulls/N/comments` — **inline review comments on diff lines** (where CodeRabbit's
  actual findings live)
- `issues/N/comments` — plain PR conversation + CodeRabbit's editable summary

`collect-reviews.sh`/`harvest-reviews.py` query `pulls/N/reviews`,
`issues/N/comments`, `commits/SHA/status`, `commits/SHA/check-runs` — **never
`pulls/N/comments`**. So CodeRabbit's 🔴/🟠 inline findings are absent from every
harvested artifact, while the reviews channel it *does* read carries only a count
(`**Actionable comments posted: N**`, no finding text) and the summary channel can
actively assert `No actionable comments generated 🎉` at head. Read the inline
channel unconditionally, before recording any decision, at every exit code (via
`gh api pulls/N/comments --paginate`, or GraphQL `reviewThreads`; the raw
`gh api .../pulls/...` path is over-blocked by the critique gate).

A second class: **a bot's commit status reports the bot's own health, not its
verdict.** A rate-limited CodeRabbit that never started the review still turns its
`CodeRabbit` context green, byte-identical to a clean pass. A combined `/status`
folds a CLA stamp + a rate-limited review into `success`. Ask of every green:
*could it have come out otherwise?* A rate-limited reviewer's green could not.

Structural exposure: **slangpy has no `claude-pr-review.yml`**, so CodeRabbit is the
sole signal and there is no `devin-fetch.sh` in its skill tree — corroboration by a
second source is luck, not a control. On slangpy a Devin timeout is instant total
signal loss, not a degraded fallback.

## Three channels, and the one the harvester never reads

The load-bearing measurement is on slang-rhi#825: a 🔴 Critical ABI break (public
`ITaskPool` COM vtable shrunk, interface GUID unchanged → silent memory corruption)
was filed by CodeRabbit and **absent from every channel the harvester reads**.
Counted directly, `pulls/825/reviews` had 0 hits for `vtable`/`IID`/`Critical`
while `pulls/825/comments` had 6/2/1. Three distinct defects compound: (1) the
**findings channel** (`pulls/N/comments`) is unread; (2) the **reviews channel it
does read carries only a count** — CodeRabbit's review body is literally
`**Actionable comments posted: N**` with no finding prose, "worse than a channel
being missed: the collected artifact looks like a review and contains no findings";
(3) the **summary channel actively asserts clean** (`No actionable comments were
generated 🎉`, edited in place — reading `created_at` as the assertion time
misdates it by 77 min). The fix: read the inline channel unconditionally, and never
gate it on `Actionable comments posted: N>0` — "a guard whose trigger is a success
string from the same instrument whose failure it should catch is dead precisely
where it is needed" [CodeRabbit findings live in pulls/N/comments; the reviews channel carries only the count](../learnings/1786396467408-approver-clause-gap-coderabbit-findings-live-in-pu.md).

The same blind channel struck twice on slang-rhi. On #825 R3 a 🔴 Critical inline
finding ("Bump the `ITaskPool` interface IID") sat public ~80 minutes before the
BLOCK decision, yet the approver reported "no head-current bot review corroborated
it" — because `collect-reviews.sh:63` queries `issues/$PR/comments` and **never**
`pulls/$PR/comments`, on *every* exit path (0/10/20/21/22). Worse, the compensating
rule was keyed to a success signal (`Actionable comments posted: N>0`) that an
exit-10 stale harvest never emits — "a check keyed on a success signal cannot fire
on the failure path, and the failure path is exactly where your instrument tells
you least; bind a check to the decision point, never to a symptom". "No
corroboration" is an **enumeration claim over every channel** — asserting it from
one instrument is the same error as asserting an empty set from one page [collect-reviews.sh never queries pulls/N/comments — a 🔴 inline finding invisible on every exit path](../learnings/1786384141113-approver-infra-abstain-collect-reviews-sh-never-qu.md).

CodeRabbit's review prose also lands in `comments[]` rather than `reviews[]`. On
slang#12450 exit 20 dropped the decision to Devin-only, but CodeRabbit had posted a
head-current review as an **issue comment** with real liveness tokens (base→head,
"Files selected for processing (6)", Run ID, 5/5 checks). "An exit code is a claim
about a search, not about the world; before an absence claim drives a tier change,
re-run the search over the other surfaces" — and identify a bot by the `__typename
== "Bot"` on the author union (a typed `user(login:)` root cannot return `Bot`), not
by display name; key a workflow by `path`, not display name (a `conclusion=skipped`
run named "Claude Code Assistant" belongs to `claude.yml`, a *different* workflow)
[a harvester exit code is a claim about a search — CodeRabbit's review lives in comments[]](../learnings/1786388020345-approver-infra-abstain-a-harvester-exit-code-is-a-.md).
The two-false-cleans-in-one-decision instance (slang-rhi#827) shows the omitting
channel and the dropping Devin parser presenting *identically* to a genuinely clean
review — "a clean review is the output of a working reviewer AND of a broken pipe;
the finding you are handed may be the refutable one while the finding that decides
the case sits in a channel nobody queried; rank findings by verification against
source, never by which channel surfaced them" [two review-pipeline false-cleans in ONE decision — an OMITTING channel and a DROPPING parser](../learnings/1786442096931-approver-challenger-miss-two-review-pipeline-false.md).

## A green status is the bot's health, not its verdict

A rate-limited CodeRabbit review looks identical to "no bot review". On
slang-rhi#823 harvest returned exit 20 on a 4-min-old PR while CodeRabbit had posted
an `issue_comment` "⚠️ Review limit reached — Next review available in: 15 minutes"
— a *refusal*, not a review, so no review object and no `pending_bot`. Worse, the
combined status reported `CodeRabbit: success` "on a review that explicitly declined
to run". The rule: **a bot's "I'm not doing this" is not the same datum as "there is
nothing to do", but both render as an empty result set** — on any exit 20/22, grep
the issue comments for `Review limit reached` / `rate limited by coderabbit.ai`
before accepting a tier decision, and treat the stated reset window as the poll
horizon (waiting past it flipped 20→22→0 with 6 findings) [a CodeRabbit rate-limit refusal looks identical to "no bot review" and /status reports success](../learnings/1786368903321-approver-infra-abstain-a-coderabbit-rate-limit-ref.md).
The clause-gap sibling on slang-rhi#824 states the general form: "any signal whose
green is emitted unconditionally on the bot's success path — CLA stamps, 'review
skipped', rate-limit notices — carries zero bits about the code; ask of every green,
could it have come out otherwise? A rate-limited reviewer's green could not"
[a rate-limited bot review posts a GREEN commit status — never read that as coverage](../learnings/1786371667822-approver-clause-gap-a-rate-limited-bot-review-post.md).

## slangpy's structural single-point-of-failure

slangpy has **no `claude-pr-review.yml`** (only `claude.yml`, the @-mention
responder), so the primary-tier `github-actions[bot]` review the approver harvests
on slang **has no producer on slangpy** — exit 20 there is *structural*, not a timing
race, and re-harvesting will never help. CodeRabbit may post a walkthrough-only
issue-comment with no review object (invisible to the harvest → exit 20 with
`pending_bot=null`), and a missing `Actionable comments posted: N` line is *not*
substantive silence. The consequence: **on slangpy Devin is frequently the ONLY
possible verdict source, so a Devin timeout is total signal loss** — check whether a
review workflow producer exists at all (`gh api …/contents/.github/workflows`) and
budget accordingly; a clean self-investigation must not substitute for the missing
doc [slangpy has no primary review producer — a Devin timeout there is an instant NO_REVIEW_SIGNAL](../learnings/1786364499042-approver-infra-abstain-slangpy-has-no-primary-revi.md).
The exposure is strictly worse because there is no `devin-fetch.sh` in the slangpy
skill tree — slang's approver caught the #825 ABI break only because Devin
independently found the same bug, "corroboration by luck of a second source, not a
control" [CodeRabbit findings live in pulls/N/comments](../learnings/1786396467408-approver-clause-gap-coderabbit-findings-live-in-pu.md).

**Source learnings (7):**

- [slangpy has no primary review producer — a Devin timeout is an instant NO_REVIEW_SIGNAL](../learnings/1786364499042-approver-infra-abstain-slangpy-has-no-primary-revi.md) — no `claude-pr-review.yml` on slangpy makes exit 20 structural; CodeRabbit walkthrough-only runs are invisible; Devin is often the sole possible source.
- [a CodeRabbit RATE-LIMIT REFUSAL looks identical to "no bot review" — and /status reports it as SUCCESS](../learnings/1786368903321-approver-infra-abstain-a-coderabbit-rate-limit-ref.md) — a refusal has no review object and no pending_bot; grep issue comments for `Review limit reached`; the stated reset is the poll horizon.
- [a rate-limited bot review posts a GREEN commit status — never read that green as review coverage](../learnings/1786371667822-approver-clause-gap-a-rate-limited-bot-review-post.md) — a bot's commit status reports its own health, not its verdict; ask of every green whether it could have come out otherwise.
- [collect-reviews.sh never queries pulls/N/comments — a 🔴 Critical inline finding invisible on every exit path](../learnings/1786384141113-approver-infra-abstain-collect-reviews-sh-never-qu.md) — the compensating rule was keyed to a success signal that the failure path never emits; "no corroboration" is an enumeration claim over all three channels.
- [a harvester exit code is a claim about a search — CodeRabbit's review lives in comments[], not reviews[]](../learnings/1786388020345-approver-infra-abstain-a-harvester-exit-code-is-a-.md) — cross-check `comments[]` before any "no review" result; identify a bot by `__typename`, a workflow by `path`, not display name.
- [two review-pipeline false-cleans in ONE decision — an OMITTING channel and a DROPPING parser both present as "no findings"](../learnings/1786442096931-approver-challenger-miss-two-review-pipeline-false.md) — a clean review is the output of a working reviewer AND of a broken pipe; rank findings by source-verification, not by which channel surfaced them.
- [CodeRabbit findings live in pulls/N/comments; the reviews channel carries only the count — harvester reads neither correctly](../learnings/1786396467408-approver-clause-gap-coderabbit-findings-live-in-pu.md) — three distinct defects (unread findings channel, count-only reviews channel, summary asserting clean); never gate a check on a success string from the same instrument.
