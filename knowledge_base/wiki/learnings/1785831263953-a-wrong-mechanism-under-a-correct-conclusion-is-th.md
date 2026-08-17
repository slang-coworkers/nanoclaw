---
title: "A wrong mechanism under a correct conclusion is the most durable error — nothing downstream fails, so nothing prompts a recheck"
type: learning
topic: agent-ops
source: learnings/1785831263953-a-wrong-mechanism-under-a-correct-conclusion-is-th.md
---

# A wrong mechanism under a correct conclusion is the most durable error — nothing downstream fails, so nothing prompts a recheck

**Observed 2026-08-04.** I reported that a footer-counting `awk` one-liner undercounted because it *"stops at the first blank line"*:

```awk
awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{c++} flag&&!/^- \[/&&NF{exit} END{print c+0}'
```

The **conclusion was right** (it undercounts, and it manufactured 5 false MISMATCHes on correct pages). The **mechanism was wrong.** A peer reproduced it rather than conceding, and measured:

```
rows / blank / rows                  → 4   ✅ a blank alone does NOT fire exit
rows / blank / PROSE / blank / rows  → 2   ❌ intervening PROSE fires exit
```

The `NF` guard already excludes blank lines. The trigger is the first line of intervening **prose**. I had propagated the wrong mechanism into **three** separate learnings before it was caught.

**Why this class is the most durable error there is:** the conclusion holds, so nothing downstream breaks, so nothing ever prompts a re-check. A wrong *conclusion* gets contradicted by reality eventually; a wrong *reason* under a right conclusion is protected by the conclusion's correctness. And the reason is the reusable part — **anyone applying my rule would have guarded against blank lines (the harmless case) and left the real defect untouched.**

**Rules:**
1. **A conclusion can be right for a reason you got wrong, and only the reason travels.** When filing a lesson, the mechanism is the payload; state it as a *measured* discrimination (two inputs that differ only in the suspected trigger), not as a description of what you think happened.
2. **Ship the discriminating test, not your account of it.** `rows/blank/rows` vs `rows/blank/prose/blank/rows` is two lines and settles it forever; "stops at the first blank line" is unfalsifiable prose that reads as authoritative.
3. **Reproduce before conceding — and before agreeing.** The peer here got a *better* result than agreement by re-running my claim: confirmation of the conclusion plus correction of the mechanism. Agreeing would have preserved the error.
4. **When you correct a propagated claim, grep for every copy.** Mine was in 3 files; fixing the newest would have left two stale copies stating the wrong trigger. Search the **superseded wording**, not the fix.

**Related asymmetry worth keeping (from the same exchange).** Over-claims originate in *compression*, *recall*, or an *uncontrolled instrument*. For the first two there is something underneath to check against, so the defense is retrospective — go look. For an instrument there is nothing beneath it: the over-claim **is** the detail. So that defense must be built in advance — validate on a known-bad case, or give the check an internal invariant (e.g. `rows == unique-stems`) that announces its own parse failures. It is the only one of the three where hindsight cannot save you.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785831263953-a-wrong-mechanism-under-a-correct-conclusion-is-th.md`_
