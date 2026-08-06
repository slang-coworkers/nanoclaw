---
name: project_jkiviluoto_22_issue_scrub_fanout_closed
description: "2026-08-05 jkiviluoto-nv fan-out — identical \"scrub this issue, mkeshavaNV is gone\" request on 22 slang issues in 25s; I got 1 webhook. Verified 22/22 answered, zero dispatch needed. CLOSED."
metadata: 
  node_type: memory
  type: project
  originSessionId: 54801730-9e35-4171-a141-587ad25e12a0
---

# jkiviluoto-nv 22-issue scrub fan-out — CLOSED 2026-08-05 21:50Z

**No RESUME.** Terminal: 22 scrub requests, **22 answered, 0 unanswered**. Every disposition is now a
maintainer call. I dispatched **nothing** into any sibling chain.

## What happened
`jkiviluoto-nv` posted the identical *"Mukund (mkeshavaNV) won't be returning to this work for a
while. Please scrub this issue…"* comment on **22 issues in 25 seconds** (18:40:15–18:40:40Z).
**I received exactly 1 webhook** (#6519 → [[project_6519_precompiled_reflection_scrub_closed]]).
Found the rest only because an unrelated dedup search surfaced #6524 — same wording, 2 s earlier.

The set (22): 4846 6434 6471 6518 6519 6520 6524 6540 6542 6572 6578 6607 7209 7462 7670 7672 8527
9004 9661 9736 9872 10181. Mostly `mkeshavaNV`; 7209/8527/9004 unassigned, 9872 `kaizhangNV`.
Heavy precompiled-module cluster (4846 6518-6520 6524 6540 6542 6572 6578 6607 9004).

## The call that mattered: DON'T dispatch on silence — vindicated
At ~19:00Z: 12 of 22 had bot replies, **10 were silent**. My prior rule said silence ⇒ dropped
delivery ⇒ route it. **That would have been wrong.** All 10 silent issues had **active running
sessions** on their canonical `gh-issue-shader-slang/slang-<N>` threads — delivered and mid-flight,
not dropped. Re-checked at 21:50Z (~100 min later, past the clone+probe-build window): **all 10 had
self-completed.** Dispatching at a 45-min threshold would have injected duplicate work into ten live
chains — the exact double-work the per-issue-thread rule exists to prevent.

⇒ **Two-stage test, in order:** (1) no bot reply is *not yet* evidence; (2) no bot reply **AND** no
session ⇒ *now* it's an orphan. A Slang scrub is quiet 20+ min **by construction** (clone + probe
builds), so the quiet window must be set from the work's shape, not a generic number.

## Instruments (each paired with a control — every one of these can return a FALSE ZERO)
Enumerate the set from source, never from the webhooks you happen to receive:
```bash
gh api -X GET search/issues --field q='repo:<o>/<r> commenter:<login> updated:>=<date>' \
  --field per_page=100 --jq '.items[].number'      # control: future date → must be 0
```
Per issue, "answered" = a `nv-slang-bot[bot]` comment with `created_at` **>** the scrub request's
(a *prior* bot comment proves nothing — this is why the timestamp comparison, not a bare count).
Session check — `ncl sessions list` **column-shifts** when `messaging_group_id` is empty (so
`awk '$4==t'` → 0 for every row), and bare `grep -c <N>` also matches **session IDs** containing
those digits. Anchored regex + both controls:
```bash
grep -cE "gh-issue-shader-slang/slang-6519([^0-9]|$)" sess.txt    # must-hit control → 2
grep -cE "gh-issue-shader-slang/slang-999999([^0-9]|$)" sess.txt  # must-miss control → 0
```

## Second-order risk (triager's catch, mine too)
**Sibling sessions post under the same `nv-slang-bot` identity**, so a session's own record can't
distinguish a sibling's comment from an external writer's. ⇒ An unexplained `nv-slang-bot` comment on
one of these 22 is a **sibling before it's an outside party**. A comment's author never identifies the
session that wrote it — I have burned myself on exactly this by building an argument on unchecked
identity.

## Post-close re-check 2026-08-06 00:20Z — no movement, and NO NOTIFICATION WOULD TELL ME
Re-swept all 22 after a container restart. **0 human replies** after any bot comment (control:
issues with ≥1 human comment = **22**, so the query does detect them). **0 silent state changes** —
all 22 still `open`, `mkeshavaNV` still assigned on 19, milestones/labels untouched. ~4 h in,
overnight for maintainers. Expected, not concerning.

⚠️ **Why I checked instead of waiting for a webhook: delivery to me is MEASURABLY lossy — I received
1 of 22 in this very fan-out.** So "a human reply would notify me" is the exact assumption that
already failed today. And a maintainer *acting* on scrub advice — close, reassign, retitle,
milestone-clear — **emits no comment at all**, so there is no webhook to miss in the first place. Two
distinct blind spots, one cheap sweep:
```bash
# 1. human reply after the last bot comment (NOT a bare comment count)
bt=$(… max created_at where login=="nv-slang-bot[bot]"); select(.user.type!="Bot" and .created_at > $bt)
# 2. silent state change: state / assignees / milestone / labels per issue
```
⇒ **A chain gated on a human's action needs a poll you own, not a notification you hope for.** The
"awaiting maintainer" state has no resume trigger — same family as
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]. Restart-prompted re-checks are
a fine trigger while they last, but they are luck, not mechanism: **don't mistake a lucky sweep for a
control.** If this set still hasn't moved in ~a week, that is worth surfacing to the operator — 19
issues assigned to a departed engineer is itself the finding, independent of any individual verdict.

⭐ **The framing that generalizes:** a lone webhook does not mean a lone target. When a
scrub/sweep/"assess these" request arrives, **ask whether it was aimed at a set** — the missing
siblings are invisible by construction, and only I held the enumerated set (no sibling session knew
it belonged to one). A container restart is precisely what loses that, which is why this file exists.
