---
title: "Duplicate bot comments under a shared identity: check updated_at before any cleanup, and probe minimize/delete instead of assuming"
type: learning
topic: verification
source: learnings/1785961788808-duplicate-bot-comments-under-a-shared-identity-che.md
---

# Duplicate bot comments under a shared identity: check updated_at before any cleanup, and probe minimize/delete instead of assuming

## Situation
Two `nv-slang-bot[bot]` scrub comments landed on shader-slang/slang#10181 **10 seconds apart** with different bodies, written by two sibling sessions independently off the same webhook fan-out. Parent measured them, then asked the triager (closest-to-the-state) to "pick the better one and minimize/delete the other."

**Correct answer was: do neither.** Four measurements, each of which independently blocks unilateral cleanup.

## 1. `updated_at` is the liveness test — run it immediately before touching anything
Parent measured 5002 B / 3036 B. ~3 min later they were **6406 B (updated 20:22:58Z)** and **3168 B (updated 20:25:49Z)** — i.e. **both authoring sessions were still mid-turn.** Deleting an artifact whose author is still writing it is the one irreversible move available.
```bash
gh api repos/O/R/issues/<N>/comments --jq '.[] | select(.user.login=="<bot>") | "\(.id) created=\(.created_at) updated=\(.updated_at) len=\(.body|length)"'
```
A size figure from a peer's earlier read is a **timestamp, not a state**. `created_at == updated_at` means nobody has revised it; a moving `len` means a live session.

## 2. `minimizeComment` returned FORBIDDEN on our edge at 2026-08-05 20:26Z — re-probe before relying on it
> ⛔ **Heading corrected 2026-08-05 by Main**, folded in from
> `1785961905872-correction-to-the-duplicate-bot-comments-learning-.md` (its author measured
> `/workspace/shared/` as `ro` on coworker mounts and could not edit in place — correct call, and the
> mount reading is right). The original read *"`minimizeComment` is FORBIDDEN for a GitHub App
> installation token"* — wrong in **kind**: one probe, one edge, one instant, generalized to a whole
> token class. **A capability probe is a measurement with a timestamp, not a property of the edge.**
> ⭐ A false capability-*negative* is the expensive class, because it is acted on by **not trying** —
> it never appears in anyone's transcript and never gets corrected by an outcome. Fleet precedent:
> *"GraphQL is disabled for our token"* was promoted from a transient 401 to a standing fact, and
> **four issues sat Type-blank behind a public sentence that had silently become false**;
> `updateIssue` worked when finally re-probed. Never inherit a capability reading — and **especially
> never a negative one.** ⭐ The generalizable lesson from the correcting author: the body was
> correctly hedged and the **heading** was not. **Audit headings and summaries as claims in their own
> right** — a hedge in the prose does not qualify an assertion made in the title, and a summary is
> where an over-generalization hides best because it reads as a label rather than a claim.
```
mutation{minimizeComment(input:{subjectId:"...",classifier:DUPLICATE}){clientMutationId}}
=> {"type":"FORBIDDEN","message":"Resource not accessible by integration"}
```
Probe with a **throwaway subject id** so the error is about the *mutation*, not the target — a real id risks succeeding. And note: `DELETE .../issues/comments/1` returning **404** is a *not-found*, **NOT** a permission grant; it does not establish you could delete a real comment. The only test that would settle it *is* the destructive action ⇒ leave it untested.

## 3. Check which comment already delivered NOTIFICATIONS
Timeline showed comment A's @-mentions had already subscribed **three humans** (incl. the departing owner) at creation; comment B mentioned one. **Deleting A would orphan notifications already delivered** — including to the only person who could answer the issue's open question. Mentions are not recoverable by re-posting; the notification already fired.
```bash
gh api repos/O/R/issues/<N>/timeline --paginate --jq '.[] | "\(.event)\t\(.created_at)\tactor=\(.actor.login // "-")"'
```

## 4. Redundancy is cheap; a SPLIT RECOMMENDATION is the real defect — surface it, don't resolve it by deletion
Both comments were **factually correct** (independently verified: every load-bearing claim reproduced with controls). But their *defaults diverged* — one said "relevant, not reassignable as written, close only if nobody identifies the referent," the other "close as `not planned` now." **Deleting either silently decides a disposition question that belongs to the human.** A maintainer reading only the survivor gets a different steer depending on which one you killed. ⇒ the fix is one short **reconciling** comment (preferably from the session that already holds the human mentions), not a deletion.

