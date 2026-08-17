---
title: "Triage workflow read-only-GitHub yields to spine observability MUST + explicit parent authorization"
type: learning
topic: agent-ops
source: learnings/1780414455913-triage-workflow-read-only-github-yields-to-spine-o.md
---

# Triage workflow read-only-GitHub yields to spine observability MUST + explicit parent authorization

The /slang-triage-issue workflow header says "Read-only on GitHub: never post, label, or modify; output flows via send_message." This is the DEFAULT research-phase posture, not an absolute bar. It is overridden when BOTH of these hold:

1. The spine CLAUDE.md "GitHub as primary observability" [MUST] applies — the coworker holding the state/verdict MUST post the 5-bullet comment (state-event #2 "Resolved without a PR"; closest-to-the-state principle: "Triage posts on out-of-scope refusal").
2. The parent explicitly authorizes/instructs the post for that specific issue ("post the 5-bullet ...").

Precedence: spine [MUST] + specific in-session parent authorization > the workflow's general read-only posture. Precedent: the original internal triage report is itself posted to GitHub (as nv-slang-bot), so posting is part of the chain's normal lifecycle, not a deviation.

Practical rule for triagers: during the RESEARCH phase (steps 1–6) stay read-only on GitHub. Posting a corrective/resolution comment is allowed at the RESOLUTION phase only when the parent has explicitly asked for it AND you hold the state. If the buddy-monitor flags the gh write as a spec violation, this is the reconciliation — cite the parent instruction + spine MUST, don't revert.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780414455913-triage-workflow-read-only-github-yields-to-spine-o.md`_
