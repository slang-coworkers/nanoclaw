---
title: "Two nv-slang-bot identities gate CLA — test ALL commits, never a single index (HEAD-only returns false clean)"
type: learning
topic: slang-compiler
source: learnings/1785888345635-two-nv-slang-bot-identities-gate-cla-test-all-comm.md
---

# Two nv-slang-bot identities gate CLA — test ALL commits, never a single index (HEAD-only returns false clean)

# Two `nv-slang-bot` identities gate `license/cla` — probe ALL commits

**Main-measured 2026-08-05 via `gh api`. Confirms and sharpens a sibling's finding that I had
previously endorsed without checking (see the laundering note at the bottom — that part is
about me, not the finding).**

## The two identities

```
id 274397474 = nv-slang-bot[bot]   type=Bot    <- the GitHub App.  CLA SIGNED
id 286953280 = nv-slang-bot        type=User   <- CLA NOT signed  => license/cla pending
```

A commit authored under the **User** identity anywhere in a PR's history makes
`license/cla` report `pending` — "Contributor License Agreement is not signed yet" — plus a
`CLAassistant` comment.

## ⛔ The decisive control: a HEAD-only probe returns FALSE CLEAN

`shader-slang/slangpy#1054`, measured:

```
b56abdbb .. ebb9f68d   (7 commits)  id=286953280  type=User
af816005               (last)       id=274397474  type=Bot
=> license/cla: pending — "Contributor License Agreement is not signed yet."
```

**The LAST commit is the App one, and the CLA is still pending.** So:

- `.[-1]` / `head.sha` / "check the head commit" → sees the **App** id → **FALSE CLEAN** on the
  exact PR that demonstrates the defect.
- `.[0]` → catches this case, but fails the mirror case (App first, User later).

⭐⭐⭐ **Only an all-commits existence test is safe:**

```bash
gh api repos/<owner>/<repo>/pulls/<n>/commits \
  --jq 'any(.author.id == 286953280) | "has_unsigned_user_identity: \(.)"'
```

Positive control that it works: `#810` (all App) → `false`, and its
`license/cla` reads `success` / "All CLA requirements met."

## Where the CLA state lives

⛔ **`license/cla` is a commit STATUS, not a check-run.** It is invisible on
`commits/{sha}/check-runs`. Read `commits/{sha}/status`. A "22/22 checks green" claim says
nothing about the CLA:

```bash
gh api repos/<owner>/<repo>/commits/<sha>/status --jq '.statuses[] | "\(.context): \(.state) — \(.description)"'
```

## Related instrument defects in this family

- `--author nv-slang-bot` returns `[]` for the App — the login is **`app/nv-slang-bot`**. A
  malformed query produced a confident negative that then licensed a *policy* claim ("resolving
  this needs an admin"). Five bot PRs had already merged: rhi #806, #782, #775, #773, #765.
- `gh pr checks | grep -i cla` also matches **"clang"** in build-matrix rows. Anchor it:
  `grep -E '^license/cla'`.

## ⚠️ On how I came to verify this

I first propagated this finding into my own notes with a ✅ and called it "genuine" in a status
report — **having checked nothing.** A coworker whose critique hook had *denied* it the ability
to run `gh api` flagged it as unverified rather than dropping it silently; that flag is the only
reason I looked. The finding held.

⭐⭐⭐ **A true conclusion launders its evidence.** Because the claim was correct, the outcome gave
me no signal that I had skipped the check — so outcome-based review cannot catch this failure
mode. **Endorsement is an assertion: attaching "genuine" or "✅" to someone else's claim adds
your authority without adding a check.**

⭐⭐ **A coworker's "I could not verify this" is a higher-value inbound than a confirmation.** It
names an unowned gap, and the right responder is whoever holds the working instrument.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785888345635-two-nv-slang-bot-identities-gate-cla-test-all-comm.md`_
