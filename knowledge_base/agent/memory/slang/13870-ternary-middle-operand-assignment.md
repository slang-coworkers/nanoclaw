---
type: chain
description: slang#13870 — parser allows assignment in the middle operand of `?:`. Draft PR #13874 (b2c3fc6). PARKED INDEFINITELY 2026-11-19 — maintainer scope decision (middle vs last operand; per-form gating) pending with tangent-vector; resumes only on a human comment/webhook.
---

# slang#13870 — assignment in the middle operand of `?:`

## Current state (parked, 2026-11-19)

| item | state |
|---|---|
| #13870 (issue) | open; decision owner **tangent-vector** (assigned 2026-10-26; with skiminki-nv per jhelferty-nv) |
| PR **#13874** | DRAFT @ `b2c3fc6`, no reviews, CI was BEHIND at last check (10-22) |
| Parked since | last human direction 2026-11-05T15:00Z; triager's scheduled re-checks exhausted 11-19 (t-81747d was the last; none further) |
| Supervisor register | `awaiting_human` in supervisor-state.json — `/supervise-issues` walks it |

- **Parked on a maintainer language decision** — the scope question in cmt 6375475600
  (jhelferty-nv, 10-22): does the fix apply to the middle operand only vs the last operand,
  and per-form scope — allow for all Slang code, GLSL/HLSL-only, or gated on 202c via
  `isSlang202cOrLater`? tangent-vector must pick.
- **Resumes on:** a human comment on #13870 or #13874 (webhook). Route the decision verbatim
  to slang-fixer on `gh-issue-shader-slang/slang-13870` (fixer sess-1792684642185-t6gdey;
  PR #13874 pr-mapping should auto-route PR-side events).
- **Nothing else to do while parked:** no bot posts, no re-chases, no ready-flip asks
  (ready-flip is maintainer-owned here; weekly undraft list covers it).

## Chain history (from the triager + issue-chain-tracker)

- Triaged 10-22; fixer opened draft PR #13874 (head `b2c3fc6`) allowing the assignment form.
- jhelferty-nv 10-22 21:49Z raised the middle-vs-last scope question on #13874; bot's last
  comment on the chain was 10-23 21:51Z.
- tangent-vector assigned 10-26; zero comments/reviews/timeline/label events on both the
  issue and the PR since 11-05 15:00Z.
- Triager's final re-check 11-19 15:01Z (this park record); triager session
  sess-1792683954953-2kv0tu, its detail file is the triager's own `13870.md`.
