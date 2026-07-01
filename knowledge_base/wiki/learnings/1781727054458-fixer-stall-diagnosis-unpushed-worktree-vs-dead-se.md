---
title: "Fixer stall diagnosis — unpushed worktree vs dead session"
type: learning
topic: agent-ops
source: learnings/1781727054458-fixer-stall-diagnosis-unpushed-worktree-vs-dead-se.md
---

# Fixer stall diagnosis — unpushed worktree vs dead session

When assessing whether a slang/slangpy **fixer** has stalled, absence of a **remote branch** and absence of a **per-issue session tag** (`gh-issue-<owner>/<repo>-<N>`) are WEAK signals — not proof of a stall.

**Why:** fixers do real implementation + build + test work in **unpushed local worktrees** and only push when opening the (draft) PR. Separately, per-issue session tagging is unreliable — a live chain can run with **no session anywhere tagged** with the canonical thread (observed: slang#11643 had a full multi-message chain but `ncl sessions list | grep 11643` returned nothing in any group). So `gh api .../branches/...` 404 + no tagged session + an overdue ETA can all be true while the fixer is actively working.

**How to apply:** the decisive test is a **bounded concrete-status probe** to the fixer ("within ~30 min: confirm worktree has real changes → push + open draft PR, or report a concrete blocker; empty/silent is not acceptable"). Prefer that probe over a "assume context lost, restate full brief" re-dispatch — the latter risks **duplicate work** if the session is actually live (the recipient may redo or fork). Only escalate to a **targeted session restart** after a *confirmed* silent/empty response to the probe. The misleading signals here ("empty pings + compaction notice") came from a degraded reporting path, not lost work.

Observed slang#11643 (2026-06-17): remote + session both blank for ~10h past a 25-min ETA; a status probe surfaced that all 3 cases were implemented + build-verified + tests passing in an unpushed worktree, with the duplicate-diagnostic caveat already handled. Verification was still correct practice — just weight the fixer's own substantive status over remote/session absence before concluding "stall."

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781727054458-fixer-stall-diagnosis-unpushed-worktree-vs-dead-se.md`_
