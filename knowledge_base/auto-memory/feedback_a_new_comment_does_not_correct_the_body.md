---
name: feedback_a_new_comment_does_not_correct_the_body
description: "Appending a correction as a new comment notifies, but leaves the retracted claim at the TOP of the issue where a maintainer reads first. Measured on slang#12392: three comments deep, the body still asserted the withdrawn discriminator. Append for delivery, patch the body for durability — both, not either."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# A correction comment does not correct the body

**MEASURED 2026-08-06, slang#12392 (re-fetched at 15:41Z, one minute after the last correction landed).**
Two well-written retractions were posted as new comments. Both were correct, both were prominent, and
the **issue body still read** *"only `[shader("compute")]` crashes"* in its "Notes / scope" section,
with the Summary still framing the trigger as that one tag.

## The asymmetry

| instrument | notifies subscribers | fixes what a first-time reader sees |
|---|---|---|
| new comment | ✅ | ❌ |
| body edit | ❌ | ✅ |

⛔ **Neither alone is sufficient, and they are not substitutes.** `slangpy-triager` chose append
*deliberately and correctly* — its reasoning: the newest bot comments weren't its own, and the
correction carried an action item **GitHub only notifies on create**. That reasoning is sound for
*delivery*. It says nothing about *durability*.

⭐⭐⭐ **A maintainer opening a 3-comment issue reads the body first and may never reach comment 3.**
The retracted claim therefore keeps doing damage from the position of maximum authority — and here the
retracted claim was a **scope-narrowing** one ("only this tag crashes"), i.e. precisely the kind that
tells a reader what *not* to fix.

⚠️ **Superseded text inside a comment has the same problem one level down:** comment `5205479202`'s
*"Unchanged and independently verified"* list still enumerated the discriminator that comment
`5207068960` later withdrew. **A list titled "independently verified" ages into a false claim** unless
someone goes back and strikes the line.

## How to apply

- ⭐⭐ **Do both: append for notification, then patch the body (or strike the line) for durability.**
  Minimum viable patch is a one-line pointer at the retracted text — `~~only [shader("compute")]
  crashes~~ — withdrawn, see #issuecomment-NNN` — which costs one API call and needs no rewrite.
- ⭐⭐ **When you withdraw a claim, grep your OWN earlier comments for it.** Retractions cascade: a
  claim repeated in an "unchanged / still stands / independently verified" roll-up needs striking there
  too, or the roll-up becomes the surviving citation.
- ⭐ **"Verified" lists are dated assertions.** Prefer *"verified as of `<sha>`/`<date>`"* so a reader
  can see it may have aged, rather than a bare present-tense claim.
- ⚠️ **Never state that a chain's GitHub footprint is corrected without re-fetching the artifact and
  reading the BODY.** Comment-level bookkeeping reports on comments only — the same
  enumerate-only-what-you-know-about failure as
  [[feedback_a_shared_bot_identity_makes_authorship_unattributable_from_github]].

## ✅ CLOSED 15:45-15:47Z — and the SWEEP found 2 instances beyond the 3 I flagged

**Verified by me at source, not from the report.** `slangpy-fixer` patched as **edits**:

- **#12392 body** (`updated 15:45:53Z`): Summary generalized; the discriminator struck inline —
  `- **Discriminator — ~~…only [shader("compute")] crashes~~ WITHDRAWN.**` with the corrected matrix and
  a pointer to `5207068960`, stamped *"(Verified 2026-08-06.)"*; the superseded **"Suspected root
  cause"** heading now carries a `> **⚠️ Superseded — read 5205479202 instead**` block, body kept "only
  for the record".
- **#820 `5205392718`** (`15:47:32Z`) — the maintainer-directed one — patched **in place at the exact
  sentence**, so a reader who stops at the fix sketch sees the retraction without scrolling.
- **#768 `5197987080` + `5206900197`** (`15:47:34/35Z`) — ⭐⭐⭐ **two instances NEITHER of us flagged**,
  found only because the fixer applied the *rule* instead of my *list*: both still asserted *"#820's
  premise is half-true: the `[CUDAKernel]` half does not hit this"* — the same retracted claim, on the
  epic. Final sweep: zero unstruck.

⇒ ⭐⭐⭐ **A hand-listed set of artifacts to correct is itself a claim about coverage, and mine was 3 of
5.** Enumerate by grepping the claim across the issue family; never work from the list in the
dispatch. Same shape as [[feedback_publish_a_claim_as_wide_as_your_evidence]].

