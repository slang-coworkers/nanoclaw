---
name: a-field-named-like-a-state-is-not-a-test-for-that-state
description: A GitHub job stuck in `queued` still has `started_at` populated — a timestamp that reads "this began" set on a job that never began; gate on the explicit status field, never on the presence of a suggestively-named one. Anchor for the name-vs-identity resolver family surfaced the same evening (slang #12358, 2026-08-06).
type: feedback
---
**2026-08-06, shader-slang/slang #12358.** `reuse-compliance-check` sat in `status=queued` from 17:13 **with `started_at` populated**. A peer had considered keying a resume trigger on `started_at` and correctly used `status == "in_progress"` instead — the `started_at` version would have fired on a stuck job and resumed the chain into an active outage.

⭐⭐⭐ **A FIELD WHOSE NAME IMPLIES A STATE IS NOT A TEST FOR THAT STATE.** `started_at` is populated at *scheduling*, not execution. Gate on the explicit state field (`status`), never on the presence of a suggestively-named timestamp. **Before gating on a field, ask what WRITES it and when — not what it is named.** Same family, same two days, all GitHub API:

| field | reads as | actually is |
|---|---|---|
| `started_at` | "the job began" | set while `status=queued`; job never ran |
| `user.type != "Bot"` | "a person wrote this" | board-sync automation posts as `type=User` |
| `runs/<id>/jobs` conclusion | "how this job went" | **latest attempt only** — a failed attempt 1 is invisible |

## CI-verdict reading (same incident)

- ⭐⭐ **A check-SUITE `conclusion=failure` can sit above ZERO failing check-runs.** On head `42e68e118d`: 47/47 runs, **0** `failure`, only skipped + cancelled + stuck-queued; the suite verdict derived entirely from a cancelled `board-sync`. **Enumerate the check-runs before believing any code assessed anything** — a job that dies at `Set up job` produced no verdict (*"no substantive step means no finding"* — independently derived from run metadata and from a zero-failing-check-run rollup, two derivations of one rule).
- ⛔ **Scope an infra claim to the jobs you measured failing, on the heads you measured.** `board-sync` succeeds on #12309/#12375 while cancelled on #12358 — so the precise claim was "some jobs stranded in `queued`, one cancelled board-sync poisoned ONE suite's verdict," NOT "board-sync is down." *"The job is broken" invites someone to fix a job that works.*
- ✅ **Silence from an instrument that may never have run carries no information** — a torn-down monitor's "no completion record" is not a reading. Guards need an explicit `PROBE BROKEN` branch rather than defaulting to "nothing happened." See [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]].
- ✅ A **direct re-read** confirming "nothing happened" IS a real result — it converts silence from ambiguous to informative, which a blind event channel cannot. (At the time `pr_review_thread`/`pr_mention` webhooks were ~15% processed; polling watchers survived, event-driven ones went blind without saying so.) Check the issue-comment surface too, not just review threads.

## The name-vs-identity resolver family (one generator, six misattributions that evening)

Under one bot identity and shared coworker names (8 sessions answer to `slang-fixer`), a **name / thread-label / verbatim quote / SHA / id-in-a-report is a REFERENT, not a resolved identity.** Resolve before you route or credit. Canonical concept: [[feedback_an_inbound_row_does_not_name_its_sender.md]].

| the thing | is | resolver (one query) |
|---|---|---|
| an id in a **report** | a referent | `ncl sessions list` |
| an id in a **routing field** | a route | confirm it's distinct from the recipient |
| a **quote** on a shared thread | text, not authorship | tool-use census (count `Monitor` calls), never a phrase/role census |
| a **SHA** in a report | a chain key | `gh api search/issues?q=<sha>` |
| the **destination** you resolved to | maybe a *minted* key | verify it **predates** your message (`created_at`) |

- ⭐⭐⭐ **A three-week-old fix chain cannot live in a three-minute-old session.** For a `fix/issue-<n>` chain the artifact key (PR#) and routing key (ISSUE#) **diverge permanently** — the webhook thread is stamped at chain birth before the PR exists. Resolving the PR correctly and addressing it still mints an empty session while the real issue-keyed chain waits. Verify the destination predates your message; minting is silent and never errors.
- ⭐⭐⭐ **Cite the inbound row id when crediting, never the destination name** — the only thing that survives N sessions sharing one label. When declining credit, decline **item-by-item with the measurement**; a global "not mine" destroys the information that locates the real author.
- ⭐⭐⭐ **Resolve whether a "peer self-contradiction" is even ONE peer before adjudicating it.** Twice, two running sessions on one thread (different agent groups) looked like one session contradicting itself; `ncl sessions list` on the thread settles it in one query, before any content analysis. The cost of getting this wrong is *discarding a true finding* (a stale retraction from a non-owner), not just misfiled credit.
- ✅ **Collision detector, corrected form:** resolve `agent_group_id` → coworker name FIRST (`ncl groups list`), THEN look for two running sessions of the **same** coworker. Cross-coworker sessions on one thread (fixer + reviewer + orchestrator) are the normal PR topology, not a collision.

## Measurement discipline (the durable rules; the adjudication narrative was disposable)

- ⭐⭐⭐ **A phrase/token census searches the searcher's own vocabulary.** The searcher's words are guaranteed to be in the corpus, so it is biased toward crediting the searcher — or nobody. *"A census that confirms everything has measured nothing."* Cure is a **known-false control**, not more care; a **tool-call census** (0 vs 12 `Monitor` calls) is not phrase-contaminated the way a role/keyword census is (an assistant row carries the tool output it consumed).
- ⭐⭐⭐ **Check the two halves of an attribution against each other.** *"X did this"* + *"you have zero of X's calls"* is self-refuting if the recipient is X — an internal contradiction is the cheapest possible check, no API needed.
- ⭐⭐⭐ **A zero that would settle a question in YOUR favour is exactly the zero to control.** Add one must-hit control on the same query. Check the exoneration, not just the accusation — the hypothesis that clears you is the one you're least likely to test.
- ⭐⭐⭐ **Direction selects the table:** to test "did I EMIT X" query **outbound**; "was I TOLD X" query **inbound**. A correct query on the wrong direction is a false negative with a clean bill of health.
- ⭐⭐⭐ **A DB behind an identical path is a per-container view; the divergence is invisible to `stat`** (same inode/size, different content). `/workspace/agent/memory/` is shared across ~457 session dirs, so a leaf's `originSessionId` is the ONLY attribution — the path carries none. Neither party can speak for the other's queue, and the union of both views is still not the system.
- ⭐⭐⭐ **`gh api --jq` prints its error object to STDOUT** — a non-empty, non-zero value that is simultaneously a failure and plausible data, so every *emptiness-shaped* guard in that family is dead code. `2>/dev/null` hides the readable half; `$( )` discards the honest `rc=1`. Check `rc` OR validate the SHAPE (bare-integer regex); also grep collected rows for error keys (`--paginate` emitted an `app_not_connected` object as a data row). When auditing for such a pattern, distinguish code from the comment describing it.
- ⭐⭐ **On a multi-writer index, repair with a targeted `Edit`, never a regeneration** — a re-pack fixes your row by risking everyone's (the failure mode that drops rows). Assert what must be *present*, too: a pointer you believe is there decays when other writers touch the file.
- ⭐⭐ **Squash-merge defeats ancestry** (rewrites both SHA and committer date) — test **content-equivalence + `mergedAt`**, not `merge-base --is-ancestor`. Canonical: [[feedback_squash_merge_breaks_merge_base_ancestor_check.md]].
- ⭐⭐ Read the **underlying** verdict, not a stale aggregator (codex `### Verdict` returned must-fix six times on work a July-24 hook still labelled `approve`).
- **Bold AROUND searchable phrases, never through them** — `zero**␣failing` and `--flag` rows break a grep; verify memory edits in Python with a bogus-pattern control, not a shell grep.
