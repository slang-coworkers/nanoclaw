---
name: feedback-issue-opened-webhook-is-not-evidence-the-issue-is-new
description: "issue_opened webhook is a past action, not current state; read live state (state/closed_at FIRST, then comments) before dispatching, or you triage a withdrawn or already-triaged issue"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# `issue_opened` does not mean "not yet triaged"

**Measured 2026-08-07:** received `github.issue_opened` for slang#12316 and dispatched a full triage request to `slang-triager`. The issue was opened **2026-08-01** and had been **triaged 2026-08-03** — a substantial public comment (source-read at `53b76e6d3`, 3 cheapest-first options, Issue Type set to `Refactoring`). The webhook was ~6 days stale. `comments_count: 2` was already on the issue at dispatch time.

**Why:** webhook `event` names the *originating* action, not the current state. Delivery latency, replay, and backfill all produce `issue_opened` for issues that have since moved on. My dispatch cost the triager a redundant-work decision and put a second "please triage" on a thread whose triage was the top comment.

**How to apply:** for ANY issue/PR webhook, one read of live state before dispatching — `github_get_issue` and look at `comments_count`, `updated_at` vs `created_at`, and whether a bot triage comment already exists. Cheap (one call) and it decides the routing: fresh → triage; already triaged → route the *new* input to whoever holds the state.

⭐ **One tell is `updated_at` far from `created_at`** on a supposedly-new issue. #12316: created `2026-08-01T22:18:04Z`, updated `2026-08-07T19:03:38Z`.

⛔ **2026-08-10 — SECOND INSTANCE, AND THE STALENESS TELL ABOVE MISSES IT ENTIRELY.** slang#12457 arrived as `issue_opened` with a full, detailed E41035 wave-op false-positive report. I dispatched a long triage brief off the payload. The author had **closed it 44 s after filing** (`created 19:58:06Z`, `closed_at 19:58:50Z`, `state_reason=completed`) and **replaced the entire body** with *"Sorry I did not mean to press enter on filing this issue, I'll close."* — a premature submit. `slang-triager` caught it on its first live read and refused to post a bot comment into a thread a human had deliberately withdrawn; it recovered my (faithful) technical content from GraphQL `userContentEdits`.

⭐⭐⭐ **Here `updated_at` was 44 s from `created_at` — the freshest-looking issue possible — and the delta tell would have PASSED it.** The staleness framing of this rule was right about what it named (late/replayed webhooks) and wrong about what it covered. The general fact is stronger: **a webhook payload is a SNAPSHOT OF A PAST ACTION; the body and the state can both change before I read it.** Two independent failure modes, one check.

⇒ **Read `state` / `closed_at` / `state_reason` FIRST, before `comments_count` or any timestamp delta** — a closed-as-withdrawn issue needs no triage at all, and that is one field, not an inference. Then compare the payload `body` against the live `body`: if they differ, the payload is not what the reporter is standing behind. ⭐ **Do not treat a webhook body as quotable content** — dispatching a verbatim brief from it published a report the author had already retracted.

⭐⭐ **Credit where it lands: the downstream tier's first act was the live read I skipped.** A one-call gate at my tier would have cost nothing; instead the triager spent a turn on premise repair. The check belongs at the routing tier, not the working tier — the working tier catching it is luck about who reads carefully, not a mechanism.

## ⛔ 2026-08-10 — THIRD MODE, caught by reading rather than by the gate: A BOT-FILED ISSUE'S TRIAGE IS ITS BODY, SO `comments_count: 0` IS NOT "UN-TRIAGED"

slang#12461 arrived as `issue_opened`, author **`nv-slang-bot[bot]`** — our own shared identity, filed by
a coworker as a byproduct of the live #12442 fix chain. Live read at dispatch time: `state=open`,
`closed_at=null`, `comments_count=0`, body identical to the payload, `created_at 21:08:26Z` /
`updated_at 21:08:48Z` (22 s apart), labels `bug` + `reproduced` + `Test Agent Finding` already applied.

⭐⭐⭐ **Every gate this leaf prescribes PASSES that issue and routes it to a fresh triage — and a fresh
triage would be re-doing work already published.** The body carried the repro, the verified master SHA,
the isolated gate (`-g2`/`-g3` vs `-g0`/`-g1` occurrence table), a dedup search naming three adjacent
issues, self-applied `reproduced`, and a deliberately-undecided language fork left for a human. The
triage content lives in the **body**, so a comments-based freshness check reads zero, forever, correctly.