## ⛔ BUT THE GREP WASN'T 5 EITHER — 4 ASSERTIONS + 1 QUOTATION, AND PATCHING IT CAUSED A REGRESSION

**Caught by `slangpy-triager` at 15:53Z; repair verified by me at source.** Of the five hits, one —
#768 `5206900197` — **was the retraction itself**. Its match was a block quote introduced by
*"**Withdrawn — verbatim from Amendment 6:**"*. The sweep inserted a `[WITHDRAWN]` notice **inside**
that quote, so (a) a quote labelled *verbatim* no longer was, and (b) the retraction read as if it were
annotating its own quotation of the claim it withdraws. Repaired: quote restored, annotation moved below
the block, with an inline note recording the intrusion and its timestamp.

⭐⭐⭐ **A claim-string sweep cannot distinguish text that ASSERTS a claim from text that QUOTES it in
order to withdraw it — and because a good retraction quotes what it retracts, the BEST-CORRECTED
artifacts match hardest.** The sweep is therefore biased *against* the work already done well.
⇒ **Before patching a hit, classify the speech act: asserted / quoted-to-withdraw / cited-as-history.**
Cheap signals: a leading `> `, an enclosing "verbatim"/"superseded"/"withdrawn" label, or the claim
sitting inside a `<sub>` provenance note. **Quoted-to-withdraw needs no edit; annotating it is a
regression.**

⚠️⭐⭐ **And I amplified it, because the miss was disguised as a win.** I relayed *"the sweep found 2
instances neither of us listed"* as a coverage victory — so the extra hits got **celebrated rather than
triaged**. A hit count is not a defect count; ⇒ **when a sweep finds more than you expected, that is the
moment to classify, not to congratulate.** Both my "60%" figure and the "5 instances" figure were
wrong in the same direction: treating grep output as a defect list.

✅ **Their repair method is the pattern:** read-before-write against the live body, confirm the base is
unchanged, then edit — and **record the intrusion in the artifact** rather than silently reverting, so
the next reader can see why the annotation moved.

## ⛔ THE FALSE ALL-CLEAR THAT NEARLY SHIPPED: `nv-slang-bot` ≠ `nv-slang-bot[bot]`

The fixer's first sweep returned **zero hits** — it had filtered `login == "nv-slang-bot"`, but the
actual login carries the suffix. **A clean-looking scan that examined nothing.** Reproduced by me:

```
gh api repos/<o>/<r>/issues/<n>/comments --jq '[.[]|select(.user.login=="nv-slang-bot")]|length'      # 0
gh api repos/<o>/<r>/issues/<n>/comments --jq '[.[]|select(.user.login=="nv-slang-bot[bot]")]|length' # 4
```

⭐⭐⭐ **Every GitHub App identity carries `[bot]`. Any author filter written without it silently matches
nothing and reports "clean."** It was caught only because zero *felt* wrong against comments known to
exist, then confirmed with a positive control. ⇒ **A sweep reporting "nothing found" must prove its
filter can find something** — pair it with a control that MUST be non-zero. This is the
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] family; guard it in any scripted
classifier over bot comments.

## The durable restatement (the peer's, better than mine)

I framed it as *"append vs. body-patch — do both."* `slangpy-triager` sharpened it: **they are not a
choice, they are two separate questions** —

1. *Will anyone be notified?* → append (GitHub only notifies on create).
2. *What does a reader who stops early believe?* → patch the durable text.

⭐⭐ It answered (1), skipped (2), and **got away with it only because #820's body happened never to
carry the claim.** ⇒ **The rule is not "patch bodies too" — it is ENUMERATE THE ARTIFACTS BEFORE
CHOOSING THE REMEDY.** Choosing append-vs-edit on delivery grounds decides a durability question by
accident, and an innocent body makes the omission invisible. *A missing step that survives on luck is
harder to find than one that fails.*

Related: [[feedback_publish_a_claim_as_wide_as_your_evidence]] (propagating a correction means *every*
artifact that carried the wrong version — issue body PATCHED, not appended),
[[feedback_a_correction_on_the_epic_does_not_reach_the_child_issue]],
[[feedback_an_assignment_is_not_a_lock_re_fetch_before_publishing]].
