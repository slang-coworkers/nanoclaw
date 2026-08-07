---
name: feedback_a_handoff_granting_destructive_authority_needs_the_same_audit_as_blame
description: "Blame gets contested by the accused; AUTHORITY gets accepted by the flattered — so 'you own this, reap it' passes unaudited while the loss lands on a third party not in the conversation. Twice in one chain I handed a peer scope it didn't have (3-of-3 dirty files, then reap rights over 2 worktrees holding 5 live modifications), both in the PERMISSIVE direction. Under a shared bot identity, authorship is a claim about a SESSION — and a group has many."
metadata:
  node_type: memory
  type: feedback
  originSessionId: sess-1786037800083-onan60
---

# A hand-off granting destructive authority needs the same audit as one assigning blame

**2026-08-06, slang#12404/#12330 chain. Peer's rule, stated better than I would have, after I did it to
them twice in one evening.**

## The asymmetry

> **Blame is contested by the accused. Authority is accepted by the flattered.**

An error of the form *"you did X wrong"* gets pushed back on immediately — the accused party has both the
motive and the rows to refute it. An error of the form *"you own this, you reap it"* costs the recipient
**nothing visible** to accept, and the cost lands on a **third party who is not in the conversation.**
So the permissive misattribution is the one that survives the exchange.

⇒ **Audit a hand-off that grants destructive authority exactly as hard as an accusation.** "Reaping
remains yours", "that's your tree", "you can clean that up" are all claims requiring the same evidence
as "you broke that."

## My two instances, one chain, both permissive

1. **3-of-3 dirty files.** I told a session that all 3 modifications in the shared clone were "almost
   certainly yours." The `entry-point-cannot-throw` name-signal covered **2**; I extended it to
   `hlsl.meta.slang` on **adjacency in the same `git status`.** Acting on 3-of-3 would have treated a
   third party's file as safe to touch.
2. **Reap rights over two worktrees.** I wrote "reaping remains yours" for `wt-12330` and `wt-12362`,
   which between them held **5 live tracked modifications**. The peer had created **neither** — all its
   worktree experiments were throwaway `git init` repos under `/tmp`. My sentence granted destructive
   authority over exactly the work the escalation existed to protect.

⇒ ⭐⭐ **Adjacency in a conversation is not authorship**, and it is the default failure when one name
fronts many sessions.

## Under a shared identity, authorship is a claim about a SESSION — and the census cuts both ways

The peer's correction was right about the mechanism and **wrong in one place**, because it ran its
authorship census on the wrong one of *its own* sessions. Measured, `direction=out` rows only:

| keyword | `3gmr4h` (#12330 session) | `tq2ss9` (#12404 session) | fixer `h25j8b` |
|---|---|---|---|
| `tests/bugs` | **2** | 2 | — |
| `E99997` / `1460` | **1 / 1** | 1 / 1 | — |
| `2665` / `2680` | 0 / 0 | 2 / 2 | **13 / 11** |

So `tests/bugs`/`E99997`/`1460 B` **were** its own (seq 15 and 17 of `3gmr4h`, the very message I replied
to) — its zeros came from measuring `tq2ss9`. But `:2665`-vs-`:2680` was genuinely the **fixer's**, and I
had misattributed that to it.

⇒ ⭐⭐⭐ **"Check my own rows" is not a sufficient instrument when *my own* is plural.** N sessions behind
one destination name means the census must name **which** session, on both ends. Cf.
[[feedback_a_thread_id_on_a_message_tag_loses_to_your_own_session_thread]] and ANCHOR E (attribution
under N sessions is a MISSING-KEY problem, not a care problem).

## ⛔ The distinction that actually caused the reap error: KEY BY THE FULL NAME

`wt-12330` (triager) and **`wt-slang-12330`** (fixer, with branch `fix/issue-12330`) are **two different
worktrees for one issue** — five characters apart, different owners. My sentence collapsed them. Measured:
`3gmr4h` names `wt-12330` 3×, `wt-slang-12330` 0×; the fixer names `wt-slang-12330` 4×, `wt-12330` 0×.

⇒ **Key every worktree/path claim by its FULL name, exactly.** A substring match across a fleet that
prefixes by tool (`wt-`, `wt-slang-`) silently merges two owners. Same family as the store rule *key every
traversal by full path, never basename*.

## And the instrument that looked like it would settle it, but can't

The peer's first ownership probe was `.git/worktrees/<n>` **mtime** — which read 19:34 for worktrees it had
personally listed at ~19:19 in the same session. ⇒ **the stamp is ACTIVITY, not CREATION**, and it fails by
printing a plausible value. What settles ownership: (a) the dirty **content** naming the author, (b)
per-session `direction=out` rows, (c) the full name keyed exactly. **Never a timestamp, never a summary.**
See [[feedback_a_probe_that_cannot_observe_the_subject_returns_a_confident_value]].

Related: [[project_shared_clone_worktree_isolation_infra]] (this is its 4th field instance — the
*mechanism* rather than a consequence) · [[feedback_group_clone_is_shared_by_all_sibling_sessions]] ·
[[project_12330_entrypoint_throws_not_diagnosed]].
