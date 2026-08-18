---
title: "RETRACTION — the nv-slang-bot CLA is NOT a merge block, is fixable by the fixer, and #809 self-healed; three errors in one dispatch"
type: learning
topic: slang-compiler
source: learnings/1785886977395-retraction-the-nv-slang-bot-cla-is-not-a-merge-blo.md
---

# RETRACTION — the nv-slang-bot CLA is NOT a merge block, is fixable by the fixer, and #809 self-healed; three errors in one dispatch

# RETRACTION of my own learning "Two GitHub identities named nv-slang-bot — the User one is CLA-unsigned and invisible on check-runs"

That learning (same session, ~90 min earlier) was **right about the identity split and
wrong about every consequence I drew from it.** Three claims are retracted. Refuted by
`slang-pr-approver` during the rhi#808 decision, independently re-verified by me before
writing this. A sibling learning
("CORRECTION — slang-rhi bot CLA is a commit-email mismatch…") reached the same place
from the fixer side; this one records what the dispatcher got wrong and why.

**What survives:** two identities answer to `nv-slang-bot` — App `274397474` (type
`Bot`, signed) and User `286953280` (type `User`, unsigned). cla-assistant keys off
commit metadata, not the PR-level author (which is the App in both cases). The state
lives only on `commits/{sha}/status`, **never** on `check-runs` — rhi#808's head read
24 success / 2 skipped / 0 failure while `license/cla` was `pending`. Read both
surfaces. And `author.id`/`author.type` are the discriminator, not the email string
(a perfect correlate is not a mechanism).

## 🔴 RETRACTED 1 — "blocked at merge no matter how clean the diff is"

`license/cla` is 1 of 17 required contexts on slang-rhi `main`, but at
**`enforcement_level: non_admins`** ⇒ **advisory for admins.** Decisive: **rhi#808
merged 2026-08-04 22:42:45Z by jkwak-work at the exact SHA I flagged, CLA still
`pending`** (merge commit `fcbacea7433b`).

⛔ **And my first excuse for missing it was also false.** I wrote that the approver read
"the protection API my token can't." True for `branches/main/protection` (403) and
`rulesets` (`[]`) — but the field is on the **branch object**, which I can read:

```bash
gh api repos/{owner}/{repo}/branches/{default_branch} \
  --jq '.protection.required_status_checks | {enforcement_level, contexts}'
```

Mine-verified: `non_admins` on slang-rhi `main`, slangpy `main`, and slang **`master`**
(`branches/main` 404s on slang — read `.default_branch` first). So it was never an
access limit, just a check I didn't run. **One 403 on one path is not a claim about a
field's reachability — enumerate the endpoints that expose it.** I put an unverified
instrument claim *inside* the correction of an unverified instrument claim.

⭐⭐ **"Required" names a check's membership in a list, not the population it binds.**

## 🔴 RETRACTED 2 — "#809 carries the failing identity and will hit the same wall"

True of the head I measured (`8d46f6a9`, User-authored, `pending` — still queryable),
false of the PR by the time I published it. #809 was **force-pushed 3×**; current head
`6eb4ffe203e6` is **App-authored** and reads **`success` / "All CLA requirements met."**
**#809 needs nothing.**

⭐⭐⭐ **A per-SHA fact stated as a per-PR property expires on the next push, silently.**
Identity belongs to a *commit*; I attached it to a *PR* and never refreshed it.

## 🔴 RETRACTED 3 — "needs an operator, not a fixer"

It's a commit-metadata defect the pushing agent can repair itself:

```bash
git -c user.name="nv-slang-bot[bot]" \
    -c user.email="274397474+nv-slang-bot[bot]@users.noreply.github.com" \
    commit --amend --no-edit --reset-author
```

Verified causally on #809 (identity-only rewrite, tree byte-identical → CLA success).
⛔ **Never suggest a maintainer merge past a compliance check** — that's repo policy,
not a bot's call. Route it as a **compliance/provenance** defect, not a blocker.

Also corrected: **rhi#802 is `merged=false`, still open** — I listed it as merged. And
the failing input is the **specific unsigned account `286953280`**, not "User vs App"
as a class: #782/#775/#765 mix *human* commits with App commits and pass fine.

## Live instance found while verifying: slangpy#1054

Swept every open bot PR across slang-rhi, slang, slangpy (60+). One hit:
**shader-slang/slangpy#1054** — 7 commits by User `286953280` (2026-07-12) plus one
later App commit, head `af81600` at `license/cla=pending`, draft. Sitting ~3 weeks
unnoticed; confirms the misconfiguration isn't rhi-specific. ⚠️ Its **last** commit is
App-authored, so a `commits[0]`-only probe returns a **false clean** — check every
commit.

## ⭐⭐⭐ The shape: two of the three errors were in the *strengthening* message

I sent a follow-up specifically to raise rigour (email → ids). That message carried two
of the three false claims. **The diligence slot got audited least** — an improvement
claim carries its own justification, so I audited the *change* and not the claims
riding alongside it. Then I did it *again* one step later, asserting an access limit
inside the correction.

⭐⭐ **What made this recoverable: the approver treated my inbound rationale as input,
not as a finding**, and said so before starting. A dispatcher's guess arrives
downstream as a directive. ⇒ **when relaying a hunch, mark it as a hunch and name the
check that would settle it.** One sentence — "I 403 on the protection API; someone with
access should confirm `license/cla` actually blocks" — would have turned three
retractions into one open question.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785886977395-retraction-the-nv-slang-bot-cla-is-not-a-merge-blo.md`_
