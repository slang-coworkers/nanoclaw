# Session privilege

Every session is either **open** or **closed**, and keeps that privilege for its whole life.

- An **open** session runs open-weights models only.
- A **closed** session may run closed models (Claude, GPT). Only a person on the approved list reaches one.

A session never mixes the two. A message goes to the session of its sender's privilege on its thread, and routing creates that session when it does not exist. One GitHub issue can so hold an open and a closed session of the same coworker side by side. This follows the closed-model policy in [input-gate.md](input-gate.md) and the open-weights default in [model-policy.md](model-policy.md).

## Turning it on

| Setting | Meaning |
|---|---|
| `NANOCLAW_SESSION_PRIVILEGE` | `off` (default) or `enforce`. With `off`, every message asks for an open session, every session is open, and spawn ignores the privilege, so the install behaves as before. |
| `NANOCLAW_CLOSED_MODEL_APPROVED` | Path to the approved list. Default `data/closed-model-approved.json`. |

The approved list is a JSON array of namespaced user ids: `slack:U012AB3CD`, `discord:80351110224678912`, and `github:<numeric id>` for a GitHub account. A GitHub entry uses the numeric id, because a login can be renamed or reused. The operator keeps this file. It stands in for the closed-model eligibility check (Check 2 of the input gate) until that check has its identity sources. A missing or unreadable file is an empty list, so nobody gets a closed session by accident.

Before `enforce`, move every group to open weights (`scripts/open-weights-plan.ts`). An open session of a group that still names a closed model, or that runs the Claude provider, does not start.

## Who asks for which privilege

| Path | Privilege |
|---|---|
| A chat message (Slack, Discord, dashboard) | `closed` when the sender is on the list, otherwise `open`. |
| A GitHub issue, a PR that becomes ready, a review, a mention | The account in `payload.sender`: `closed` when its numeric id is on the list, otherwise `open`. |
| A GitHub event from a bot or app (CI, review bots, this install's own bot) | None. The event follows the session that already exists. |
| A GitHub state event (merged, closed, CI failed, review thread resolved) | None, for the same reason. A merge does not wake a second session. |
| A delegation from one coworker to another | The privilege of the sending session. |
| A scheduled task, a system session | `open`. |

When a PR is owned by a session of one privilege and a comment arrives from a sender of the other, the comment goes to a session of the sender's privilege on the same thread, created if needed. It never reaches the owner session.

## What a session may write into

An **open** session never writes into a **closed** one: a person who is not approved would direct a closed model through the open session. A closed session may write into an open one, because the open session only reads the closed model's output, as the public thread already does. A reply or a `target_session_id` that names a closed session from an open one is refused, and the sender is told. A fresh delegation is not refused, because it gets a session of the sender's privilege.

## What spawn does

With `enforce`, spawn resolves the group's models for the session's privilege (`rowForPrivilege`):

- an open session runs under `weights=open`, so spawn refuses it on any closed model, as for a `weights=open` group today;
- a closed session runs without the rule, so the group's own models and the install defaults apply. A group set to `weights=open` for its open sessions can still run closed models for approved people.

## Not covered yet

- **The credential.** One NVIDIA inference key serves open and closed models, so a container that names a closed model by hand still reaches it. The planned boundary is in OneCLI: open sessions use the agent `<group>`, closed sessions use `<group>:closed`, and the proxy refuses a closed model for an open agent.
- **Check 2 sources and the location check.** Today the operator's list decides. The input gate's Check 2 and the location check come later, on the closed path.
- **A parked PR that is released** (`releaseParkedReviewable`) and the learning delivery to approver sessions look up sessions without a privilege.
- **`mention-sticky` engagement** counts a session of either privilege as "active", so a thread an approved person started keeps listening for everyone.
