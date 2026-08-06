---
name: project_7672_test_disabled_inert_directive
description: "slang#7672 delta (cmt 5197417526, authored by sess-1785961513236-2yu0am NOT the 6578 session): //TEST_DISABLED(...) is an INERT no-op — slang-test strips only a LEADING DISABLE_, so those tests silently never run; mechanism verified at source by me, counts do NOT reproduce"
metadata:
  node_type: memory
  type: project
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# `//TEST_DISABLED(...)` IS NOT A DIRECTIVE — it is an inert comment. Verified at source 2026-08-05.

**PROVENANCE FIRST, because I got this wrong once:** authored by **`sess-1785961513236-2yu0am`** (the
**#7672** triager session), posted as cmt **5197417526** on slang#7672. I originally credited it to the
**#6578** session (`…ka72ez`), which refused it — see
[[feedback_a_shared_name_merges_two_sessions_reports]]. Both speak as `from="slang-triager"`.

## Mechanism — I verified this myself, it is not relayed

`tools/slang-test/slang-test-main.cpp:670-679`:
```cpp
const UnownedStringSlice disablePrefix = UnownedStringSlice::fromLiteral("DISABLE_");
if (command.startsWith(disablePrefix))          // :675 — LEADING prefix only
{ testDetails.options.isEnabled = false; command = command.tail(disablePrefix.getLength()); }
```
Only a **leading** `DISABLE_` marks a test disabled-but-parsed. `TEST_DISABLED` therefore never matches
any command: `grep -c '"TEST_DISABLED"'` in that file = **0**, against controls `"TEST"` = 1,
`"TEST_CATEGORY"` = 1, `"TEST_IGNORE_FILE"` = 1. ⇒ **The line is a plain comment. The test does not run,
is not reported as disabled, and is never red** — the silent-residue class, worse than a disabled test
because nothing tracks it. Real examples: `tests/compute/half-structured-buffer.slang:5`,
`pack-any-value-8bit.slang:5`, `extension-on-interface.slang:4`.

⚠️**THE COUNTS DO NOT REPRODUCE and I did not adopt them.** Reported: "40 inert lines in tests/compute,
48 .slang files tree-wide". I measure `tests/compute` = **6** lines; tree-wide `--include=*.slang`
= **30** files; `tests/` = 38 lines / 37 files; whole tree = 38. **No aperture yields 40 or 48.** Same
shape as the 129-vs-127 disagreement earlier today ⇒ likely tree state or a different path root; note
`grep -rc` over a directory returns **412** (per-file counts summed by `wc -l`, not a total) which is a
trap in this exact measurement. ⇒ **Carry the MECHANISM (exactly verified), not the magnitudes.**

⭐**Why this is worth keeping regardless of the counts:** a misspelled directive is invisible in both
directions — CI is green because the test never ran, and a coverage audit counting `DISABLE_` misses it
because the token doesn't match. The fix a maintainer would want is a slang-test **warning on an
unrecognized `//TEST*` command**, which would surface every instance at once.

## The report's other claims — NOT verified by me, do not relay as fact
- successor programme #7723 + batch #8077–#8086 all closed, but bodies show 94/154 ticked (~61%);
  of 57 `tests/compute` CUDA paths only 18 CUDA-enabled, 31 with no directive.
- 6 codex rounds caught 11 must-fixes, **every defect running alarming/confident, never conservative**
  (draft verdict was "superseded → CLOSE" on a live ask; "0% ticked" vs true 61%; 79 vs 77; 53 vs 48).
  ⭐**That error-direction asymmetry is the most reusable claim in the report** and matches my own day
  (three coverage zeros all read as *worse* than reality; a false SHA read as *stronger* evidence).
  Re-source from `…2yu0am` before publishing it anywhere.
- its own `DISABLE_TEST` count used an **unanchored** pattern that prefix-matched `DISABLE_TEST_INPUT`
  — the same bug class as the finding it reports. ⭐Self-caught; worth keeping as the irony that a rule
  about prefix-blindness was broken by prefix-blindness.

## RESUME
#7672 is at rest: sibling verdict cmt `5197243220` + this delta `5197417526`, `assignees=mkeshavaNV`
(departing-owner problem live), milestone Q3 2025 closed, nothing mutated. Maintainer picks
rescope-vs-close; the real deliverable of a rescope is partitioning the residue into *not yet done* vs
*cannot work on CUDA* — **explicitly not done by anyone**, and said so publicly.


---

# ⭐ THE INERT-SPELLING CLASS IS ~161 LINES, AND THE MOST COMMON SPELLING WAS IN NOBODY'S VOCABULARY.

A later session censused every directive-shaped word under `tests/` instead of checking the two known
spellings. **I re-measured independently with `grep -rFe` + a zero-control:**

| token | mine | honoured? |
|---|---|---|
| `DISABLE_TEST` | **889** | ✅ honoured (disabled-but-parsed) |
| `DISABLE_DIAGNOSTIC_TEST` | 4 | ✅ |
| **`DISABLED_TEST`** | **106** | ⛔ **INERT** |
| `TEST_DISABLED` | 38 | ⛔ INERT |
| `DISABLED_DIAGNOSTIC_TEST` | 10 (5 in `//` position) | ⛔ INERT |
| `IGNORE_TEST` / `NO_TEST` | 3 / 2 | ⛔ INERT |
| `ZZZ_CONTROL` | 0 | (control) |

All 106 `DISABLED_TEST` and all 38 `TEST_DISABLED` hits are in **`//`-anchored directive position**, not
prose. Inertness confirmed by string shape: `startsWith("DISABLE_")` needs `_` at index 7;
`DISABLED_TEST[7]` is `D`. ⇒ **~161 lines express an intent to disable that neither disables nor runs.**

⇒ ⭐⭐⭐**`DISABLED_TEST` (106 — the LARGEST inert bucket) was in NO participant's vocabulary: not mine,
not the reporting session's, not the issue body's. A two-spelling check misses 106 of ~161 lines.**
⇒ **CENSUS THE VALUES A FIELD ACTUALLY TAKES; never assert the ones you expect.** Same family as
[[feedback_a_siblings_memo_is_untrusted_input_not_a_finding]] — an enumeration over expectations rather
than over data.

⭐⭐**TWO AGENTS AGREEING IS NOT TWO MEASUREMENTS WHEN BOTH WROTE THE SAME FILTER.** Two sessions' CUDA
censuses (`82/6/129` and `82/7/126`) shared a `-cuda` aperture and both missed 8 files reachable only via
`-target cuda`; the undercount **reproduced exactly and read as replication.** ⇒ **Independent
*observers* are not independent *instruments*. Agreement is evidence only if the apertures differ.**
⚠️Also: their category buckets summed to 215 against a stated 217 — **a partition control (does the sum
equal the total?) catches a double-counted file in one addition** and was not run before publication.

⚠️**ERROR DIRECTION AGAIN, and it is the flattering direction:** undercounting *existing* coverage
inflates apparent remaining work, and it landed inside a recommendation ("audit these N files"). **Nobody
objects to a bot finding MORE to do, so an undercount of work-already-done draws the least challenge.**
Third instance today of defects running alarming/confident rather than conservative.

⛔**ATTRIBUTION — the `82/6/129` census is NOT MINE.** I searched my own session transcript: my only
`129` was the **ParameterBlock test-file count on #6542** (a control figure), and I published **no** CUDA
census at all. ⇒ **A figure attributed to me across sessions must be checked against my own transcript
before I accept or defend it** — the mirror image of
[[feedback_a_shared_name_merges_two_sessions_reports]], where I mis-assigned a peer's work. Same
mechanism, opposite direction: with N sessions under one name, credit AND blame both drift.

⚠️**cmt `5197243220` was EDITED at 21:51:43Z** (created 20:56:31Z, 6907 B, `comments` still 6) — the
census corrections were patched in place, not stacked. Correct call given a sibling's later comment had
already reconciled the figures publicly.
⛔**3rd strike, a footgun worth the ink: `grep -c '-target cuda'` fails `invalid option -- 't'` and
prints an EMPTY count that reads exactly like an absent claim. Use `grep -cFe`.** Fourth false-zero
mechanism of the day.


---

# ⭐ 889 vs 887 RECONCILED — right number, WRONG MECHANISM. Measured 2026-08-05 22:0xZ.

The peer explained the 2-line delta as: `889` = raw string occurrences, `887` = occurrences in
**`//`-anchored directive position**, delta = the two `DISABLE_TEST_INPUT` lines, *"excluded by
construction"* by anchoring. **The arithmetic is right (889−2=887) and the mechanism is wrong.**

```
grep -rFe 'DISABLE_TEST'        tests/  → 889
grep -rFe '//DISABLE_TEST'      tests/  → 889   ← anchoring changes NOTHING
grep -rFe 'DISABLE_TEST_INPUT'  tests/  → 2
grep -rFe '//DISABLE_TEST_INPUT' tests/ → 2     ← both ARE //-anchored
```
Both offenders are `//DISABLE_TEST_INPUT: Texture1D(...)` at
`tests/compute/half-texture-simple.slang` and `texture-simple.slang` — **`//`-anchored, so `//`-anchoring
cannot be what excluded them.** What actually yields 887 is a **word-boundary** aperture:
```
grep -rw DISABLE_TEST tests/               → 887
grep -rE '//DISABLE_TEST(:|\()' tests/     → 887   (requires the delimiter after the name)
grep -rFe '//DISABLE_TEST:' tests/         → 303   (`:` only — misses the `(category)` form)
```
⇒ ⭐⭐⭐**A CORRECT NUMBER WITH A WRONG EXPLANATION IS STILL A DEFECT — and it is the hardest kind to
catch, because the number reconciles.** The arithmetic (889−2=887) *confirmed* the story, so the story
drew no challenge. Only re-deriving each side with its own command separated them. **Reconciling totals
is not verifying a mechanism; check that the stated filter actually produces the stated number.**
⚠️Same shape as the true-fact/wrong-subject family, one level down: here the fact AND the subject are
right and the *causal claim* is wrong.

⭐**The substantive point survives intact and is worth keeping:** a prefix-match on a directive name
silently absorbs longer directives (`DISABLE_TEST` ⊂ `DISABLE_TEST_INPUT`), which is the same cut as the
inertness finding — and the peer's own earlier count was broken by exactly this
([[feedback_a_shared_name_merges_two_sessions_reports]] neighbours it). **The fix is `-w` or an explicit
delimiter class, not `//`.**

## Attribution resolved — the `82/6/129` is a THIRD comment, verified
`gh api repos/shader-slang/slang/issues/comments/5197417526` contains verbatim
**"217 = 82 active + 6 disabled + 129 with no recognised CUDA directive"** (controls: `82 active`=1,
`129`=1, `census`=1, bogus=0). ⇒ ⭐⭐**Not N-sessions-under-one-name: the figure arrived via MY relay and
inherited MY authorship.** I relayed the `TEST_DISABLED` finding from that same comment, so the peer
bound the census to the messenger. **"Who said it" is an identifier, and identifiers are what
composition damages** — the artifact carried its own author field on GitHub the entire time.
✅**Blast radius zero on both public surfaces** (patched cmt `5197243220` contains no attribution tokens;
the shared learning names nobody). Confined to a2a messages.

⛔**FIFTH false-zero/instrument mechanism of the day, and it failed LOUD:**
`grep -rhoFeI 'DISABLE_TEST' tests/` → **47697**, because clustering made `-I` a continuation of `-Fe`
⇒ **the needle became the literal string `I`**, counting every `I` in the suite. ⭐**A result four orders
of magnitude past the effect you are chasing is a claim about the INSTRUMENT** — loudness is the only
reason it was caught. `-Fe` must be last in a cluster or written separately.


---

# ⭐ THIRD MECHANISM WAS THE RIGHT ONE — and I refuted theirs using MY command, which is the same aperture error.

Their census pipeline, run **verbatim on my tree**, reproduces exactly:
```
git grep -hoE '^[[:space:]]*//+[[:space:]]*[A-Za-z_]+' HEAD -- tests/ | sed 's|^ *//* *||' | sort | uniq -c
   887 DISABLE_TEST
     2 DISABLE_TEST_INPUT     ← its OWN frequency row, never a DISABLE_TEST hit
```
⇒ ⭐⭐**The exclusion happens at TOKEN CAPTURE, not at match time.** `[A-Za-z_]+` is greedy, consumes the
whole directive word, and emits `DISABLE_TEST_INPUT` as a distinct row — **their census runs no `grep` at
all**, so match semantics never enter. Their mechanism is correct; mine (`-w` word boundary) is correct
**for my command and wrong for theirs.**

⇒ ⭐⭐⭐**THREE mechanisms were proposed for ONE reconciled total (`889−2=887`): `//`-anchoring (wrong),
word boundary (right for the raw-text command), greedy token capture (right for the census). The
arithmetic confirmed ALL THREE. A number that reconciles across two pipelines says nothing about EITHER
pipeline's mechanism** — it cannot discriminate, so every story survives it. Only running each
pipeline's own steps in isolation separated them.

⛔**MY ERROR, and it is the aperture rule biting in the other direction:** I refuted their mechanism by
running **my** equivalent command, not **their** literal pipeline. ⇒ **WHEN YOU REFUTE SOMEONE'S
MECHANISM, RUN THEIR LITERAL PIPELINE, NOT YOUR EQUIVALENT.** The `-cuda` case was aperture-mismatch
producing false *agreement*; this is the same mismatch producing a false *refutation*. Both directions
are failures of the same rule: [[feedback_a_shared_name_merges_two_sessions_reports]] neighbours it —
**independent observers are not independent instruments, and that cuts for disagreement too.**

⚠️**One sub-claim of theirs does NOT hold, measured:** they argued "the match flag is doing nothing —
`-x`→887 and `-w`→887, identical, because the tokens are already whole." Over their token stream I get
**no flag → 889**, `-w` → 887, `-x` → 887. So `-w`/`-x` agree with each other but **differ from
plain**: a substring grep still matches `DISABLE_TEST_INPUT` (`_` is a word constituent, so `-w`
correctly rejects it). The flag is *not* inert. ⭐**Their HEADLINE mechanism is right for the reason they
gave; the supporting proof cites the wrong invariant — two flags agreeing with each other is not
evidence that flags don't matter, only that those two behave alike.**

✅**The reusable half, now with three fixes instead of one:** a prefix-match on a directive name absorbs
longer directives. Fix with `-w`, an explicit delimiter class, **or greedy whole-token capture** — the
last is strongest because it makes the longer directive *visible as its own row* rather than merely
excluded, and it is what surfaced both `DISABLE_TEST_INPUT` and `DISABLED_TEST` (106), the finding nobody
had vocabulary for.


⭐**ROUND 4 CLOSED — the peer conceded and supplied the distinction that makes the whole sequence
teachable:** its `887` is a **`uniq -c` ROW COUNT, not a grep count** (`git grep -oE … | sed | sort |
uniq -c` runs no grep on the token stream), so *the census* is genuinely flag-independent while *"the
flag is inert on this stream"* is false. **Two different statements, conflated.** ⇒ the correct invariant
is **EXCLUSION vs VISIBILITY**: `-w` buys exclusion; greedy whole-token capture buys **visibility**, and
visibility is what produced the finding — `DISABLE_TEST_INPUT` and `DISABLED_TEST` (106) both appeared as
rows **nobody had thought to grep for**. A grep over expected spellings structurally cannot surface a
token you lack vocabulary for; only enumeration can. ⚠️Its "flags are inert" framing would have licensed
dropping `-w` from a raw-text grep — the exact wrong lesson.

⛔**THE SHAPE, WORSE THAN A MISSING CELL — AN OVERRIDDEN DETECTOR:** the peer had *already printed* the
discriminating number (`889` via `grep -cFe` on that very stream, in an earlier message), then argued the
opposite one screen later. **The evidence arrived, was logged, and was lost to a hypothesis already
formed.** Distinct from an aperture gap: nothing was unmeasured. ⇒ ⭐⭐**When you state an invariant, check
whether your OWN prior output already contradicts it — the refuting cell is often in your transcript, not
missing from it.** Neighbours [[feedback_a_guard_can_be_inert_and_read_as_passing]].

⇒ ⭐⭐⭐**FOUR ROUNDS, FOUR MECHANISMS, ONE TOTAL — and `889−2=887` confirmed EVERY ONE** (`//`-anchoring ✗,
word boundary ✓-for-raw-text, greedy capture ✓-for-census, flags-inert ✗). **A reconciling total is the
moment to STOP trusting the story attached to it and re-derive each side with its own literal command —
including when you are the one refuting.** That is the durable rule from this chain; the directive-count
numbers are incidental to it.
