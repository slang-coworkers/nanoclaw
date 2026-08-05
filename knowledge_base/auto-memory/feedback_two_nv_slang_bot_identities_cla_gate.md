---
name: feedback_two_nv_slang_bot_identities_cla_gate
description: "TWO GitHub identities named nv-slang-bot (App id 274397474 vs User id 286953280); the User one trips license/cla=pending and is INVISIBLE on the check-runs surface — discriminate with author.id/type, never the email string. ⛔The gate is enforcement_level=non_admins ⇒ ADVISORY for admins, NOT a merge block: rhi#808 merged with CLA still pending."
metadata:
  node_type: memory
  type: feedback
  tags:
    - slang-rhi
    - cla
    - approver
    - webhook-routing
    - identity
  originSessionId: 76f8cc33-c26d-449b-aace-01612f2502f6
---

**Two distinct GitHub identities answer to the name `nv-slang-bot`.** Measured on
shader-slang/slang-rhi 2026-08-04 via `pulls/{n}/commits --jq '.[0].author'`:

| identity | `login` | `type` | `id` | CLA outcome |
|---|---|---|---|---|
| the App installation | `nv-slang-bot[bot]` | `Bot` | `274397474` | `license/cla=success`, **no** CLAassistant comment |
| a standalone user account | `nv-slang-bot` | `User` | `286953280` | `license/cla=pending`, `not_signed` badge comment |

cla-assistant keys off the **commit author identity**. The App has signed; the User
account has not. A PR whose commits are authored by the User identity sits at
`license/cla=pending` — a provisioning/identity defect in whatever pushed the branch,
fixable only by an **operator**, never by a fixer or a code review.

## 🔴 RETRACTED — "blocked at merge no matter how clean the diff is"

**My original wording claimed a merge block. It is not one.** `license/cla` is among
17 required contexts on `main`, but at **`enforcement_level: non_admins`** ⇒ it is
**advisory for admins**. Decisive evidence, not inference: **rhi#808 MERGED at
2026-08-04 22:42:45Z by jkwak-work (admin) at the exact SHA I flagged, with
`license/cla` still `pending`** (merge commit `fcbacea7433b`; the pending status is
still queryable at `87a82f5b3509` today). Found by `slang-pr-approver`.

⛔**And the excuse I first reached for was itself false.** I wrote that the approver
"read the protection API my token can't" — true of `branches/main/protection` (403) and
`rulesets` (`[]`), but the field is exposed on the **branch object**, which I *can*
read: `branches/main --jq '.protection.required_status_checks.enforcement_level'` →
`non_admins`, mine-verified. So this was **not** an access limit; it was a check I
never ran. See the reachable-endpoint recipe under *How to apply*.

## 🔴 RETRACTED (4th) — I "corrected" a concession the approver never made

Having found the reachable endpoint, I sent it back to the approver as a correction:
*"you conceded that this needs an API your token 403s on — it doesn't."* **They never
conceded it.** Their own artifacts read: *"`branches/main` reports `license/cla` is a
required status check, with `enforcement_level: non_admins`. (Read via `branches/main`
after `branches/main/protection` returned 403 — one adversarial retry on a different
path; both attempts named.)"* They used **exactly the endpoint I was handing them**, and
their `non_admins` ledger value came from it. Grep across their review docs, memory index
and topic file finds no such claim.

⛔⭐⭐⭐**AND I HAD THEIR ARTIFACT IN MY CONTEXT.** I ran `head -40` on their learning
file earlier in the same session — the recipe is at **lines 19-25**, with the comment
`# 403 for an App token — do NOT stop here`. I read a truncated view, formed "403 and a
shrug" from their *report's* terse phrasing, and never re-read the file I had already
opened. ⇒ **Characterizing what someone else's artifact SAYS is a claim about a
retrievable text — grep it, don't recall it.** Recall is at its most confident exactly
where it paraphrases something you skimmed.

⭐⭐⭐**This is the same defect as the other three, one layer up: a real mechanism
(the endpoint works) attached to an unverified consequence about *someone else's*
position.** And it is the most expensive variety, because the target is a peer's
competence — I spent their credibility to make a point they had already made better.
⚠️**The trigger to watch: the sentence "you conceded X."** It is a quotation claim
wearing the clothes of a correction; it requires the same instrument as any other
quotation (open the source), and it reads as generous ("I'm helping you") while
asserting something falsifiable about another agent's work.

⚠️They own half: their report's "403 and a shrug" phrasing invited the misread. But a
terse summary is an invitation, not a cause — the artifact was one grep away.

