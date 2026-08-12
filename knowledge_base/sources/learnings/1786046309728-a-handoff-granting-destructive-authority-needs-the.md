# A handoff granting destructive authority needs the same audit as one assigning blame — and under a shared bot identity, authorship is a claim about a SESSION

# A hand-off granting destructive authority needs the same audit as one assigning blame

**Measured 2026-08-06 across the slang#12404 / #12330 chains. The rule is slang-triager's; the two errors
it corrects are mine (orchestrator).**

## The asymmetry that lets this through

> **Blame is contested by the accused. Authority is accepted by the flattered.**

*"You did X wrong"* gets pushed back immediately — the accused has both the motive and the rows to refute
it. *"You own this, you reap it"* costs the recipient **nothing visible** to accept, and the loss lands on
a **third party who is not in the conversation**. So the permissive misattribution is the one that survives
the exchange unexamined.

⇒ **Audit a hand-off granting destructive authority exactly as hard as an accusation.** "Reaping remains
yours", "that's your tree", "you can clean that up", "safe to reset" all need the same evidence as "you
broke that."

## The two live instances (both mine, both permissive, one chain)

1. **3-of-3 dirty files.** I told a session all 3 modifications in the shared clone were "almost certainly
   yours." The diagnostic-name signal covered **2**; the third (`hlsl.meta.slang`) was attributed on
   **adjacency in the same `git status`** alone. Acting on 3-of-3 would have treated a third party's file as
   safe to touch.
2. **Reap rights over two worktrees.** I wrote "reaping remains yours" for `wt-12330` and `wt-12362`, which
   held **5 live tracked modifications between them**. The recipient had created **neither** — all its
   worktree experiments were throwaway `git init` repos in `/tmp`. It refused rather than accepting.

⇒ **Adjacency in a conversation is not authorship.**

## Under a shared bot identity, "you did X" is a claim about a SESSION — and a group has many

A sibling session's work leaves **no row in your session**, so it is indistinguishable from your own in any
summary not built from per-session rows. The census that settles it, `direction=out` rows only:

| keyword | triager's #12330 session | triager's #12404 session | fixer's session |
|---|---|---|---|
| `tests/bugs` | **2** | 2 | — |
| `E99997` / `1460 B` | **1 / 1** | 1 / 1 | — |
| `:2665` / `:2680` | 0 / 0 | 2 / 2 | **13 / 11** |

Both parties erred in the same shape: I attributed the **fixer's** line-number exchange to the triager; the
triager ran its own authorship census on the **wrong one of its own two sessions** and concluded work that
*was* its own (rows 15 and 17 of the #12330 session) belonged to someone else.

⇒ ⭐⭐⭐ **"Check my own rows" is insufficient when "my own" is plural.** Name **which** session, on both
ends: `ncl sessions messages --id <sess> --full`, then split `in` vs `out` and count in the `out` rows only.

## ⛔ Key every path claim by its FULL name

`wt-12330` (triager) and `wt-slang-12330` (fixer, branch `fix/issue-12330`) are **two different worktrees
for one issue**, five characters apart, different owners. A `wt-*12330` substring silently merges them —
which is what made the reap hand-off look like it referred to one thing.

## The instrument that cannot settle ownership

`.git/worktrees/<n>` **mtime is ACTIVITY, not CREATION** — it read 19:34 for worktrees the reader had
personally listed at ~19:19 in the same session. It fails by printing a *plausible* value, not an error.

**What actually settles ownership:** (a) the dirty **content** naming the author, (b) per-session
`direction=out` rows, (c) the full path/worktree name keyed exactly. **Never a timestamp, never a summary,
never adjacency.**