⇒ ⭐⭐⭐ **Read the AUTHOR before deciding the tier.** A human-filed issue's body is a *report* (needs
triage); OUR bot-filed issue's body is a *verdict* (needs independent verification + the open decision
routed, not a restatement). Same field set, opposite routing. Third instance of the family pattern:
**a correctly-stated rule aimed at the wrong scope** — this leaf was right about late/replayed/edited
payloads and silent about who wrote the thing.

⚠️ **And the shared identity makes the dispatch decision batch-shaped, not chain-shaped.** #12460,
#12461, #12462 all landed inside ~7 minutes, each minting its own Main session; a sibling had already
dispatched #12460 to `slang-triager` before I looked at #12461. Consistency-with-the-sibling is not the
test — a self-filed issue whose body is already the report can want a *narrower* dispatch (verify the
claim, recommend on the open fork, comment only if it ADDS) than a human-filed one. See
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] and
[[feedback_sibling_write_under_shared_bot_identity]] — under one identity a restating comment reads as
the same author echoing itself, and **churn under a shared identity is worse than silence.**

✅ Honest provenance: this was **not** a measured failure — I caught it while reading the payload, before
dispatching. Recorded because the gate above would not have caught it, and the next session reading only
the gate will route it wrong.

### ⭐⭐⭐ 2026-08-10, #12462 — the same mode 5 min later, with a CHEAPER AND STRONGER detector than the author field: **MY OWN SESSION ROWS ALREADY CONTAINED THE FILING REPORT**

slang#12462 ("render-test blanks the HLSL prelude for every non-NVAPI run") arrived as `issue_opened`,
author `nv-slang-bot[bot]`, `created 21:13:50Z`. Live read: `state=open`, `closed_at=null`,
`comments_count=0`, body byte-identical to the payload, labels already applied — **every gate in this
leaf passes it**, exactly as the #12461 entry predicts.

But the decisive fact was not on GitHub at all. `ncl sessions messages --id <my #12442 session> --full`
→ row 80, timestamped **21:18Z**: `**Status:** **FILED #12462**` from `slang-triager`, reporting the
filing **on my own dispatch** (my row 81 at 20:40Z: *"Taking it to triage on its own thread. Don't file
it yourself"* → the triager filed it because I told it to). The webhook was me being notified of my own
instruction being carried out.

⇒ **Before routing any webhook, grep your own session transcript for the issue number.** One command,
and it distinguishes *"new work"* from *"my own completed dispatch echoing back"* — which the author
field only hints at (a bot-filed issue could still be another instance's, needing verification) and the
live GitHub state cannot show at all. `--full` is required: **the default 300-char truncation made my
first `grep -c "12462"` return 0 on the very session that contained three mentions** — a false zero that
would have licensed the dispatch. Same instrument-collapse family as the `grep -oc` unit trap.

⚠️ **What the chain actually lacked was not triage but a RESUME PATH.** #12462 is a *decision request*:
its next actor is a human maintainer answering one of two questions — a trigger nobody on our side
controls, i.e. precisely [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]. Dispatching
a triage would have produced churn under a shared identity; the correct output was a gate. Armed
`i12462-maintainer-gate-5e32` (`0 */6 * * *`, `/workspace/agent/gates/i12462-maintainer-gate.sh`),
proven on 5 controls varying one thing each: #12442 → `HUMAN_REPLY`, #12457 → `CLOSED`, bogus id →
`PROBE_FAILED`, and — the limb that actually matters — **#12428 and #12371 (open, comments 1–2, ALL
bot-authored) → `wakeAgent:false`**, so the false-`false` is not luck about a zero comment count and our
own bot's next comment cannot self-trigger the gate.

⇒ ⭐⭐ **"Not a triage" is not "nothing to do."** The routing question has three answers, not two:
dispatch / no-op / **build the resume trigger the chain is missing**. A self-filed decision request is
the shape that looks most like a no-op and is least like one.

Related: the closest-to-the-state principle means a stale-webhook dispatch also aims at the wrong tier — the state holder, not a fresh triager, owns the reply. See [[project_12316_type_layout_policy_duplication_techdebt]].
