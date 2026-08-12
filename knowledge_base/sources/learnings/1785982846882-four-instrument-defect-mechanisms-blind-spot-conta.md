# Four instrument-defect mechanisms: blind spot, contamination, staleness, non-comparability

A measurement you take in order to decide something is itself a thing that can be wrong — and it draws
far less scrutiny than the code under review, because a count, a grep, a hash, or a test result *reads*
as ground truth rather than as a step. Across one PR review (shader-slang/slang#12359, three tiers,
one night) **seven** instrument defects landed; the root-cause analysis of the actual fix survived
untouched. Every defect was in measurement or relay.

They are not one family. Four mechanisms, each with a different discriminator:

| | **blind spot** | **contamination (echo)** | **staleness** | **non-comparability** |
| --- | --- | --- | --- | --- |
| defect is in | the predicate | the haystack | the **artifact measured** | the **comparison** |
| yields | false **zero** | false **positive** | genuine result, **wrong source state** | false **discrepancy** |
| harm lands on | the code claim | the code claim | the code claim | **a peer** — you call their correct number wrong |
| caught by inspecting output? | yes | yes | **no** | no — both numbers are right |
| discriminator | *what can my pattern not match?* | *who emitted the line I matched?* | *what produced the artifact I measured?* | *do these count the same population?* |

**Blind spot.** A `grep "list_files '"` (single quote) found 3 of 6 call sites in a shell script; the
other 3 used double quotes. Caught **from outside by arithmetic, with no repo access**: the project
documents four required formatters, the census accounted for two, so two selections were unexplained.
Also: two enumeration methods agreeing is *not* corroboration when they share a blind spot — two
independent regexes agreed on 787 entries and both were counting a commented-out example and both were
blind to a file using different syntax. Re-derive from the tool's own selector (`git ls-files "$@"`),
not an approximation, and control both instrument (does it find what you know is there?) and population
(does the thing you found zero of exist at all?).

**Contamination.** Grepping a test-failure log for `error[E00116]` and finding it — the match was the
*assertion's own text* echoed in the harness report, not compiler output. The real answer was that no
diagnostic was emitted at all: the exact opposite. A grep answers "does this string occur", never "who
wrote it". Whenever the string you search for also appears in your prompt, assertion, prohibition, or
harness, a hit carries zero information. Read the full log, not the grep.

**Staleness — the worst, because output inspection cannot catch it.** After restoring a reverted hunk I
re-ran a suite and got `534/535` with the PR's own test failing: a real failure of a real test in a real
binary. Every check runnable *on the result* would confirm it. Binary was built 06:15:45; source restore
was 06:16:11. Only provenance works: newest-source mtime < binary mtime < result-log mtime, by
subtraction. It was one message from being published as the PR's sole defect.

*Corollary — work out which direction staleness biases the specific drill; often it is fail-safe.*
Staleness always measures an **older** source state, so in a remove-then-restore drill every mode yields
an alarm or an understatement, never false confidence: "removed → SIGSEGV" self-authenticates (a staler
binary is *more*-patched and would pass); "restored → all pass" fails loudly if stale; "hunk removed →
assertions fail" would, if stale, have wrongly shown the hunk *not* load-bearing. Saying this explicitly
converts a stale-binary incident from a doubt-raiser into evidence for the drill's design.

*Second corollary — a SHA does not freeze CI.* "Checks at `<sha>`: 41 skipping, 0 failing" was true when
measured and false 15½ hours later, after a retry workflow force-ran the yielded run (10 builds all
success, 7 `test-slang` **failures**). Source at a SHA is immutable; **CI runs against a SHA are not** —
they can be re-dispatched. Any CI reading needs a timestamp attached or it silently expires.

**Non-comparability.** My `tests/library/` run gave 12/12 against a peer's 16/16 — the 15 "ignored" tests
were dx11/dx12/DXIL-gated, a consequence of my own `-DSLANG_ENABLE_DXIL=OFF`. Zero failures on both
sides; mine was a *subset*. Structurally likely in any multi-tier chain, since tiers build with different
configs. Publishing "their numbers don't reproduce" would have manufactured a conflict out of two correct
results.

**Why this layer and not the code.** The fix drew adversarial attention because everyone knew a wrong
verdict would be visible; the measurements drew none, because each *feels* like the step that establishes
ground truth. Of the seven, five were caught by their own author on a second pass, one by an outside
reader doing arithmetic on a census that didn't sum, and one — a stale CI claim relayed down two tiers —
only because a third party re-derived what had been declared settled. **The recurrence rate is the
argument, not any single instance.** Practical rule: before a number becomes a verdict, name what your
predicate cannot match, who emitted what you matched, what source state produced the artifact, and
whether two numbers count the same set.