⭐⭐**The right frame: it's a CLA-compliance/provenance problem, not a mergeability
problem.** What actually landed in `main` is App-authored (`fcbacea7433b`, author id
`274397474`, squash by `web-flow`) and **no commit by User `286953280` is in `main`** —
verified. So the exposure is upstream of the merge, in what the pushing tool signs as.

## 🔴 RETRACTED — "#809 carries the failing identity"

**True when I measured it, false when I published the generalization, and I never
re-probed.** #809's head at my read (`8d46f6a9f252`) *was* User-authored and `pending`
— that commit still resolves and still shows `pending`. But #809 was **force-pushed
three times** (14:11:58Z, 22:38:24Z, 22:50:07Z); its current head `6eb4ffe203e6` is
**App-authored** (`274397474`) and its CLA reads **`success` / "All CLA requirements
met"**, with the CLAassistant comment flipped to a `signed` badge (`5179951238`,
updated 22:38:29Z). ⇒ **#809 needs nothing.** My "#809 will hit the same wall when it
leaves draft" was a prediction about a head that no longer existed.

⭐⭐⭐**A per-SHA fact stated as a per-PR fact expires on the next push, silently.** The
identity is a property of a *commit*; I attached it to a *PR* and let it age. Cf. the
standing rule that a live artifact read is a measurement with a timestamp.

## 🔴 CORRECTED — "#802 merged"

I listed `#802` among "merged/clean bot PRs". It is **`merged=false`, still open.** Its
CLA is `success` and it does carry the App identity, so it remains valid as a
*CLA-outcome* control — but not as a *merged* one. Sloppy transcription on my part; the
`state=closed&merged!=null` query I ran to build the control set never included #802,
and I added it from the open-PR scan without re-checking.

## Corrected evidence table

| PR | commit author ids | CLA | merged |
|---|---|---|---|
| rhi#808 | **User `286953280`** | `pending` | **YES** — admin merge, gate bypassed |
| rhi#809 | was User, **now App `274397474`** | **`success`** | no (draft) |
| rhi#806 | App | `success` | yes |
| rhi#802 | App + skallweitNV | `success` | **no — still open** |
| rhi#782 / #775 / #765 | App **+ a human** | `success` | yes |
| rhi#773 | App only | `success` | yes |
| slangpy#1054 | **User `286953280`** + App | `pending` | no (draft) |

⭐⭐**The failing input is the specific unsigned account User `286953280` — not
"User-vs-App" as a class.** #782/#775/#765 mix *human* commits with App commits and
pass CLA fine, which my "App identity signed / User identity didn't" framing implied
they shouldn't. The approver caught this narrowing; it makes the escalation target much
more precise.

**Live instance beyond slang-rhi (found by sweeping all open bot PRs across the three
repos, 60+ PRs): `shader-slang/slangpy#1054`** — 7 commits by User `286953280` (from
2026-07-12), one later App commit, head `af81600` at `license/cla=pending`. Draft, so
not urgent, but it is the same defect sitting unnoticed for ~3 weeks and it confirms
the misconfiguration is not rhi-specific. Every other open bot PR in slang-rhi, slang,
and slangpy is clean.

## ⛔ It is invisible on the check-runs surface

`commits/{sha}/check-runs` on rhi#808's head returned **24 success, 2 skipped, 0
failure** — a sweep of that surface alone reads the PR as fully green. The CLA lives
only on `commits/{sha}/status` (`state: pending`, context `license/cla`). This is the
**same two-surface trap** as
[[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]]: "zero
failing checks" is a claim about one of two independent APIs. Read both.

## ⭐⭐ The method lesson — a true correlate is not the cause

My first dispatch reported the discriminator as the commit **author email string**
(`nv-slang-bot@…` vs `274397474+nv-slang-bot[bot]@…`). That correlated *perfectly*
across all 8 PRs, and I sent it to the approver as the finding. It was true and it
was a **proxy** — the email differs *because* the identities differ. Had a peer acted
on it, they'd have looked for an email-formatting bug in the push tooling rather than
a wrong-account defect.

⇒ **When a string field separates your cases cleanly, ask what it is a shadow of
before publishing it as the mechanism.** `author.id` / `author.type` are the fields
that actually discriminate identity; the email is a rendering of one. Cite the ids.
Cheap to check (same API response, no extra call) and it changes who owns the fix.
Cf. [[feedback_control_the_instrument_not_the_reasoning]] — the defect was in what I
measured, not in how I reasoned about it.

## How to apply

- **Dispatching a reviewable bot PR to a `*-pr-approver`:** read
  `commits/{head}/status` as well as `check-runs`, and if `license/cla` is `pending`,
  say so in the dispatch with the identity ids — so the approver's recorded reason
  names the real blocker instead of sending a human auditor into the diff.
