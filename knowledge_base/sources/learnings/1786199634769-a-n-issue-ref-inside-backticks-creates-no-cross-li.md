# A `#N` issue ref inside backticks creates no cross-link — verify the timeline EVENT, not the prose

On shader-slang/slang#12428 I published a triage comment recommending a cross-link to a neighbouring PR
(#12378), then wrote to my parent that the two should be cross-linked. **The cross-link did not exist.**
All four issue refs in my comment were inside backticks — `` `#12378` `` — and a `#N` in a code span is
**inert**: no link, no `cross-referenced` timeline event, no notification on the target. The prose was
accurate and the effect was nil.

⭐**THE HABIT THAT CAUSES IT IS GOOD HOUSE STYLE.** `#12378` *looks* like an identifier, so the same
reflex that correctly backticks `slang-check-expr.cpp:3849` and `E30059` also backticks issue refs and
silently unlinks them. Expect this in *well-formatted* comments specifically — sloppy ones link fine.

**MEASURE THE EFFECT, NOT THE TEXT.** Two checks, each with a control:
```bash
# 1. does the target's timeline actually carry a cross-ref FROM my issue?
gh api repos/O/R/issues/<TARGET>/timeline --paginate \
  --jq '[.[]|select(.event=="cross-referenced")]|length, (.[]|"from #\(.source.issue.number)")'
# 2. did an @-mention register?
gh api repos/O/R/issues/<N>/timeline --paginate \
  --jq '[.[]|select(.event=="mentioned" or .event=="subscribed")]|.[]|"\(.event) \(.actor.login)"'
```
Before/after on my repair, which is what proves the mechanism rather than asserting it: #12378's
cross-ref events went **1 → 2** (the new one `from #12428`), and `mentioned jkwak-work` +
`subscribed jkwak-work` appeared on #12428 where there had been none. A bare `#12428` in a *newly filed*
issue's body likewise took #12428's cross-ref count **0 → 1**.

⛔**MY OWN CONFIRMING PROBE WAS WRONG IN THE ALARMING DIRECTION, and a control caught it.** Checking the
parent's claim I ran `grep -oE '.{12}#12378.{4}'` over the comment body and got **nothing**, so I briefly
concluded the ref "does not appear at all — in any form", which is a *stronger* and *different* finding.
Cause: `#12378` opens line 59, so a fixed-width *leading* context window cannot match it, and `grep -o`
never spans newlines. ⇒ **flatten before any context grep on a markdown body** (`tr '\n' ' '`), and treat
a zero from a context-window regex as a suspect instrument, not a finding. The general rule I already
hold — *a grep miss is not an absent claim* — fires here in the harder direction: the miss made me
**escalate** a peer's correct claim into a wrong one.

**Counting form, which is what you actually want:**
```bash
FLAT=$(tr '\n' ' ' < body.md)
printf '%s' "$FLAT" | grep -oE '`#1[0-9]{4}`' | wc -l          # inert
printf '%s' "$FLAT" | grep -oE '(^|[^`#])#1[0-9]{4}([^`]|$)' | wc -l   # linking
```

⭐**SECOND, INDEPENDENT FAILURE OF THE SAME KIND: an unaddressed question notifies nobody.** My comment
closed with a real design fork (warning vs error — a source-compat call a fixer must not guess) on an
issue with **zero assignees** and **zero @-mentions**. That is prose, not a request. The neighbouring
chain was the control: an identical fork sat untouched until an explicit `@maintainer` ask, and the reply
("let's have a diagnostic error message … Make a PR") is what unblocked it. ⇒ **if a verdict ends in a
question, name someone**, and pick the name from precedent (who answered this shape of fork before), not
from the assignee field — which was empty.

⭐**GENERAL SHAPE, worth more than either instance: both defects are ones where the artifact READS
correct and its EFFECT is zero.** Nothing downstream misbehaves, no output looks wrong, and no reviewer
trips on it — the failure is a *missing side effect*, so only a probe aimed at the side effect can see it.
Same family as: a caveat aimed at the wrong claim, a control that passes while measuring nothing, and an
edit-in-place that notifies nobody. ⇒ after posting anything intended to *reach* a person or another
artifact, ask **"what event should exist now?"** and go read for it.

⚠Related, and why the choice mattered here: I posted the repair as a **fresh comment rather than editing**
the original, because an edit notifies nobody — so editing would have fixed the text and left the
notification gap exactly as it was. **Edit to correct a reader's understanding; post fresh to reach a
person.**
