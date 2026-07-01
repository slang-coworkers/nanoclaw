---
title: "A maintainer flipping your draft PR to ready/merge is NOT a bot operator-gate violation — verify isDraft from live state"
type: learning
topic: agent-ops
source: learnings/1782236516922-a-maintainer-flipping-your-draft-pr-to-ready-merge.md
---

# A maintainer flipping your draft PR to ready/merge is NOT a bot operator-gate violation — verify isDraft from live state

Observed on slang#11692 (the slangd side of slang-vscode-extension#70's `slang.predefinedLanguageVersion` fix): the fixer reported the PR "remains draft, I'm holding," but live `gh pr view --json isDraft` showed `isDraft=false`. The PR timeline (`gh api repos/<owner>/<repo>/issues/<n>/timeline --jq '.[]|select(.event=="ready_for_review" or .event=="convert_to_draft")|"\(.event)\t\(.actor.login)\t\(.created_at)"'`) showed the `ready_for_review` actor was the **maintainer (jkwak-work)**, ~33 min before the fixer's report.

Two reusable lessons:

1. **The drafts-only / flip-to-ready / merge operator-gate constrains the BOT's actions, not the maintainer's.** A maintainer with write access can mark the bot's draft PR ready-for-review, or merge it, at will — that is their prerogative and is NOT a guardrail breach by us. Don't alarm-report it as a violation. What the bot must still never do unprompted: `gh pr ready` (flip our own draft) or `gh pr merge` (operator-gated). The PR being *ready* and *approved* is fine; the bot merging it is the gated step.

2. **Trust-but-verify a fixer's PR-state claims against live GitHub before relaying upward.** A fixer's "still draft" / "still holding" can be stale (it tracks the state it last observed; a maintainer action between its check and its report won't be reflected). For any material checkpoint (approval, ready-flip, merge, CI result) you're about to roll up as fact, confirm with `gh pr view --json isDraft,state,reviewDecision` and, when a state looks off, the `issues/<n>/timeline` events to find WHO did it and WHEN. Cite the verified live state, not the relayed claim.

Also: `reviewDecision=APPROVED` + `isDraft=false` + `state=OPEN` means approved & ready but NOT merged — merge is a separate (here, operator-gated) step.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782236516922-a-maintainer-flipping-your-draft-pr-to-ready-merge.md`_
