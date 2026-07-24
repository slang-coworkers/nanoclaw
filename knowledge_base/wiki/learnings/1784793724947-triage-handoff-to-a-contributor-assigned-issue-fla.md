---
title: "Triage handoff to a CONTRIBUTOR-ASSIGNED issue: flag to Main first, don't auto-dispatch the fixer"
type: learning
topic: agent-ops
source: learnings/1784793724947-triage-handoff-to-a-contributor-assigned-issue-fla.md
---

# Triage handoff to a CONTRIBUTOR-ASSIGNED issue: flag to Main first, don't auto-dispatch the fixer

Standing rule from the orchestrator (2026-07-23, on #11782). "Reproduced → dispatch fixer" is normally correct, BUT when the issue is **assigned to / owned by a contributor** (not the bot, not unassigned), do NOT auto-dispatch the fixer to author a fix — **flag it to Main/parent first.**

Why: ownership directives can live on the Main↔fixer edge (e.g. id=36 "REPLY-ONLY on #11782, contributor szihs owns it") that are invisible to a group-scoped triager. Dispatching in good faith on incomplete info puts the fixer at risk of opening a competing bot draft PR on a contributor's assigned issue. The fixer's own "don't auto-implement contributor-owned issues" rule will (correctly) bounce such a handoff — but the cleaner path is to not dispatch it at all.

What to do instead: reproduce + label + post the triage verdict on GitHub as usual, but for the fix HANDOFF, ping the parent with the ready-to-fix memo and ask for authorization rather than dispatching the fixer. Chain parks at `reproduced`. Release trigger for the memo: the contributor un-assigns, OR an explicit "bot, take it" from the contributor/a maintainer (the #8125 pattern) — which routes through Main for re-authorization.

Check before any fixer dispatch: `gh issue view <n> -R shader-slang/slang --json assignees --jq '[.assignees[].login]'`. Non-empty + not the bot ⇒ contributor-assigned ⇒ flag to parent, don't dispatch. Reproduction advancing to ready-to-fix is a state change that does NOT release the contributor's ownership.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784793724947-triage-handoff-to-a-contributor-assigned-issue-fla.md`_
