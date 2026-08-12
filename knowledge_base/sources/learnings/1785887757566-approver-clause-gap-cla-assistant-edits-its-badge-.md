# [approver/clause-gap] cla-assistant EDITS its badge comment in place — an unedited comment means no re-evaluation, not "maybe already signed"

## Symptom

A chain was about to advise a fixer that a 3-week-old `license/cla = pending` on
shader-slang/slangpy#1054 was probably a **stale evaluation** — "re-trigger the
check before rewriting history; if it flips, no 7-commit re-author and the human
approval survives."

The two measurements behind it were correct:
- CLAassistant comment `4952125524` **unedited**: `created_at == updated_at ==
  2026-07-12T17:36:51Z`.
- `license/cla` on head `af81600` last evaluated **2026-07-29T10:15:15Z**.

The **inference was inverted**, and it pointed at the cheaper action, which is
the direction that gets the least scrutiny.

## Root cause / the discriminator

**cla-assistant EDITS its existing badge comment in place when the answer
changes.** Verified on a same-day control in a sibling repo
(shader-slang/slang-rhi#809, same bot account, same app):

```
comment 5179951238: created 2026-08-04T13:46:39Z  badge=not_signed
                    updated 2026-08-04T22:38:29Z  badge=signed     <- EDITED
force-push that changed the commit author identity: 22:38:24Z
```

The edit lands **5 seconds** after the push. So the app re-evaluates and rewrites
its comment promptly when its input changes.

That inverts the reading of an *unedited* comment:

| observation | wrong reading | correct reading |
|---|---|---|
| badge comment never edited | "nobody re-ran it — may already be signed" | **the answer never changed** — the account has not signed |

And on #809 the badge flipped **because the commit author identity changed**, not
because anyone signed. Same account (`nv-slang-bot` User id 286953280), same app,
same day, and #1054's comment stayed `not_signed` throughout. **If that account
had signed at any point, #1054's comment would have been edited too.** So a
re-trigger on #1054 returns `pending`, and the history rewrite is the likely path
rather than a fallback.

The staleness is real but load-bearing in the other direction: `pending` is stale
because **nothing on that PR has changed** since 07-29, not because the
evaluation lags a signature.

## How to catch it

Before treating any bot-posted status badge as stale-and-possibly-flipped:

```bash
# 1. Did the bot ever edit its badge comment? created_at == updated_at => never.
gh api repos/<owner>/<repo>/issues/<n>/comments \
  --jq '[.[]|select(.user.login=="CLAassistant")
        |{id,created_at,updated_at,edited:(.created_at!=.updated_at),
          badge:(.body|capture("badge/(?<b>[a-z_]+)")?.b)}]'

# 2. Find a CONTROL: the same bot on another PR where the state DID change.
#    If it edited there, editing is within its behavior => unedited is meaningful.
```

⭐⭐ **A BOT THAT EDITS IN PLACE MAKES "UNEDITED" AN OBSERVATION, NOT AN ABSENCE
OF ONE.** Whether silence carries information depends entirely on whether the
writer *would have spoken* — which is a property of the tool, testable against a
control, not something to assume in either direction.

⭐ **The generalizable move: when a timestamp gap admits two readings, find the
instance where the state DID change and see what the tool did.** One call. Both
PRs were already open in front of both parties.

⭐⭐ **Scrutiny asymmetry is the real hazard here.** The wrong inference was the
one that made an expensive fix (7 commits re-authored, dismissing a human's
standing approval) look possibly-free. It also arrived as *credit* — it was
chasing a caveat I had raised, so it came wearing my own name. **A conclusion
that flatters your own contribution and lowers the cost of the next action gets
audited least.** Test the exculpatory branch first, not last.

## Related instrument note

Do not probe commit authorship with a single index. On #1054 the App-authored
commit is **last** of 8, so `commits[0]` is a true positive and `commits[-1]` is
the false clean; on a differently-ordered PR the reverse holds. Which index lies
depends on push order ⇒ only `any(.author.id == <id>)` over **all** commits is
safe. A "check all N, not just the first" rule gets remembered by its worked
example, so a backwards example teaches the wrong probe.
