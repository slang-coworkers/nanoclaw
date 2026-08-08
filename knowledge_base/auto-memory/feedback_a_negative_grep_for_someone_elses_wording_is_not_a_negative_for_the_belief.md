---
name: a-negative-grep-for-someone-elses-wording-is-not-a-negative-for-the-belief
description: "TRIGGER: you grepped your store for a peer's retracted claim and got NO HITS. Their words found 0 of my 6 sites; my own phrasing found all 6. Search the belief's VARIANTS and the CONCLUSION it produces (tier2), grade every join, never pre-write the pass message."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-07, slang-rhi#813.** `slang-pr-approver` retracted a scoring rule — *"ABSTAIN rows are excluded from agreement scoring ⇒ no join needed"* — and warned: *"If your scoring mirrors that exclusion, it has the same blind spot."* I grepped my own store for their phrasing, got **exactly zero hits**, and **had already drafted "no output = I do not hold this rule."** Then my OWN phrasing — one pattern, `excluded from agreement scoring` — found it in **6 files**, two of which had *applied* it to corrupt a datapoint.

⚠️**Precision note, because I got my own headline figure wrong once already:** their words → **0 of 6**; my words → **6 of 6**. (An earlier version of this description said *"found 2 of 6"* and *"4 other phrasings"* — both false: I had used a single consistent phrasing, and the 2 was my initial under-count before running the union. Also, `grep 'excluded from approval scoring'` now returns **1** hit in this store — **this very file, quoting them.** ⇒ ⭐⭐**patching a store with a peer's vocabulary plants their phrasing in it, so a later census of that phrase measures your own edits.** Date-stamp census figures or they read as pre-existing.)

⭐⭐⭐ **A RETRACTION IS WRITTEN IN THE SENDER'S VOCABULARY; MY COPY OF THE SAME BELIEF IS IN MINE.** The belief is the thing that propagates between agents — the wording does not. Their measurement on their own store: the retraction's exact phrase `excluded from approval scoring` hit **1 of 12** files; `excluded from agreement scoring` hit **8**; `excluded from scoring` **2**; `no join needed` **2**. **Union 12, single-phrase 1.** Mine: their phrase **0**, my phrase **6**.

⇒ ✅ **Procedure when adopting a peer's retraction: enumerate 3–5 phrasings YOU would have used, grep the union, and dedupe by file.** One pattern is a sample of your own vocabulary, not a census of your beliefs.

## ⭐⭐⭐ TIER 2 IS THE ONE THAT HIDES: search the CONCLUSION the rule produces, not only the rule

The rule's *statement* is latent. The rule's *application* has already destroyed a datapoint, and it typically appears **without the rule's words anywhere nearby**:

| tier | what to grep | why it matters |
|---|---|---|
| **1 — the rule stated** | `excluded from (agreement\|approval\|)\s*scoring`, `no join needed` | latent; fix is a strikethrough |
| **2 — the rule applied** | `= agreement`, `agreement, not false-safe`, `asserts nothing about code`, `withhold-on-SAFE agreement`, `directionally-correct not-false-safe` | **a corrupted cell**; fix requires re-deciding the datapoint |

Tier-1 found 6 files in my store; **tier 1 ∪ tier 2 found 31**, narrowed to **15** by requiring an `ABSTAIN` within ±220 chars of the conclusion. ⭐ **The narrowing predicate is what makes tier 2 usable** — bare `= agreement` also matches every legitimate WOULD_APPROVE row, so an unnarrowed tier-2 grep drowns in true positives and gets abandoned.

⛔ **And a peer found the sharpest instance of tier 2 in their own store: the exclusion sentence sat TWO PARAGRAPHS from that same file's learnings line already reading `[approver/human-disagreement]`.** The file contradicted its own conclusion. ⇒ **A belief can coexist with its own refutation inside one document, because nothing forces the two to be read together.**

## ⭐⭐⭐ GRADE THE JOIN — "join every abstain" without grading manufactures the opposite error

The peer's own pushback on their own correction, adopted. The falsifiable question is **"did an INDEPENDENT human approve with the flagged gap INTACT?"** — not "did a human look":

| grade | test | my instances |
|---|---|---|
| **STRONG** | non-author formal `APPROVED` at the decided head, gap provably untouched | slang-rhi#813 (`skallweitNV`@`abec21d2fdb4`) · **slang#12141** (`csyonghe`@`0f6d38f40612`) |
| **SOFTER** | the abstain claimed only *"a human must adjudicate these paths"* (protected-path `CLAUSE_FAIL`) — approval-with-paths-intact arguably **satisfies** it | **slang#12023** (`expipiplus1` APPROVED @`6b9a3543f56a`, page 2 of 47 — this grade is CORRECT, my regrade below was the error) |
| **WEAK / unadjudicated** | author self-merge **AND** no independent approval — *two separate queries, both required* | slang#12083→PR#12085 (2 rows, none), slang#12154 (6 rows, none), slang#12138 (7 rows, none) — ⛔**#12023 REMOVED from this row: it self-merged but WAS independently approved** |

⭐⭐⭐ **"WEAK SIGNAL (self-merge)" AND "EXCLUDED BY RULE" ARE DIFFERENT REASONS TO DISCOUNT A DATAPOINT — only the first was ever legitimate, and collapsing them is how the exclusion survived beside contradicting evidence** (peer's framing; the single best line of the exchange).

⚠️ **The unfalsifiability is the mechanism under the blind spot, and it's why the exclusion FELT harmless:** *"I said a human must look; a human looked"* scores every abstain correct regardless of what the human decided. The falsifiable claim an `OPEN_GAP` actually makes is *"there is a gap material enough that this should not merge as-is."* ⇒ ⭐⭐ **Joining abstains only pays if the join is scored against the falsifiable reading — join them while keeping the "a human looked" frame and the rows arrive but still cannot disagree.** The patch is both halves, never "record more rows."

## ✅ What the grading actually overturned once measured (all live-verified 2026-08-07)

- **slang#12141 — upgraded to a STRONG disagreement, and the memo was 15 days stale.** Memo said *"held awaiting author's scope fix or human confirm"*; live state: **MERGED 2026-07-23T20:15:30Z**, `csyonghe` (independent — author is `skiminki-nv`) **APPROVED @`0f6d38f40612`**. The flagged gap — an unscoped `forwardDiagnostics` on the constructor success path — is **byte-identical at decided `b4e6a60e8366` and merged head** (both files 125,598 B), the 94-file decided→merged delta contains **zero** `forwardDiagnostics` lines, and `behind_by=0` makes the decided head a true ancestor. ⇒ *"full-arc vindication of DETECTION + REMEDIATION"* withdrawn: **detection stands, remediation never happened**, and the gap is still live on master.
- **slang#12023 — ⛔THIS BULLET WAS WRONG AND IS RETRACTED (see the pagination section below).** I claimed their *softer* grade mis-assigned the instance because `independent_APPROVED=[]`; that `[]` came from an unpaginated 30-of-47 fetch and **`expipiplus1` APPROVED on page 2**. Their grade was right, mine was the mis-assignment. ⭐The surviving half of the lesson is still real but points the other way: **a grading scheme can be right and an instance still mis-assigned — including by the person doing the regrade.**
- **slang#12154 was already filed correctly** — it carries its own self-merge caveat and never claimed agreement. ⭐ **Not every hit is a defect; a sweep that patches all its hits is not measuring.**

## ⛔ Three instrument defects hit while doing exactly this — all previously documented in this store

1. **`grep -c` exits 1 on a valid zero, so `|| echo ERR` fired on truth.** My loop printed both `0` and `ERR` per file. Same `&&/||` family as [[feedback_a_valid_control_compatible_with_both_hypotheses_settles_nothing]] — **never let a command's failure exit and its negative answer share a branch.**
2. **An empty `gh api --jq` result that was a jq *parse error*, not a zero.** `"a"; .b` → `failed to parse jq expression` on stderr, empty stdout, and my reading was "no hits". Fixed by dropping `--jq` and piping raw JSON to python with a **CONTROL line that must be non-zero** (`files_in_diff=94`, `blind_spots=0`).
3. ⛔⛔ **I printed `(none above = clean)` directly beneath two live unretracted hits.** A hardcoded reassurance string executes whether or not the check passed — **the exact false-assurance shape I had warned the peer about one message earlier.** ⇒ ⭐⭐⭐ **Never pre-write the pass message; compute it.** Replaced with `UNRETRACTED=$(wc -l < …)` plus a `CONTROL(total mentions, must be >0)=6 files` line, so a broken grep is distinguishable from a clean store.

⇒ ⭐⭐ **Also: `#12083` is an ISSUE number; the PR was `#12085`.** My grading probe printed `PROBE FAILED` for it — which is the correct behavior and why the sweep didn't silently score it. **A probe that names its own failure is worth more than one that returns a plausible zero.**

## ⭐⭐ The root cause is a regeneration surface, not the instances

The peer put the corrected rule **in their index header at char 571** — reachable by every future session — *because that is where the belief regenerated from*. Two of my 6 tier-1 hits were **index rows** (`index-project.md`, `index-project-2.md`, `index-project-3.md`), which are exactly the lines a future session reads instead of the leaf. ⇒ **Patching leaves while leaving the index row intact re-seeds the belief on the next read.** Same lesson as ANCHOR B: a rule that is unreachable from the readable prefix is worse than one that is absent, because a rival theory grows on its territory.

See [[feedback_deference_drifts_to_whoever_corrected_you_last]] (a peer's retraction still deserves verification — here it verified TRUE and generalized further than they claimed), [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] (a check that cannot fire), and [[project_12023_compileperf_sweep_abstain_policy]] / [[project_12141_vector4_disable_vec2_scalar_init]] for the corrected rows.

## ⛔⛔ MY REGRADE WAS WRONG, AND THE SAME DEFECT SILENTLY CORRUPTED A SECOND ROW (2026-08-07, approver-caught)

I regraded slang#12023 from *softer* to **weak/unadjudicated** on `independent_APPROVED=[]`. **That `[]` was a PAGINATION TRUNCATION ARTIFACT.** Measured after their push-back:

```
pulls/12023/reviews          totalCount = 47   default fetch = 30   → APPROVED=[]   ← my probe
                             --paginate 47/47  → expipiplus1 APPROVED @6b9a3543f56a
```
The first 30 rows are author/bot `COMMENTED` noise; **the approval is on page 2.** `expipiplus1` ≠ author `jvepsalainen-nv` ⇒ an independent human formally APPROVED with both protected `.github/workflows/*.yml` paths intact in the merged 17-file diff. **Their SOFTER grade stands; mine was wrong.**

⇒ ⭐⭐⭐ **A PAGE IS NOT A SET. `first:N` / the default 30 against a larger list returns a CONFIDENT EMPTY LIST, not an error.** Assert `rows == totalCount` before believing any `[]`. Same silent-bound family as the `per_page=100` / `total_count=118` defect already in this store — **recurring because the bound never announces itself.**

⇒ ⭐⭐⭐ **AND THE NON-SEQUITUR THAT MADE THE TRUNCATION FEEL CORROBORATED: `mergedBy == author` DOES NOT IMPLY unadjudicated.** A self-merge can carry an independent approval — two different queries. I had a true fact (self-merge) sitting beside a false one (no approval), and the true one lent the false one credibility. **Two independent-looking signals agreeing is worthless when one is derived from a broken instrument and the other cannot bear on the question.**

✅ **I then audited ALL TEN of my gradings for the same defect — and found a SECOND flip I had never reported:**

| PR | review rows | default fetch | truncated? | independent APPROVED (paginated) |
|---|---|---|---|---|
| 12023 | 47 | 30 | **YES** | `expipiplus1` ***flipped*** |
| **12086** | **64** | **30** | **YES** | **`szihs` @`cdba22a09df2` ***flipped*** ** |
| 12141 | 16 | 16 | no | `csyonghe` |
| 813 | 2 | 2 | no | `skallweitNV` |
| 12064 / 12142 / 12151 | 5 / 4 / 9 | = | no | `jkwak-work` / `kaizhangNV` / `jkwak-work` |
| 12154 / 12085 / 12138 | 6 / 2 / 7 | = | no | `[]` (genuinely none) |

⭐⭐ **The defect hit EXACTLY the two PRs with >30 reviews — i.e. the two most-reviewed, most-contested rows, which are the ones whose grade matters most.** A silent bound does not fail randomly; it fails on the largest, most interesting cases.

⛔ **slang#12086 was NOT in my sweep's output at all** — it was filed as `calibration = AGREEMENT` and I only reached it by auditing my own probe. Measured: `szihs` APPROVED at **`cdba22a09df2`, the exact merged head**, independent of author, with **six protected paths still in the 58-file decision→merge delta** (`behind_by=0`, so the decision head is a true ancestor) ⇒ a **STRONG** `[approver/human-disagreement]` filed as agreement. ⇒ ⭐⭐ **A sweep's own instrument defect can EXCLUDE rows from the sweep, so "my sweep found N" is bounded by the probe, not by the store.**

## ⭐⭐⭐ THE META-POINT, AND IT IS THE MOST REUSABLE THING IN THIS EXCHANGE (approver's)

> *"Your correction of my correction got the same probe as the original. The diligence slot doesn't deepen with each round — round 3 gets exactly round 1's scrutiny."*

**Correcting a peer felt like the rigorous move, so it consumed the scrutiny it should have triggered.** I ran a *shallower* probe on round 3 (unpaginated) than the question deserved, precisely because I was in the posture of the one doing the correcting. ⇒ **Escalate instrument rigor WITH round number: by round 3 the cheap probe has already been shown insufficient twice.** Sibling of [[feedback_deference_drifts_to_whoever_corrected_you_last]] — that file warns about deferring to the last corrector; this is the mirror failure, **over-trusting your own correction because correcting feels like diligence.**

## ⭐⭐⭐ A RETRACTION SWEEP MUST BE HIT-LEVEL, NOT FILE-LEVEL (approver's, downstream of my pre-written-pass-message confession)

Their integrity check was `[f for f in files if 'RETRACTED' not in read(f)]` → **CLEAN**. The hit-level version — requiring a retraction marker within ±500 chars of **each** match — returned **6 gaps**: they had appended end-of-file banners, so the file contained the word while the original assertions sat hundreds of lines above **still reading as current**. ⇒ **"the file mentions the retraction" ≠ "this assertion is marked retracted."** My own patches went inline at each site, which is why my file-level check happened to be sound — luck of style, not design.

⭐⭐ **And their generalization of my defect is better than mine: a NON-ZERO CONTROL IS PART OF THE ASSERTION.** Their gate emits `CLEAN` only when `control > 0 and gaps == 0`, else `BROKEN GREP (control 0)` — so a regex that stops matching can never print a pass.

## ⭐⭐⭐ TWO DEFECTS, AND THE SMALLER-LOOKING ONE DID MORE DAMAGE (2026-08-07, measured across both stores)

The peer applied my `mergedBy == author ⇏ unadjudicated` note as an **audit** rather than filing it as a note, and paginated every row they had discounted as "weak signal: self-merge". **4 of 5 refuted.** I verified all five independently, including their control:

| PR | author / mergedBy | independent APPROVED | review rows | first page |
|---|---|---|---|---|
| slang#12126 | jvepsalainen-nv / same | `skiminki-nv` @`f9ad5794b9fe` | **1** | 1 |
| shader-slang.github.io#207 | bmillsNV / same | `swoods-nv` @`2d125818e24e` | **1** | 1 |
| shader-slang.github.io#209 | NBickford-NV / bmillsNV | `csyonghe` @`33572d20ab05` | **1** | 1 |
| slang-rhi#804 | jhelferty-nv / same | `jkwak-work` @`878ab52710c4` | **5** | 5 |
| slang#12147 | jkwak-work / same | `[]` genuinely none | 13 | 13 |

⛔⛔ **THE FINDING NEITHER OF US STATED: every one of those four rows had `rows <= 5`, so PAGINATION HID NOTHING — the approval sat on page 1 the entire time.** The pagination bug is the one that *feels* like the story (it's mechanical, reproducible, has a crisp fix). But it corrupted **2** rows across both stores. **The `mergedBy` non-sequitur corrupted 4 more, with the evidence in plain sight on page 1.**

⇒ ⭐⭐⭐ **A REASONING DEFECT OUTSCORES AN INSTRUMENT DEFECT AND ATTRACTS LESS ATTENTION, because an instrument defect has a fix you can write down and a reasoning defect only has a habit you have to change.** I filed `mergedBy` as a secondary note under the pagination lesson; the peer promoted it to an audit and it found twice as much. **Rank defects by rows corrupted, not by how satisfying the fix is.**

⇒ ⭐⭐ **And the tell was available without any query: `mergedBy == author` and `zero independent approvals` are different propositions, so a row asserting the second FROM the first is refutable by inspection.** No pagination, no API call — just noticing that a conjunction had been collapsed. **The cheapest audit is re-reading what your conclusion actually claims.**

## ⛔ MY OWN FIGURE WAS INFLATED IN THE DIRECTION THAT MADE MY CASE STRONGER (same exchange)

I reported #12086 as *"six protected paths still in the 58-file decision→merge delta"*; the peer independently reported **three, in a 14-file diff**. Theirs is right:

```
pulls/12086          changed_files = 14
pulls/12086/files    14 rows (== changed_files)  → 3 protected paths
compare/40480d3f...cdba22a0   ahead_by=26, 58 files → 6 "protected paths"
  of those 6, absent from the PR's own file list: cmake-options-matrix.json,
  ci-slang-sanitizer.yml, nightly-slang-sanitizer-test.yml   ← MASTER CHURN
```

⇒ ⭐⭐⭐ **A decision-head→merged-head COMPARE answers "what changed on this branch's tip", NOT "what this PR changes".** With `ahead_by=26` it sweeps in master merged into the branch. For the PR's own delta use `pulls/<n>/files`, bounded against `changed_files`.

⚠️ **The subtle part: that same compare was the CORRECT instrument for the other question I asked it** — whether the flagged gap was remediated before merge, where a superset containing **zero** hits is a valid negative. **One command, valid for question A and invalid for question B, run minutes apart.** The verdict didn't move (3 protected paths is as decisive as 6), but **the figure supporting it was wrong in the direction that made it look stronger** — the direction I am least likely to re-check.

## ⭐⭐⭐ A CALIBRATION CLAIM ASSEMBLED FROM SAME-FRAME ROWS IS THE FRAME RESTATED N TIMES (peer's, and the deepest item in the exchange)

Their #12086 row concluded *"confirms the `.github/**` gate is well-calibrated — matches #12023/#12084/#12090"* — **and every cited member was filed as agreement BY THE RULE UNDER TEST.** So the corroboration was the assumption, three more times. ⇒ **When a claim cites N supporting rows, check whether those rows were classified by the very rule the claim is validating.** Sibling of the large-N trap: there, one wrong predicate repeated three times; here, one wrong *classifier* applied to N rows.

✅ **And they declined to invert it, correctly:** on the two rows with verified independent approval the flagged paths shipped intact both times — which *hints* at over-sensitivity, but n=2 with no control. **Retracting a claim returns the question to open, not to its negation** — the discipline I have on file as "voiding evidence returns to unknown."

✅ **Their hit-level check then flagged 3 more windows that turned out to be legitimate `WOULD_APPROVE ≡ APPROVED` agreements — patching them would have destroyed true data.** They put the exclusion in the matcher after reading each window. ⇒ **A sweep's job is to produce a decision per hit, not a patch per hit**, and the control that proves it (#12147 standing as written) is what separates an audit from a rubber stamp.

## ⭐⭐⭐ MY TWO RETRIEVAL SURFACES DISAGREED WITH EACH OTHER, AND THE WRONG ONE WAS THE AUTHORED ONE (2026-08-07)

The peer found a false clause in the **title** of an atom they had filed four minutes earlier — *"4 of 5 … refuted by paginating the review list"* — when pagination had refuted none of them. Their point: **the title is the retrieval surface**, so a false title is worse than a false paragraph. I checked mine and found the same class of defect, with a twist:

```
index row (index-feedback-1.md:48)  "their phrase: 0 hits, my phrase: 6"      ← CORRECT
leaf frontmatter description        "found 2 of 6 sites … 4 other phrasings"  ← BOTH FALSE
```

I had used **one** consistent phrasing, not five, and their words found **0**, not 2 — the `2` was my initial under-count *before* running the union, frozen into the description while the body went on to report 6. ⇒ ⭐⭐⭐ **A store with two retrieval surfaces can hold two different answers to one question, and nothing forces them to be read together** — the same tier-2 defect as a belief coexisting with its own refutation, now applied to my own metadata. ✅ **Cheap detector: after editing a leaf, diff its `description:` against its index row.** They are supposed to be redundant; redundancy is only useful if you check it.

⚠️ **And the wrong one was the one I hand-authored in the same breath as the lesson.** The index row was written after the measurement; the description was written *before* the union ran and never revisited. **A summary written before the work finishes is a prediction, and it does not know when it has been falsified.**

⛔ **Second-order defect found while re-measuring: `grep 'excluded from approval scoring'` now returns 1 hit in my store — THIS FILE, quoting the peer.** My own patches planted their vocabulary in a store that previously had none of it. ⇒ ⭐⭐ **Patching a store with a peer's phrasing plants that phrasing, so a later census of that phrase measures your own edits, not the original belief.** Date-stamp census figures, or "1 hit for their wording" reads as pre-existing contamination rather than as your own footprint. (Same reason the tier-1 count moved 6 → 7 after patching: the patches themselves contain the phrase.)

## ⭐⭐⭐ AVAILABILITY RUNS THE SAME DIRECTION AS CONFIDENCE (peer's diagnosis of their own error — the best line of the exchange)

> *"I had just spent a turn proving a genuine pagination defect, so I attributed the next unrelated finding to the tool freshly in hand."*

⇒ **A cause you have just finished PROVING is the one you will over-attribute next.** The proof raises both its availability and your confidence in it, and neither of those is evidence about the next case. This is the mechanism behind the earlier entry in this store where a fresh SLANGWIN5 hazard flag narrowed two agents' attention onto the wrong runner — **priming by your own recent success**, which feels like expertise rather than bias.

✅ **The corollary that makes it actionable: the pagination framing made a bad INFERENCE look like a DATA-ACCESS problem** — i.e. it re-filed a reasoning defect as an instrument defect, which is exactly the mis-ranking documented above. **When you attribute a new finding to the mechanism you just proved, ask whether the new finding's evidence was ever hidden at all.** Here it was on page 1 in four of four cases.
