# Verifying N subagents' count claims: the claim AND your checker can both be wrong, and the checker's bug looks like a finding

Folding 282 learnings into 19 wiki concept pages via 7 parallel subagents. Each agent was told to append footer rows to `**Source learnings (N):**` and bump N. Every agent self-reported success, several explicitly claiming "footer counts match row counts."

I checked instead of trusting. Two defects surfaced, and the ORDER I found them in matters.

**First checker (wrong):**
```bash
awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{c++} flag&&!/^- \[/&&NF{exit} END{print c+0}' "$f"
```
It reported 5 MISMATCHes. Plausible — agents do miscount. But the `flag&&!/^- \[/&&NF{exit}` clause exits on the first line of intervening **PROSE** (blank lines are excluded by the `NF` guard — verified 2026-08-04: `rows/blank/rows` counts correctly, `rows/blank/prose/blank/rows` counts 2 of 4), and real footers carry prose between row groups, so it counted a PREFIX of the list and under-reported. It manufactured mismatches on pages that were fine.

The trap: **the instrument's bug produced exactly the finding I was looking for.** A checker that confirms your suspicion is the one to distrust most. I only caught it by dumping the raw footer region and looking at what the pages actually contained, rather than acting on the count.

**Second checker (sound), with a self-validating property:**
```bash
rows=$(awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{c++} END{print c+0}' "$f")   # to EOF
uniq=$(awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{print}' "$f" \
        | grep -oP 'wiki/learnings/\K[^)]+' | sort -u | wc -l)
```
`rows == uniq` on every page is a built-in control: it says the rows parsed are real citation rows and none are duplicated. If those two ever diverge, the parse is suspect, not the page.

**With a sound instrument, the real result was bigger than the agents' reports:** 19 pages had stated-N drift, including several with no edits today (`review-pr-practices` 273→274, `slang-backends-spirv` 162→160, `slang-misc-build-infrastructure-and-tooling` 60→55). So the drift is CHRONIC across daily folds, not an artifact of this run's agents — a fact the per-agent self-reports could never have revealed, because each only knew about its own delta.

Fix: recompute N from the deduped stem set and rewrite both `**Source learnings (N):**` and frontmatter `source_count`. Never increment; always recount.

**Lessons:**
1. **A stated count is a claim; the list is the fact.** Any "N:" adjacent to an enumeration is derived data that must be recomputed, never trusted or incremented — and never trust a writer's report about arithmetic it performed on itself.
2. **Suspect an instrument whose first act confirms your prior.** I expected agent miscounts, and my broken checker delivered them. Validate the checker on a case you know the answer to before believing its verdict.
3. **Prefer a checker with an internal control** (here `rows == uniq`) so a parse failure announces itself instead of masquerading as a content finding.
4. **N independent self-reports do not compose into coverage** — each agent saw only its slice, so a cross-cutting defect (chronic drift on untouched pages) was invisible to all 7 and visible only to a global recount.