- **Diagnosing "why is this bot PR showing a CLA badge when everything is green":**
  ```bash
  gh api repos/{o}/{r}/pulls/{n}/commits --jq 'any(.author.id == 286953280)'
  ```
  ⛔**`any()` over ALL commits — every single-index probe is unsafe in one direction, and
  I got the direction backwards.** I wrote that #1054's App commit being *last* makes
  `commits[0]` a false clean. It's the reverse: `commits[]` is chronological, so on #1054
  (7 User commits **then** 1 App commit) `[0]` returns a **true positive** and **`[-1]`
  is the false clean.** Approver's catch. ⚠️The general point survives and is the one to
  keep — *which* index lies depends on push order, so no single index is safe; only
  `any()` is. ⭐**A "check all N, not just the first" rule stated with a worked example
  gets remembered by its example — so a wrong example teaches the wrong probe.**
  cla-assistant evaluates all committers.
- **Don't call it a merge block.** It is `enforcement_level: non_admins` ⇒ advisory for
  admins, and an admin has already merged straight through it. Report it as a
  **compliance/provenance** defect.
- ✅**READ THE ENFORCEMENT SCOPE — the endpoint IS reachable, contra my own first
  correction.** `branches/{branch}/protection` 403s for an App token, but the *branch*
  object carries a protection **summary** that does not (this is the approver's recipe,
  independently re-run by me — not my discovery):
  ```bash
  gh api repos/{owner}/{repo}/branches/{default_branch} \
    --jq '.protection.required_status_checks | {enforcement_level, contexts}'
  ```
  ⛔**I wrote "you cannot verify enforcement from your seat" into the fix advice one step
  after being corrected — a second unverified claim about an instrument, inside the
  correction of the first. One 403 on one path is not a claim about the field's
  reachability; enumerate the endpoints that expose it.** "Required" names a check's
  membership in a list, never the population it binds.
- ⛔**THE CLA GATE IS NOT FLEET-WIDE — mine-verified 08-04, all `non_admins`:**

  | repo | default branch | required contexts | `license/cla` required? |
  |---|---|---|---|
  | slang-rhi | `main` | 17 | **yes** |
  | slangpy | `main` | 13 | **yes** |
  | slang | **`master`** | 3 (`check-formatting`, `check-ci`, `SlangPy Tests`) | **NO** |

  ⇒ **a clause written from slang-rhi's shape misfires on slang.** ⚠️And `branches/main`
  **404s on slang** — read `.default_branch` first, or the false negative reads as "no
  protection at all." (Both refinements from the approver, re-run here.)
- **The escalation is the dispatcher's, not the approver's** — the approver is
  shadow-mode and posts nothing; only an operator can re-provision the pushing
  identity or get the User account to sign.
- A pre-existing note already said "slang-rhi bot PRs are gated by an unsigned-CLA
  check ⇒ operator escalation" ([[project_slang_12349_vulkan_pb_pushconstant_pipeline_layout]],
  gate 5). That was correct but under-specified: it reads as *all* rhi bot PRs, when
  in fact it is only commits by User `286953280` — and the merged App ones prove the
  gate is passable. **A blocker stated without its discriminator reads as unconditional
  and invites the wrong fix** (abandon the PR for an issue, rather than fix the
  identity).

## ⭐⭐⭐ Why I got three things wrong in one dispatch, and the approver got them right

All three retractions share one shape: **I generalized from a correct measurement
without re-probing, and the approver re-probed.** Specifically —

- the merge-block claim: inferred from "required context" **without access to the field
  that decides it** (`enforcement_level`), and stated as fact rather than as an
  inference I couldn't check;
- the #809 claim: a per-SHA reading published as a per-PR property, then not refreshed
  across three force-pushes;
- the #802 claim: a control-set member added from a different query than the one that
  defined the set, never re-verified against the set's own criterion.

⭐⭐**Two of the three were in the *strengthening* message** — the one I sent
specifically to correct myself and raise rigour. The diligence slot got audited least
(cf. [[feedback_control_the_instrument_not_the_reasoning]], the diligence-slot rule).
An improvement claim carries its own justification, so I audited the *change* (email →
ids, correct) and not the *claims travelling alongside it*.

⭐⭐**The load-bearing detail: the approver treated my inbound rationale as input, not
as a finding** — it said so explicitly before starting. That is what caught this. ⇒
**when relaying a hunch downstream, mark it as a hunch and name the check that would
settle it** — here, "I 403 on the protection API, so someone with access should confirm
whether `license/cla` actually blocks." One sentence would have converted three
retractions into one open question.
