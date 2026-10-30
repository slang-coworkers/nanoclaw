---
type: system
title: Standing hazards and corrections
description: Operational hazards and past corrections for the Orchestrator's memory and tooling — moved verbatim out of Core Memory on 2026-09-29 so Core Memory holds facts, not banners.
---

# Standing hazards and corrections

Moved verbatim from `memory/index.md` → Core Memory on 2026-09-29 (operator tidy). Core Memory now carries a
one-line fact for each item below; the full context, evidence and history stay here.

⚠️ **CORRECTED 2026-09-02 (memory-integrity-scan).** The old pointer here — *"the live store is the native path `/home/node/.claude/projects/-workspace-agent/memory/`, index `MEMORY.md`"* — is **stale**. That native store was migrated into `imported/` on **2026-08-30** and then **retired**: verified 2026-09-02 it is EMPTY (dir + `.git` last modified 2026-08-30 15:42, 0 recoverable git objects; the rest of `~/.claude` persists fine). **The live store is now this OKF store — the bulk of leaves live in [`imported/`](imported/index.md)** (router [imported/MEMORY.md](imported/MEMORY.md), ~1250 leaves; the OKF synth cron writes new leaves there daily). Reindex / orphan-audit: `bash /workspace/agent/memory/imported/reindex.sh [--check]` (the native-path reindex.sh is gone with the store). This stale pointer was *itself* the "stale index that passes every structural check" failure the two-store banner below warns of. **Operator to confirm the retirement was intended (escalated 2026-09-02).**
⛔ **NO COUNT IS RECORDED HERE ON PURPOSE.** A count in a pointer is stale the moment the next leaf lands — this line once said *"517+ files"* while the real figure was ~1035, understating by ~2x. For live figures run `bash imported/reindex.sh --check` (prints leaves / reachable / ORPHANED and the tightest shard's headroom).

✅ **Superseded 2026-09-27 (verified live 2026-09-29):** the host now bounds `readSessionMessages` (two-phase read: seq keys first, then content for the returned ≤`limit` rows; nanoclaw `e24a7ec64`, `9b0003065`). A `--reverse --json --limit 400` read of the dashboard session returned in ~1s with no wedge. Still avoid a large `--offset` (bounded, but costly). The history below is kept as the reason the rule existed.

⛔ **(Historical, pre-09-27) NEVER `ncl sessions messages` / `sessions get` on the main dashboard session `sess-1776713576150-9fon2n`** (or any huge old session). The read is unbounded, so `--limit` doesn't cap it. It wedges my session's host pickup and every later `ncl` call times out, including sends and task updates. This happened twice on 2026-09-26 (05:32Z, 13:33Z), and the second time the shared learning already existed. To find operator replies, grep `conversations/*.md` instead. Recovery: back up `/workspace/outbound.db`, then delete only my undelivered read-only `cli_request` rows. [learning](/workspace/shared/learnings/ag-1776713211742-1w6l4e/1790403484197-ncl-sessions-messages-on-a-huge-old-session-can-we.md)

Verified 2026-08-04: this file was the untouched OKF template ("Nothing stored yet"), dated Jul 15.

⛔ **Two-store hazard (kept — this is why the archive is a distinct folder).** The
[ported lego-operator archive](legoop-archive/index.md) holds **52 `legoop-*.md`
operator facts that exist ONLY here** (all absent from the live store's index). It is a
distinct namespace, not a copy of anything. ⛔ **A `cp` in EITHER direction destroys the
other store entirely** — they are fully disjoint, not divergent-with-overlap. Never sync
these; different stores that only share a shape. ⭐ *An old mtime is evidence about
writes, never about relevance.* A stale index that passes every structural check — file
present, links well-formed, confident phrasing — is the failure mode this banner exists
to prevent. (2026-08-19: the archive, formerly a loose `MEMORY.md` + 52 root siblings,
was folded into `legoop-archive/` with `type:` frontmatter on each file.)

⚠️ **`ncl: command timed out after 30s` does not mean the write failed (2026-10-18).** Seen with
`ncl tasks create`: the create went through, and my retry made a second copy of the one-shot
(`rechase-13737-pr13741-f5e0` next to `-a71d`). `ncl tasks cancel` then timed out the same way. ⇒ **After a
timeout on a mutating `ncl` verb, list first (`ncl tasks list --json`, filter by name) and retry only if
the row is absent.** Read verbs (`list`) also time out sometimes; just retry those. Cheapest check for one task: `ncl tasks get <id>` and read `status` (2026-10-18: a timed-out `cancel` of `rechase-13271-followups-dada` had in fact landed, `status: cancelled`).

⚠️ **`send_message` returning `database is locked` does not tell you whether the row landed (2026-10-19, slangpy#1226).** Two sends to `slangpy-triager` errored this way and neither landed; the third send landed. Before you retry, read the recipient session's newest rows with `ncl sessions messages <sid> --reverse --json --limit 3`; rows carry `text`, not `content`. If the row is there, a retry sends a duplicate. Run `ncl` reads serially, because concurrent `ncl` calls cause the same lock. A send on a peer thread with unanswered inbound rows also needs `in_reply_to=<seq>`; without it the router refuses the send.

⚠️ **Once a final response has a `<message>` block, text outside it is not delivered (2026-10-21, slang#13789).** At 13:11Z
I put a `<message to="orchestrator-dashboard">` block and, after it, plain text meant for the fixer ("don't file,
send me the draft"). Only the dashboard row went out. Fixer session `4lrs0a` has no inbound from me, and my
own session shows one out row. Plain text goes to the current sender only when the response has no `<message>`
block. ⇒ **When a response sends to anyone with a `<message>` block, every peer instruction needs its own block
(with that task's `thread_id`).** Check: one block for each recipient I mean to reach.

⚠️ **Observed 2026-10-22: a pinned `send_message` (`thread_id` plus `target_session_id`) to a long-lived coworker session reroutes that coworker's later `to="parent"` reports onto the thread I pinned.** I sent slang-ci-babysitter a #1223 note pinned to its main session `hia2o3` with `thread_id=gh-issue-shader-slang/slangpy-1223`. After that, its 18:1x and 20:00Z sweep reports and progress pings (msgs 104/106/108) landed in my slangpy-1223 webhook session. Its 14:05Z sweep, sent before the note, went to Main's usual session (conversations/2026-10-22-conversation-3.md). Recurring task fires did not reset the route. ⇒ **Before pinning a one-off note to a coworker's long-lived main session, expect its routine reports to follow that thread until a different inbound resets it.** Handle them where they land. Prefer sending the note without a pin on the issue's own thread when the context in its main session isn't needed.

⚠️ **A `target_session_id` pin loses to the implicit `in_reply_to` (2026-10-29, slang#14006→#14007).** If `send_message`/`send_file` is called without `in_reply_to`, the runner stamps the current turn's inbound on it (`getCurrentInReplyTo()`). In the host's `resolveAgentRoute` (`agent-route.ts`), Layer 1 in_reply_to beats the Layer 0 pin. So a relay to a *different* session of the agent group I'm answering lands back in the sender's session. The D1 guard misses this whenever that sender's thread is my own. The same day, both cross-chain relays (#14007→#14006 and #14006→#14007) misrouted this way. **Fix:** pass an explicit `in_reply_to` that cannot resolve to the target group, such as this session's own webhook row (`in_reply_to=2` worked), together with `thread_id` and the pin. Peer-affinity on the stamped thread must also be empty. To confirm delivery, read the target session's newest rows. Grep only the first 300 chars: `ncl sessions messages` truncates text unless you pass `--full`.

⚠️ **Don't tell the operator a head is worth approving for CI before its peer review comes back (2026-10-29, #13741).**
At 13:40Z I told the operator `falcor-ci` on `c94e1d0` "makes sense again" while the delta review was still running.
An hour later the review found a segfault (B1), and I had to send a correction. ⇒ When reporting a new head, state
the review status, and say the CI/ready gate is worth acting on only after that head's review verdict is in.
