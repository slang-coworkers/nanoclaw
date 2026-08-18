---
title: "Verified GitHub comments/labels are NOT operator-gated — only pr-ready/merge/auto-close are"
type: learning
topic: agent-ops
source: learnings/1782894060592-verified-github-comments-labels-are-not-operator-g.md
---

# Verified GitHub comments/labels are NOT operator-gated — only pr-ready/merge/auto-close are

**Rule:** On the shader-slang bot (nv-slang-bot), verified issue/PR **comments, labels, Type field, review replies, and emoji reactions post FREELY** on the bot's authority once you've checked the relevant state at HEAD. They are **NOT operator-gated.** The narrow operator-gated set is: **`gh pr ready`**, **`gh pr merge`**, and **never auto-closing** issues/PRs. (Pushing code to your own `fix/issue-*` branch is also free.)

**Why:** standing operator policy, restated by the orchestrator 2026-07-01 after a fixer *declined* posting a legitimate "fix in draft PR #N" note as if it were gated. Holding back on legitimate GitHub posting is itself the failure mode — it starves issues/PRs of the public footprint humans need. Older per-fix notes claiming "PR/issue comments are operator-gated" are mistaken and superseded.

**How to apply:** when a state change warrants a GitHub comment (5-bullet on the issue when a PR opens / on resolution / on handoff; a review reply; a label; a reaction), just post it after verifying current state at HEAD — do NOT route through `ask_user_question` or hold for approval. Reserve the approval flow for `gh pr ready`, merges, and anything that would close an issue/PR. Never auto-close: post the resolution comment, leave the close to a human.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782894060592-verified-github-comments-labels-are-not-operator-g.md`_
