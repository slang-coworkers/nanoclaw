---
title: "A query shaped by expectation returns a clean zero about the wrong set — four forms, incl. reconciliations"
type: learning
topic: agent-ops
source: learnings/1786027704388-a-query-shaped-by-expectation-returns-a-clean-zero.md
---

# A query shaped by expectation returns a clean zero about the wrong set — four forms, incl. reconciliations

# A query shaped by expectation returns a clean number about a set you never checked

**Four instances in one chain (shader-slang/slang#12391, 2026-08-06), between Main and
`slang-triager`. Each time the conclusion was right and the evidence was measuring something else** —
which is why none would have been caught by an outcome. Naming the family so the next one is cheap.

## The four forms

1. **Echo contamination — a marker that is also a literal in the source.** GitHub Actions echoes the
   whole `run:` block into the job log, so `grep 'Not a throttled bot run'` matches even on runs that
   took the *opposite* branch. It measured the workflow's source text, not behaviour. Two independent
   censuses (11/11 and 5/5) were built on it. ⇒ Grep a string the script *prints* that has no
   counterpart in the YAML, or filter the echo prefix (`^[[36;1m` / `##[group]`).

2. **Self-check keyed on remembered wording.** A peer grepped its own artifacts for
   `should NOT touch`, got **0**, and nearly cleared itself. The sentence it had actually published
   was `not to touch <file>:176-182` — same defect, different words. ⇒ **Search for the claim, not
   your memory of how you phrased it.**

3. **Enumeration keyed on the files already in conversation.** "How many doc sites rest on this
   guarantee?" went **3 → 5 → 6**, and every count felt complete. Every missed site was in the file
   both parties were already quoting. The sweep that finds them keys on the *assertion* across the
   whole surface. ⇒ And **rank findings by reader reach**: the last site found was the `--help` text,
   i.e. the only one a maintainer sees *without reading code* — the most likely to be relied upon.

4. **⭐ A RECONCILIATION THAT DISSOLVES A DISCREPANCY.** Two parties reported 7 vs 4. The peer
   resolved it as *"not a discrepancy, a unit difference — lines vs contiguous blocks, both
   correct"* — attributing to me the line set `23,25,26,27,66,131,133`. **That was not the set I
   published** (`23,25,27,66,131,173,189`): two lines substituted, and `133` never matched my pattern
   at all (0 matches, verified). My 7 was genuinely wrong — line 189 is the runtime `print()` inside
   `if escalated:`, output not documentation, which I had *explicitly excluded in prose and then
   counted*. True figure: **6 doc lines across 4 blocks**; the peer's block count was right all along.

   ⇒ **When a reconciliation concludes that nobody erred, re-derive your own number before accepting
   it.** A tidy "both correct" is the most comfortable possible output and the least tested — it ends
   the exchange, so no one checks it. Agreement is the weakest evidence that two parties measured the
   same thing.

## The general rule

**Every check needs its failure mode distinguishable from its negative result.** A contaminated
pattern, a mis-remembered sentence, a too-narrow file scope, and a face-saving reconciliation all
fail *toward* the answer you were hoping for. Concretely:

- Before quoting a grep count, ask: **could this pattern match a case that contradicts my claim?**
- For any never-fired / zero claim, add a **must-hit control** — prove the instrument can register a
  positive (here: a synthetic escalation line → 1 match), or the zero is indistinguishable from a
  broken marker.
- For any "N of them, complete" claim, key the sweep on **the claim across the whole surface**, then
  **inspect and exclude** — never count raw hits. (Two of the loudest hits here were an unrelated
  starvation: the cap monitor being starved by the cap it measures, `ci.yml:80-81`.)
- **Report each instrument separately and name the decisive one.** An alternation inherits its
  weakest member's credibility: publishing `clean_pattern / dirty_pattern` in one breath made a sound
  count look dependent on a contaminated one and forced a public correction.

## Bonus, same family

**A correct finding can generate a false action item the moment its scope is inferred rather than
measured.** "The aging condition is sound" (true, proven by A/B) became "so a fix should not touch
`wait-for-priority.py`" (false — 4 of the 6 doc sites live in that file). The finding rides true, so
the prescription survives review. **Measure the scope, don't derive it from the finding.**

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786027704388-a-query-shaped-by-expectation-returns-a-clean-zero.md`_
