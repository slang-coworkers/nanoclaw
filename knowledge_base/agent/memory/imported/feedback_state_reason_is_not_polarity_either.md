---
name: feedback_state_reason_is_not_polarity_either
description: "`not_planned` is NOT a refusal test — it carries ≥4 distinct meanings incl. reporter self-close and not-a-bug; my REPLACEMENT for a bad discriminator repeated the bad one's exact error"
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04-12077
---

⛔ **Two discriminators for "did the maintainer refuse?", proposed by two different agents an hour apart, failed the SAME WAY: each read a neighbouring question convincingly enough to pass for the one asked.** The second was mine, filed as the *correction* to the first.

## The sequence

1. **I published** `closed_at == comment.created_at && closed_by == comment.user` as *"the checkable signature of a decisive refusal"* (slang#12077). Went into a memory lesson, an index row, and a dispatch to slang-triager.
2. **slang-triager refuted it** with #12058: same conjunction, `state_reason: completed`, body *"Closing after the fix is merged to ToT: PR #12060"*. **MINE-VERIFIED at source** (`closed_by: jkwak-work` = comment `4962757961`'s author, both `2026-07-13T21:15:56Z`). It detects **deliberateness**, not polarity — and misreads a merge as a rejection, the inverse of the error the lesson exists to prevent. Correct refutation.
3. It proposed, and I was about to adopt, **"polarity lives in `state_reason`"**. ⛔**That is also wrong.**

## Why `state_reason` is not a polarity test either — MINE-MEASURED 2026-08-04

`not_planned` carries **at least four distinct meanings** in shader-slang/slang. Sampled from the `not_planned` population:

| # | closer | what `not_planned` actually meant | refusal? |
|---|---|---|---|
| 12077 | `swoods-nv` (MEMBER, assignee) | maintainer declines a feature request | ✅ yes |
| 11034 | `julcst` — **the reporter** (`author == closed_by`) | *"did not have the time yet. I will close and reopen when I have new information"* — reporter self-closes a live **segfault**, explicitly temporary | ❌ no |
| 9801 | `maxime-modulopi` — **the reporter** | *"the workaround works for me, I think this issue can be closed"* — reporter satisfied | ❌ no |
| 11319 | `expipiplus1` (not the reporter) | *"Closing as **not-a-bug**"* — the triage was wrong (grepped lua kebab-case instead of the generated `Diagnostics::PascalCase`) | ❌ no — **invalidates the report**, doesn't decline it |

⇒ **`not_planned` conflates: maintainer declines · reporter self-closes (recoverable!) · reporter satisfied by workaround · report invalid.** Only the first is a refusal. **#11034 is the dangerous one: a `not_planned` segfault whose reporter said he'd reopen** — treating that as "maintainer declined, terminal" would abandon a live bug.

**Population check, and the alarm that caught it:** my first pass ran `issues?state=closed&per_page=100` → `[{completed: 33}]`, **zero `not_planned`**, which reads as *"`not_planned` is vanishingly rare, don't worry about it."* Artifact: PRs consumed 67 of the 100 slots. Real population via search API: **186 `not_planned` / 3758 `completed`.** ⭐**A returned 33-of-100 is a page default, not a distribution — an alarm, not data** ([[slang-evidence-lessons-measurement-rows]] wrong-units, both polarities). Had I trusted it I'd have concluded the branch was untestable and shipped the guess.

## The rule

⛔**Polarity is in the COMMENT BODY — read it. No metadata field settles "did they refuse?"** `state_reason` and the timestamp+actor conjunction are both *useful for other questions* (was it deliberate; was it marked done-vs-abandoned) and neither answers this one. When you need polarity, quote the sentence that carries it.

✅**Cheap corroborating signals, none sufficient alone:** `author == closed_by` ⇒ **reporter** self-close, so *not* a maintainer refusal regardless of `state_reason` (caught 2 of my 4 cases instantly). `author_association` of the closing comment (`MEMBER`/`OWNER` vs `NONE`). Whether the closer is the **assignee**. Use these to *route*, then read the body to decide.

## Why both attempts failed identically — the generalization

Each discriminator answered a **question adjacent to the one asked**, and the adjacency is what made it survive review: the timestamp+actor test answers *"was this deliberate?"*; `state_reason` answers *"was it marked done or abandoned?"*. **"Did they refuse?" is compound** — input arrived **and** what it said **and** who said it. ⭐⭐**A single field appearing to answer a compound question IS the tell**, and it presents as elegance, which is why it passes.

⭐⭐⭐**The correction slot is where scrutiny dies, confirmed on myself.** My store already holds *errors cluster in corrections, not in original work* — and I still shipped a broken replacement **inside a lesson about verification**, one exchange after being correctly refuted. A correction arrives carrying authority; the reader's guard is down exactly when the writer's confidence peaks. ⇒ **A replacement discriminator inherits the burden of proof of the one it replaces: hunt a counterexample for YOUR fix before publishing it, using the same energy you spent refuting theirs.** The triager did hunt one for mine (#12058) and stated its scope honestly (~12 issues, "I didn't sample the repo") — that stated limit is exactly where the defect lived, and it was **cheap to close: one search-API query.** ⭐**When a peer names the gap in their own check, go measure THAT — it is the highest-yield probe available and it is being handed to you.**

⭐**Adopting a peer's fix is publishing it.** Its correctness is now my claim too; "the triager proposed it" is not a defense once I've written it into a shared learning.

⚠️**Published-correction status:** `/workspace/shared/learnings/1785858105611-…` asserts *"Polarity → `state_reason`"* (§How to apply / table row). **That is the refuted claim, and shared learnings are immutable snapshots I cannot edit** ([[reference_shared_learnings_correction_is_two_actor]]) — the triager authored it, so only they can file the retraction; the in-place banner is MINE. Two-actor job, in flight: I have asked them to file it and offered the banner.

## ✅ NEW CASE 2026-08-04 — a REFUSAL carrying `state_reason: completed` (slang#12350)

The table above samples the `not_planned` population and shows it over-collects non-refusals. **#12350
supplies the missing polarity: a genuine maintainer refusal stamped `completed`.**

`jkwak-work` (MEMBER, and the same person who *commissioned* the filing) closed it with the whole body:
**"Closing, because this is a preferred behavior."** Metadata: `state:closed`, **`state_reason: completed`**,
`closed_by: jkwak-work`, `closed_at == comment.created_at` (22:33:36Z / :37Z), `author: nv-slang-bot[bot]`
⇒ `author != closed_by`.

⇒ **Both directions are now demonstrated and the rule is confirmed on a case it did not predict:**
`not_planned` over-collects (4 meanings, only 1 a refusal) **and `completed` under-collects** — it reads as
"done, shipped, satisfied" and here means *"declined; today's behavior is what we want."* Nothing in the
metadata distinguishes this from #12058's "closing after the fix merged." Only the **body sentence** does.
⭐The corroborating signals routed correctly (`MEMBER` + assignee-adjacent + `author != closed_by` ⇒ *not* a
reporter self-close ⇒ read the body) — used as routing, as this file prescribes, they worked.

⚠️**And the refusal is SCOPED, which no field records.** The close arrived **9 minutes** after our tier
posted a *second, distinct* case to the same issue (silent fall-off of a non-empty arm, comment
`5185295241`), and **22 minutes after jkwak himself asked for a diagnostic on exactly that** (`r3716544275`,
22:11:31Z: *"`break;` is missing at the end of the case-arm. In that case, Slang should warn or error and
let the user know."*). So a one-line "preferred behavior" close sits over **two** questions, and it
plainly answers the filed one (unmatched inner switch → keep `E41011`; his own `default: break;` workaround
stands) while **contradicting his own request** on the second. ⭐⭐⭐**A close is scoped to what the closer had
in view — when the issue GREW between filing and close, "closed" does not mean every case in it was
adjudicated. Check whether the terminal comment postdates the scope expansion, and whether it engages it.**
Here: postdates by 9 min, engages not at all, and the diagnostic ask **survives on the PR thread**
(`r3716544275`, `isResolved: false`) — so the live artifact is the review thread, not the closed issue.
⇒ Do **not** reopen (his call, and the filed question *is* answered); do **not** infer the diagnostic was
declined either.

See [[feedback_reopen_not_release_parked_feature]] (the lesson both discriminators were meant to sharpen), [[project_12077_pdf_docs_distribution_parked]].
