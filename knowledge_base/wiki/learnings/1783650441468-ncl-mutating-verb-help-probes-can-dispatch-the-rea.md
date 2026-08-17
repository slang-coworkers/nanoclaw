---
title: "ncl mutating-verb help/probes can dispatch the real approval-gated action"
type: learning
topic: agent-ops
source: learnings/1783650441468-ncl-mutating-verb-help-probes-can-dispatch-the-rea.md
---

# ncl mutating-verb help/probes can dispatch the real approval-gated action

**Rule:** Do NOT probe a mutating `ncl` verb by appending `help` or `--help` to it (e.g. `ncl groups restart help`). On approval-gated mutating verbs, the dispatcher can treat the invocation as the *action* and fire a real pending approval — not print help text. To learn a verb's flags, use `ncl help`, `ncl <resource> help` (resource-level, not verb-level with the mutating verb spelled out), or the docs. Reserve typing a mutating verb (`restart`, `delete`, `update`, `create`, `grant`, `revoke`) for when you actually intend the mutation.

**Why:** On 2026-07-09, investigating a possible single-session thrash on slang-fixer, I ran `ncl groups restart help` purely to inspect the flag surface. Instead of help output it returned `error (approval-pending): Approval request sent to admin` — it had dispatched a real group-restart approval. I asked the operator to deny it; the operator instead approved it (~02:25Z next day) and it executed (`restarted: 1, rebuilt: false`). A group restart is whole-agent-group scope — collateral across every in-flight session in that group, and useless for a single-session context-thrash anyway.

**Mitigating facts (why this was low-harm this time):** a *bare* restart (no `--message`) only kills running containers; session DBs persist and containers respawn on next inbound, so the only loss is live in-memory context of whatever single container was actively running. The at-risk chain (#10027 diag-retry) had already delivered + posted its GitHub artifact 2h before the restart, so nothing was lost.

**How to apply:** (1) Never `help`/`--help` a mutating ncl verb — resource-level help only. (2) For a single stuck/thrashing SESSION, there is NO surgical per-session restart in `ncl sessions` (read-only) — do NOT reach for `ncl groups restart --id <group>` (whole-group collateral). The correct recovery for a thrashed session is a fresh append-only sub-thread dispatch (new clean-context session, resume-from-disk), which is exactly what unstuck #10027. (3) If a stray approval lands, remember Main cannot deny it (`ncl approvals` read-only; approvals route to the human operator) — surface it to the operator explicitly and state the desired decision clearly, since a mis-approve is possible.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783650441468-ncl-mutating-verb-help-probes-can-dispatch-the-rea.md`_
