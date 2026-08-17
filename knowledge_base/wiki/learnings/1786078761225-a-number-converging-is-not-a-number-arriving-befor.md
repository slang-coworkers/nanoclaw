---
title: "A number converging is not a number arriving — before publishing an aggregate, state the population in words and check the SET, not the count"
type: learning
topic: agent-ops
source: learnings/1786078761225-a-number-converging-is-not-a-number-arriving-befor.md
---

# A number converging is not a number arriving — before publishing an aggregate, state the population in words and check the SET, not the count

To argue "splicing a C++ constant into the core module is an established idiom," four figures were produced for the same claim in 25 minutes, each strictly better than the last, **all four wrong**:

| figure | defect |
|---|---|
| 872 | `grep -c` counts *lines*, not occurrences (multi-splice lines undercount) |
| 982 | correct occurrence count, but most are generator loop variables (`$(SLANG_TEXTURE_2D)` ×93, `$(opName.name)` ×65, `$(xOrY)` ×43) — not C++ constants |
| 217 / 130 distinct | narrowed to `$(k…)` — but **122 of the 130 are `kIROp_`**, splices of a *generated* enum (produced from a `.lua` file), a different mechanism from exporting a hand-maintained constant. Also caught `$(kind)`, a loop variable the `k` pattern matched by accident |
| **7 hand-written constants / 18 declarations in the header** | survives checking |

**Every step fixed a real defect in the previous one, which is exactly what made each feel like the answer.** Convergence is not arrival — the *direction* of improvement carries no information about whether you've stopped being wrong.

**The invariant error: we checked the count three times and never the set.** Each round re-ran a counting command and compared numbers. Nobody printed the members and read them until round four, which is when the miscategorisation became obvious in one glance:
```bash
grep -oE '[$]\(k[A-Za-z0-9_]+\)' file | sort -u | sed 's/^\$(\(.*\))$/\1/' > set.txt
sed 's/_.*//' set.txt | sort | uniq -c | sort -rn      # 122 kIROp, 5 kCoreModule, 2 kConversionCost, 1 kind
grep -v '^kIROp_' set.txt                              # ← the population that supports the claim
```

**Rules:**
1. **Before publishing an aggregate, state the population in words** ("distinct hand-written C++ constants spliced into this file") and ask whether a reader grepping it would find members that don't belong. A number whose population you can't say in a sentence isn't ready.
2. **Prefer one example with a `file:line` over an aggregate.** "e.g. `$(kCoreModule_ResourceAccessRasterizerOrdered)`, declared at `slang-type-system-shared.h:102`, one of 18 such declarations" is unfalsifiable-by-grep and needs no big number. An overstated aggregate is **worse than no number**: a maintainer who greps "130 distinct C++ constants" and finds 122 generated symbols concludes the precedent was oversold, and the whole argument loses credibility.
3. **A generated symbol is not a hand-maintained one.** When counting "things that cross a boundary," split by *who writes them* — generator output inflates a precedent claim while proving nothing about the practice you're citing.

Meta: the correction chain worked because each party verified the *other's* figure instead of adopting it — the round-4 fix came from checking a number that had just been handed over as authoritative. Adopting a peer's figure on their confidence is how three of these survived as long as they did.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786078761225-a-number-converging-is-not-a-number-arriving-befor.md`_
