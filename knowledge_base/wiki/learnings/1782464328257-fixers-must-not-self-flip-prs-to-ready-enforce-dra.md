---
title: "Fixers must not self-flip PRs to ready — enforce drafts-only"
type: learning
topic: agent-ops
source: learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md
---

# Fixers must not self-flip PRs to ready — enforce drafts-only

**CORRECTED 2026-06-26 — the original incident framing was WRONG. The real lesson is the opposite of "see non-draft → revert." Read carefully.**

**Rule (two parts):**
1. The bot/coworker must never self-flip its own PR to ready (`gh pr ready`) or merge it — those stay operator/maintainer-gated. (Standing drafts-only guardrail; unchanged.)
2. **Before alleging "non-draft = a bot breach" or directing ANY revert of a GitHub state change, VERIFY THE ACTOR, not just the state.** A non-draft PR is NOT itself evidence the bot flipped it — a human maintainer may have. Check the timeline:
```
gh api repos/<owner>/<repo>/issues/<num>/timeline --paginate \
  --jq '.[] | select(.event=="ready_for_review" or .event=="convert_to_draft" or .event=="review_requested") | {event, actor: .actor.login, created_at}'
```
If a **human/maintainer** performed the flip, **NEVER revert it** — overriding a maintainer's intentional decision is a far worse breach than the (nonexistent) one you'd be "fixing." Only a **bot-authored** self-flip warrants a revert.

**Why:** On shader-slang/slang#11763 / PR #11764 (2026-06-26), the orchestrator saw `draft: false` via `github_get_pull_request`, assumed the bot (nv-slang-bot[bot]) had self-flipped in breach of drafts-only, and directed the fixer to run `gh pr ready --undo`. The fixer **held the revert and surfaced with evidence** (correct conflict protocol): the timeline showed `ready_for_review` was done by human maintainer **expipiplus1** at 06:01:10Z (and the csyonghe/saipraveenb25 review-requests by maintainer **jhelferty-nv** at 03:36:53Z) — NOT the bot. The bot's only writes that session were `git push`, `gh pr edit --body`, `gh workflow run`, and a Copilot inline reply; it never ran `gh pr ready` in any session. Reverting would have overridden a maintainer's deliberate decision to open the PR for review. Verifying the STATE without the ACTOR nearly caused a human-override.

**How to apply:**
- *Orchestrator:* on a fixer report claiming/implying a ready-flip, verify the draft STATE (`github_get_pull_request`) AND the ACTOR (timeline `ready_for_review` event `.actor.login`). Direct a revert ONLY if a bot identity did the flip. If a human did it, leave it — a maintainer opening a green, APPROVE'd PR for review is the *desired terminal state*, not a breach.
- *Coworkers:* still never run `gh pr ready` / `gh pr merge` yourselves; report terminal state and keep the bot's own actions draft-only. If the orchestrator orders a revert of a human's GitHub action, HOLD and surface the actor evidence (as slang-fixer correctly did here) rather than comply.
- Aligns with the standing "never auto-CLOSE; surface to a human; re-open if a human objects" rule — do not reverse human maintainers' GitHub-state actions.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782464328257-fixers-must-not-self-flip-prs-to-ready-enforce-dra.md`_
