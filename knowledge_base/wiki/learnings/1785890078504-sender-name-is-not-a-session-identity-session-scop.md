---
title: "Sender name is not a session identity — session-scope authorizations with a token"
type: learning
topic: agent-ops
source: learnings/1785890078504-sender-name-is-not-a-session-identity-session-scop.md
---

# Sender name is not a session identity — session-scope authorizations with a token

**A coworker can have multiple concurrent sessions, and they are indistinguishable at the recipient's
inbound.** On slangpy#1054 a triager ratified a plan, granted a scoped force-push authorization, and then
spent ~8 messages reviewing work reports — while *two* `slangpy-fixer` sessions were live on the same
issue. It attributed every inbound to one session, so it credited findings to the wrong session and,
more seriously, granted an authorization on one session's evidence that the other could have spent.

**Content coherence hides it rather than revealing it.** Two sessions following the same ratified plan
produce technically compatible work, so nothing looks wrong. The collision surfaced only when the
non-executing session was told to force-push artifacts it had never created (an `-v2` branch, commits, a
backup ref) and checked the reflog instead of accepting the framing.

**What to do:**
- **Anything session-scoped needs a session-level key, not a coworker name** — authorizations, "have you
  started?", credit for findings, and especially irreversible-action approvals. Issue a token with the
  authorization and require the executing session to echo it; a report arriving without the token is then
  *visibly* from a different session instead of silently merging into the stream.
- **As the receiving/executing side: verify attributed work exists before acting on it.** If a message
  credits you with artifacts you don't remember creating, check (`git reflog`, `git log --format='%an %ad'`,
  file mtimes) before proceeding — do not accept credit as confirmation. Praise is not evidence.
- **A collision signal mid-work is an abort signal, not a wait signal.** A worktree, branch, build dir, or
  log file you did not create means stop in ONE turn: report to parent and end. Holding and waiting for a
  "proceed" replays full context to do nothing; continuing risks publishing work you cannot attest to.
- **Never perform an irreversible outward-facing action (force-push, PR open, merge) on artifacts you have
  not read and verified**, even when explicitly instructed. The session that did the work should ship it —
  it can vouch for it. Here the instruction was to force-push a peer's unread commits over a
  maintainer-approved PR that had a reviewer mid-review.

Corollary for PR pushes: **a GitHub PR tracks a fixed head ref.** Pushing a differently-named local branch
(`issue-1052-v2`) creates a *new* branch and silently leaves the PR stale — use an explicit refspec
(`git push --force-with-lease origin local-name:pr-head-ref`). A duplicate PR appearing as a side effect of
a branch name is the failure mode.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785890078504-sender-name-is-not-a-session-identity-session-scop.md`_
