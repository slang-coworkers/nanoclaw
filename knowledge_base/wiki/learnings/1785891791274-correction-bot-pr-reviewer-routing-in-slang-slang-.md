---
title: "CORRECTION — bot-PR reviewer routing in slang/slang-rhi is a misfire, not deliberate design (and how I got it wrong twice)"
type: learning
topic: review-process
source: learnings/1785891791274-correction-bot-pr-reviewer-routing-in-slang-slang-.md
---

# CORRECTION — bot-PR reviewer routing in slang/slang-rhi is a misfire, not deliberate design (and how I got it wrong twice)

**Retracts the claim in my earlier learning that routing bot draft PRs to a human maintainer is intentional.** The automation's owner stated on shader-slang/slang-rhi#809: *"it looks like this is misfiring. It shouldn't be assigning bot-generated PRs to you; we have a separate opt-in list specifically for that purpose."* Treat bot-PR reviewer assignment in `slang` / `slang-rhi` as **a known misfire**, not designed behaviour.

## The reading error that produced the wrong claim

`pr-board-sync.yml` has two unrelated functions and I attributed one's comment to the other:

- `computeTarget(info)` — picks a **project-board column**. Contains `if (info.isDraft) return info.isBot ? STATUS.inreview : STATUS.revising;` and the comment *"a Bot draft is In Review, since bot PRs arrive as drafts and a human owner must see/shepherd them."*
- `reconcileAssignment(info, source, number)` — **does the assigning**. Contains `if (info.isDraft && !info.isBot) return;` and selects `ownersTeam = (source === SOURCE_BOT) ? BOT_OWNERS_TEAM : OWNERS_TEAM`.

I quoted a real comment, verbatim and accurately, **about a different behaviour than the one under discussion** — and concluded the assignment was intentional. Adjacent code in one large file is not the same subsystem; confirm which function a comment documents before citing it as intent.

## Then I got the replacement wrong too

Second attempt: I found `BOT_OWNERS_TEAM = process.env.BOT_OWNERS_TEAM || ""`, saw that neither `slang` nor `slang-rhi` passes any `with:` inputs to the reusable workflow, and concluded the bot opt-in pool was empty and fell through to the maintainer.

**Also false.** `pr-board-sync.yml` defines the input with a default:
```yaml
bot_owners_team:
  default: "shader-slang/bot-pr-owners"
```
Callers omitting `with:` inherit that team deliberately. A `|| ""` fallback deep in the script says nothing about the value when the workflow's own `inputs:` block supplies a default — **check `on: workflow_call: inputs:` before concluding an unset input is empty.** (The descriptions also scope these teams to assignees *inherited from a linked issue*, narrower than the role I'd assumed.)

## The transferable failure

Both wrong claims were confident, cited real code, and were verified at the fragment level. What was never verified was the *conclusion* — verified fragments assembled into an unestablished mechanism. Accuracy checks passed both times; relevance checks were never run.

And the second error is the more instructive: **having just been corrected, I immediately supplied a replacement cause.** Being right about a refutation creates no standing to assert what's true instead. When the owner of a system has already told you it's misbehaving and that the correct path exists, the useful contribution is the retraction — full stop. Diagnosing someone else's automation from a partial read adds risk and no value, and "I'll leave the cause to you" is a complete answer.

Practical rule: **after a public claim is refuted, retract and stop.** Do not attach a second theory to the same retraction.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785891791274-correction-bot-pr-reviewer-routing-in-slang-slang-.md`_
