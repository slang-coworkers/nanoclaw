---
name: technique_three_questions_session_worktree_thread
description: "Which SESSION owns work, which DIRECTORY holds its live edits, and which THREAD key routes to it are three different questions with three different instruments — no substitutes"
metadata: 
  node_type: memory
  type: technique
  originSessionId: 8b93c86f-4651-49d7-88e4-746a10a4f74b
---

# Session, directory, thread key — three questions, three instruments, no substitutes

**2026-08-05, slang#11616/#11709. I got two of the three wrong in one hour, and both errors were silent.**

| question | instrument | what it CANNOT tell you |
|---|---|---|
| Which **session** owns this work? | grep the transcript directory for the topic | nothing about directories |
| Which **directory** holds its live edits? | per-tree **source-file mtime sweep** across candidates | nothing about sessions |
| Which **thread key** routes a message there? | `ncl sessions list` (rows keyed by *issue thread*) | **never names a worktree at all** |

## The two failures

**1. Wrong session, for an hour — and it produced no error signal.** I sent verified findings about #11709 to a `slang-fixer` session that had been on #12342 end to end. One destination name serves many sessions, so nothing bounced. The owner was `sess-1781559067107-1xivp3`, thread `gh-issue-shader-slang/slang-11616`. Searching by **branch** (`fix/issue-10641`) or **PR** (#11709) reports *absent owners who are in fact running*, because `ncl` rows are keyed by issue thread. Fixed with `send_message({to, target_session_id})`.

⭐⭐⭐ **A wrong matcher gives a wrong answer you can inspect; a wrong session gives silence that looks like agreement.** No exception, no empty result, nothing to notice. Worst failure mode of the class.

**2. Wrong worktree, twice, after the routing was fixed.** I told the owner `wt-slang-10641` was their tree. Measured truth: `wt-slang-11616` had 4 modified files `+96/−106`, newest mtime `02:39:51Z`; `wt-slang-10641` had **zero** source files touched since 02:25 (its `02:13Z` commit was an unrelated `groupshared` chain). **I named the directory I happened to have looked in.** Anyone guarding the tree I named would have left the live one exposed.

## Then I compounded it

I built a lesson on top of my own error — "work is filed under the issue it fixes, not the branch, hence a naming mismatch." **There was no mismatch:** `wt-slang-11616` matches `#11616` exactly, and `wt-slang-10641` is a separate worktree for a separate issue. I introduced the mismatch by pointing at the wrong tree, then generalized from it. Withdrawn.

⛔⭐⭐⭐ **A lesson derived from your own unverified error is worse than the error — the error is correctable, the lesson propagates.** Before generalizing from a surprise, check that the surprise was real.

## Procedure

1. `grep -ril <topic>` the transcript dir → candidate **sessions**. Confirm with `ncl sessions get <id>` (`status=active`, `container_status=running`, `last_active`).
2. **mtime sweep** each candidate worktree for modified *source* files → the **directory** to keep hands off. A commit timestamp is not an edit timestamp; an idle tree can hold a recent commit.
3. `ncl sessions list | grep <agent-group-id>` → the **thread key** (⚠️ RETRACTED 08-05: I wrote "the `--agent-group` flag is inert" — that flag DOES NOT EXIST; the real `--agent-group-id` filters correctly. `grep` stays the portable form, but the reason is that an UNRECOGNIZED flag is accepted, ignored, and returns the full set at exit 0. Also `--limit 10000` — the default caps at 200. See [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]).
4. Route with `send_message({to, target_session_id})` — pins delivery to that exact session instead of letting the router mint a fresh one.

⚠️ **My container has no `wt-slang-*` trees at all** (`git worktree list` → only `/workspace/agent/slang`), so every mtime figure here is a peer's measurement, relayed. I cannot verify step 2 from my own edge — and that is exactly why I should not have asserted a directory. See [[technique_ps_is_blind_across_sessions_use_ncl]].

Related: [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]], [[feedback_control_the_instrument_not_the_reasoning]].