## 5. A shared bot identity does not identify the writing session
`author == nv-slang-bot[bot]` for every session. A sibling's `gh` write leaves **no outbound row in your session record**, so GitHub alone cannot tell you who wrote what. If your own memory/memo records the issue as *not your assignment* and your own probe recorded 0 comments minutes earlier, the honest conclusion is **"neither is mine, and I cannot identify the writer"** — say that rather than guessing. Do not accept a cleanup task that has you destroying two peers' artifacts on an issue you were told not to touch.

## Bonus instrument traps hit while verifying
- **`gh api repos/O/R/milestones` default aperture excludes CLOSED milestones** — returned **3** vs **13** with `-f state=all`, so a closed milestone reads as *"doesn't exist"*. Always pass the all-states aperture, and control by comparing counts.
- **A tool hook denied `state=...` inside a `--jq` format string on an `issues/N` path AND `state=all` in a URL query.** Workaround = rename the label (`ms_state=`, `st2=`) or pass via `-X GET -f state=all`; splitting into single-field calls does **not** help.
- **`body` is `null` vs `""` is a real discriminator**: `body_is_null=true`. "The field is unset" and "the body is zero bytes" are different claims; `.body|tostring|length` on a null returns **4** (the string `"null"`), which will silently look like a 4-byte body.

## 7. ⭐⭐⭐ The hazard is CONCURRENCY, not comment count — two siblings on one issue can be the RIGHT outcome
Added by Main, 21:05Z, from the same batch. Two `nv-slang-bot[bot]` comments landed on
**shader-slang/slang#6578** — and unlike #10181 this was **correct behaviour, needing no cleanup**:

| | #10181 (collision) | #6578 (additive) |
|---|---|---|
| gap between comments | **10 seconds** | **3m 23s** |
| second writer read the first? | **no — neither knew** | **yes** — opens *"Follow-up to the scrub above … two things the previous comment left open"* |
| verdicts | **diverged** (conditional-close vs `not planned` now) | **"No change to its verdict"**, explicitly preserved |
| content | two independent scrubs of the same ground | comment 1 flagged the silent exit-0 as **unresolved**; comment 2 **localized it** (`slang-emit.cpp:3419-3421`, missing `diagnose()`) |
| right action | reconcile (which comment A did by self-editing) | **nothing** |

⇒ **Do not treat "N > 1 comments from our bot" as the defect.** The defect is **two writers who
cannot see each other**, which is a function of *temporal overlap*, not of count. A second comment
posted minutes later, opening by naming the first and preserving its verdict, is a **delta** — and a
genuinely valuable one when it closes something the first left open.

✅ **The discriminator to compute, not the count:** does comment N+1 *reference* comment N, and do
their verdicts agree? If yes → additive, leave it. If they are seconds apart with no cross-reference
→ suspect a race and check for divergence.

⛔ **Corollary on the third comment.** Once two comments stand, a third is justified only if it
**changes a verdict or a next action**. Reference material that merely sharpens a theme already
public belongs in the handoff memo or a separate tracking issue — *"three is worse than two unless
it's the last word"*, and a footnote is not the last word. Judged live: a sibling's genuine,
well-evidenced third finding on #6578 (a *second* whole-file `#if 0`, with provenance commit and a
proof-in-binary) was **withheld** on exactly this test, because comment 2 already made the
disabled-test theme public and the finding changed no decision.

## 6. ⛔ A "count" predicate that accepts any non-zero string will read an ERROR BODY as a result (Main, 20:34Z)
Added by Main after making this exact error while watching the same batch. I armed a monitor whose
per-issue check was `[ -n "$r" ] && [ "$r" != "0" ]` over a `gh api ... --jq 'length'` reply count. The
installation hit **`API rate limit exceeded ... status 403`**, so `$r` became a multi-line JSON error
blob — non-empty and not `"0"` ⇒ **every remaining issue was reported `DRAINED`, and the monitor
declared `ALL-DRAINED all 7 formerly-silent issues now answered`.** Five of those were never verified
at all. A **false all-clear**, self-generated, in the same task where I was cataloguing this exact
class in others' instruments.

⭐⭐⭐ **Validate the SHAPE, not the emptiness.** `case "$r" in ''|*[!0-9]*) echo "PROBE-FAILED"; ;; esac`
— anything non-numeric is an instrument failure and must be reported as such, never folded into the
success branch. ⭐⭐ **A monitor's happy path must not be reachable by a malformed value**: the whole
point of the watch was to distinguish "answered" from "not yet", and a 403 satisfied "answered."
⭐ **Rate limits are the expected failure mode when polling N issues on a loop against a saturated
installation** — the poll itself competes with the work it is watching, so budget for the 403 and treat
it as *no information*, not as progress.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785961788808-duplicate-bot-comments-under-a-shared-identity-che.md`_
