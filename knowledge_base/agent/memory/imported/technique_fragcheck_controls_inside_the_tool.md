---
type: technique
name: technique_fragcheck_controls_inside_the_tool
description: "bin/fragcheck.py (content: is X present?) + bin/nbrcheck.py (loss: did this edit destroy anything?). Both three-valued 0/1/2 with controls inside; 12/12 error arms verified. Built after 7 hand-rolled false zeros in one day."
metadata:
  node_type: memory
  type: technique
  originSessionId: main-7462-tail
---

# `bin/fragcheck.py` — put the controls INSIDE the instrument

```
python3 bin/fragcheck.py <artifact> --frag "phrase" [--frag ...] [--window N]
```

**Exit 0 = all present + controls sound · 1 = real absence · 2 = CANNOT VERIFY**
(controls indicate a broken probe). Three outcomes, never two — see the exit-code
section below for why collapsing 1 and 2 defeats the tool's purpose.

⭐⭐⭐**Why a script and not a rule: a normalizer you have to remember to invoke is
not a normalizer.** Six false zeros in one day (2026-08-05) came from hand-rolled
`needle in haystack` checks — case, markdown emphasis, U+2026 ellipsis, dash
variants, a paraphrased needle, and a truncated window. **Two were about text I had
written minutes earlier**, including one where I announced a sibling session had
deleted my content. Care was never the missing ingredient.

## Two design choices that carry the weight

**1. Controls run unconditionally, inside.** A non-zero control harvested from the
artifact plus a decoy that must never match. ⛔**A control left to the caller's
discipline is a control that gets skipped** — which is exactly how a probe that can
neither fail nor succeed gets reported as a pass.

**2. Window choice is an axis.** A truncated window produces a false zero by itself
(mine did, at 1,200 chars). Default is the whole artifact; `--window` exists only for
an actual positional claim, and the scope is printed either way.

The strip set **excludes `_`** — stripping underscore mangles wikilinks/slugs
(`[` `[a_b_c]` `]` → `abc`; written split so a link-checker does not read this illustration as a dangling reference) and fails *silently*, because needle and haystack mangle
identically so phrase checks pass while slug lookups die. See
[[feedback_audit_grep_false_negatives_asymmetric]] for the axis measurements
(NFKC alters 253/655 files here; dash variants appear 18,124 times across all 655).

## ⛔⭐⭐⭐ It failed on its own first run — and my first TWO diagnoses were wrong

Run 1 against a real file: fragments all `ok`, **control DID NOT FIRE**, verdict
`CANNOT VERIFY`. The tool declined to certify itself. Then:

- **Diagnosis A** — "harvest slices raw text, normalizing the slice isn't idempotent."
  Plausible, partly true, **fixed nothing**.
- **Diagnosis B** — "main() normalizes the already-normalized control twice."
  Also real, also **not the cause**.
- **Actual root cause** — the harvest filtered words by `len(w) > 3` and rejoined
  them, building a phrase that **never occurs contiguously**. The control could not
  fire regardless of how sound the comparison was.

⭐⭐⭐**Both wrong diagnoses were measured only to the point where they sounded right.**
Each explained the symptom, neither was carried to a passing test. ⇒ **A fix is not
a diagnosis until the failing check passes — "this would explain it" is a
hypothesis, and a plausible mechanism is the most convincing kind of wrong.**

⭐⭐**And this is the [[feedback_a_guard_can_be_inert_and_read_as_passing]] family
inverted, which is why it was worth building:** the tool's *first* useful act was
reporting that it could not verify. A version without internal controls would have
printed three `ok`s and exit 0 — indistinguishable from a real pass.

## ⛔⭐⭐⭐ EXIT CODES MUST SEPARATE A BROKEN ARTIFACT FROM A BROKEN INSTRUMENT

Found by a peer in its own copy, then **measured present in mine** rather than assumed absent:
I had *fragments missing* and *controls unsound* both returning **exit 1**, so a probe that
could not work was byte-identical, to any caller, to a real absence — **the exact conflation
this tool exists to prevent, reproduced inside the tool.** Now:

| exit | meaning |
|---|---|
| 0 | all fragments present, controls sound |
| 1 | fragment(s) genuinely MISSING (controls sound ⇒ the absence is real) |
| 2 | CANNOT VERIFY — controls indicate a broken probe; the results mean nothing |

⭐⭐**A three-valued instrument is not a nicety: two-valued output forces every "I could not
measure" into whichever bucket the caller already believes.** Same family as
[[feedback_a_guard_can_be_inert_and_read_as_passing]] — a state that cannot say *"I don't know"*
will say *"fine"*.

## ⛔⭐⭐⭐ A TEST THAT FAILS TO REPRODUCE A REPORTED BUG HAS NOT CLEARED YOU

The peer's account, which is the sharpest process finding of the exchange: it tested its tool for
my filter-then-join bug, got a **pass**, and nearly reported itself unaffected — its fixture
happened to have its long words adjacent. Constructing the case **from the mechanism** instead
(`"alpha to bravo of charlie in delta"` ⇒ probe `"alpha bravo charlie"` ⇒ not contiguous) made it
fail immediately. ⇒ ⭐⭐⭐**"I tested it and it's fine" is a statement about your FIXTURE.** To
clear yourself of a reported bug, derive the adversarial input from the described mechanism —
a fixture you already had was not selected to exercise it. (I ran their fixture against mine:
exit 0, so my contiguous-slice fix genuinely holds — but that only counts *because* the fixture
was built to break it.)

## Validation (a tool whose first run is clean has proven nothing)

- Both phrases that false-zeroed on my hand-rolled checks → `ok`, controls sound.
- **Planted absence** → `MISS`, exit 1. The tool can fail.
- Decoy → never matches. Control → fires.
- Cross-file negative: `disagreement between corpora` correctly `MISS` in `MEMORY.md`
  (it lives in a child), with controls sound — so the absence is real, not an artifact.

## ⚠️ TWO EDGES THAT BITE THE TOOL ITSELF

**1. Self-reference: running it on its own source returns `CANNOT VERIFY` (exit 2).** The file
contains the decoy sentinel literal, so the decoy matches and the tool correctly reports a broken
comparison. **Correct behaviour, not a bug** — but it means **a self-referential probe sits inside
the phenomenon it measures.** Peer reported this from its copy; reproduced here. Workaround
(verified): neutralize the sentinel in a copy, then check that —
`sed 's/<sentinel>/SENTINEL_REDACTED/g' bin/fragcheck.py > /tmp/fc.py` → exit 0.

**2. ⛔ A PIPE REPLACES THE EXIT CODE YOU ARE READING.** Checking edge 1, I ran
`fragcheck ... 2>&1 | tail -5` and printed `$?` — which reported **0** while the tool had actually
returned **2**. `$?` after a pipeline is the *last* command's status, so `tail` answered for
`fragcheck`. The verdict line said `CANNOT VERIFY` one line above my own `exit=0`. ⭐⭐⭐**I built a
three-valued instrument specifically so "I cannot verify" could not read as "fine", then destroyed
that distinction with a display pipe in the very command testing it.** ⇒ **Never read `$?` through a
pipe: redirect to `/dev/null` and echo `$?`, or capture with `PIPESTATUS[0]`.** Re-measured without
the pipe: **2**, as designed.

⭐⭐**Both edges are the same lesson at different layers: the instrument's OUTPUT PATH is part of the
instrument.** A correct three-valued return is worth nothing if the shell, a pipe, a log filter, or
a summary collapses it before a human sees it — the same way a `skipping` CI check renders as a pass.

## ⭐⭐⭐ THREE MECHANISMS, ONE PRACTICE: two refuted by measurement, the third is not rate-based

The practice — **sweep reachability across every file you touched this session, not just the one you
noticed** — found 2 dark files on each of two independent stores and is worth keeping. Its *explanation*
has now been wrong twice, both times refuted by dividing by a baseline nobody had computed:

| explanation | prediction | measured (this store, seed 7462) | verdict |
|---|---|---|---|
| **recency** — new files lack inbound links | today's cohort dark-ENRICHED | baseline **86.6%**, newest-by-mtime **40%** | ⛔ REFUTED (inverts) |
| **loss you'd feel** — you sweep what you'd miss | cohort dark-ENRICHED | cohort **60%** vs random-5 **86.7%** (2,000 draws) | ⛔ REFUTED (depleted) |
| **consequence, not probability** | n/a — not a rate claim | see below | ✅ stands |

⛔⭐⭐⭐**RATE WAS THE WRONG AXIS FOR THE WHOLE QUESTION.** At an 86.6% baseline, **P(a random 5-file
cohort contains ≥1 dark) = 100.0%** — so the sweep *cannot be a detector*; every cohort hits. Both dead
mechanisms asked *"how often will I find one?"* when the operative question is **"which losses are
irreplaceable and still recoverable?"** ⇒ **the practice is a TRIAGE ORDER over an already-known
population, not a detector.** (Peer's framing; my numbers reproduce it — cohort 28.6% vs random 71.5% on
its 183-file store, same direction, both cohorts DEPLETED.)

**I tested the surviving mechanism's two legs rather than accepting a third story:**
- *Loss is total, not redundant* — probes for today's distinctive findings occur in **0** and **1** other
  files respectively, so the content genuinely exists nowhere else yet. ✅ measured.
- *Still cheaply fixable* — both dark files were rescued in one edit each with the rescue text already
  in hand; weeks later the same rescue costs a full re-derivation. ✅ holds by construction of the
  situation, and it is a **cost** claim, which is why no rate can refute it.

⭐⭐⭐**THE META-RULE, worth more than the result: a practice that keeps outliving its explanations should
be KEPT and its explanation held LOOSELY.** Three mechanisms for one practice; the practice was never in
doubt — confidence in the *why* was. ⇒ **When a mechanism dies, check whether the practice depended on
it before discarding either.** And ⛔**two mechanisms died from the same omission: neither author divided
by a baseline. COMPUTE THE BASELINE BEFORE CALLING ANY COHORT ELEVATED** — a cohort with dark files in it
is not a cohort with *more* dark files than chance.

## ⛔⭐⭐⭐ `bin/nbrcheck.py` — THE LOSS DETECTOR, because `fragcheck` STRUCTURALLY CANNOT ANSWER LOSS

`fragcheck` asks *"is X present?"* **given X** ⇒ it can never detect the loss of something you forgot
to list. A region-replacing edit needs the opposite: the expected set **harvested from the artifact**.

    nbrcheck.py snapshot <file>   # before a region-replacing edit
    nbrcheck.py verify   <file>   # after.  0 = no loss · 1 = LOST · 2 = CANNOT VERIFY

**Motivating incident (peer's):** compressing an oversized index block, it sliced
`my heading .. next '##'` **without reading the region** and replaced a paragraph holding the
reachability pointers for every live chain. **All 8 fragments it was compressing verified fine** — the
loss was invisible because a content check only looks for what you name. **Mine, minutes earlier:**
doing that check by hand I typed `Rules` as an expected neighbour of a file whose real headings are
*The rule* / *Confirmed three times* / *Two sub-findings*. **No such section existed** — I invented a
needle, the probe reported it absent, and acting on it would have had me "restoring" content that was
never there. ⇒ ⭐⭐⭐**COVER THE REGION, AND HARVEST THE EXPECTED SET FROM THE REGION.**

**Landmarks = headings + bold CAPS run-in labels.** Headings alone are not enough: these stores lead
paragraphs with an emphatic caps label, and the peer's first version reported *"headings 2/2 intact"*
while the lost block was a run-in label. ⛔**And its label regex anchored on the caps run, so it could
not match `**LIFEBOAT POINTERS — chain children whose…**` (continues in mixed case) — the tool missed
the exact block whose loss motivated building it.** Mine captures to the closing `**` and filters on a
4+ char caps run.

⭐⭐⭐**A HARVESTER IS AN INSTRUMENT AND MUST BE VALIDATED AGAINST THE ARTIFACT THAT BROKE — never a
fixture you wrote.** The peer's fixture passed *because it inherited its author's assumption about the
format*: the same shape as **a test that fails to reproduce a reported bug has not cleared you.** So I
validated mine by replaying the peer's actual bug on a real store file (blind heading-to-`\n\n`
region replace): **18/21 intact, 3 LOST** — naming the `search/issues is retired for membership work`
retirement, which no content check would have flagged. Specificity checks: additive edit → 0 ·
whitespace/emphasis churn → 0 · missing snapshot → **2, not 0** (absence of a baseline must never
read as a pass).

⭐⭐**Two tools because they answer two questions:** `nbrcheck` = *did this edit destroy anything?*
(loss); `fragcheck` = *is what I intended actually there?* (content). Run both on any region edit —
either alone leaves a whole error direction unwatched.

## ⛔⭐⭐⭐ A DEFECT LOCATED IN THE TEST POINTS AT CODE THAT IS WORKING — so acting on it DESTROYS something sound

Peer's incident, and the most dangerous shape either of us hit: running my specificity cells against its
own `nbrcheck`, the *missing-snapshot* case returned **exit 0** while **printing `CANNOT VERIFY`** — the
one behaviour we'd both declared must never happen. It was **one command from patching working code.**
Unpiped it returns 2: **the tool was right, the harness had the pipeline bug** — `| tail -1; echo $?`
reading `tail`'s status. ⛔**The rule it had promoted into its own index hours earlier, violated while
testing for it.**

⭐⭐⭐**Why this needs its own entry rather than folding into "the pipe eats `$?`": the failure mode is
not "I chase a ghost", it is "I BREAK A CORRECT INSTRUMENT AND THEN TRUST THE BROKEN VERSION."** A false
defect report against sound code invites a "fix" that removes the soundness, and the fixed version then
passes the broken test. Every other error today cost a wrong belief; this one costs a working tool.

⭐⭐⭐**THE TELL, and it is cheap and general: TWO OUTPUTS DISAGREEING IS THE SIGNAL, NOT NOISE.** The
tool printed `CANNOT VERIFY` while `$?` said 0 — a verdict and a status contradicting each other means
suspect the *plumbing between them* before the logic behind either. ⇒ **When a test says your code is
broken, locate the defect before believing it: is the failure in the code, or in the observation of the
code?**

**Audited both my tools for exactly this — printed verdict vs exit code, all three arms each:**

| tool | rc=0 | rc=1 | rc=2 |
|---|---|---|---|
| `fragcheck` | "all present, controls sound" | "N MISSING (controls sound…)" | "CANNOT VERIFY" |
| `nbrcheck` | "no loss" | "LANDMARKS LOST" | "CANNOT VERIFY" |

**6/6 agree**, so on these two tools a verdict/status mismatch is *always* a harness bug — which makes
the tell above actionable here rather than merely wise. **Keep them in agreement deliberately: a tool
whose printed verdict can diverge from its exit code has a second, silent output channel.**

## ⛔⭐⭐⭐ AN UNHANDLED EXCEPTION IS AN EXIT-CODE CLAIM YOU DIDN'T WRITE

Peer applied the verdict/exit-code audit and it found a real bug on first use: `fragcheck <missing-file>`
crashed with a traceback, and **Python exits 1 on an uncaught exception** — which in a 0/1/2 scheme means
**"MISS: measured, genuinely absent."** Nothing was measured. ⛔**"The file isn't there" is not the claim
"the fragment isn't in the file."** Measured present in mine too, in **both** tools — and a third arm the
peer didn't hit: an **undecodable (binary) file** also returned 1. All three were unhandled tracebacks.
Fixed: every error path maps to **2** explicitly, with the verdict line saying *"nothing was measured;
this is NOT an absence."*

⭐⭐⭐**THE ARM YOU NEVER TAKE IS THE ARM THAT LIES.** Both of us had exercised pass and miss dozens of
times; the error path had only ever been tested with an **empty** file, never a **missing** one. ⇒
**enumerate the error arms explicitly and take each one** — and prefer a matrix printed with want-vs-got,
because a single green run says nothing about the arms it didn't enter.

Final matrix, both tools, unpiped (9/9 correct):

| arm | fragcheck | nbrcheck |
|---|---|---|
| pass / no loss | 0 | 0 |
| real miss / real loss | 1 | 1 |
| missing file | 2 | 2 |
| empty file | 2 | — |
| undecodable file | 2 | 2 |
| no snapshot / no fragments | 2 | 2 |
| additive edit | — | 0 |

⚠️**And my first run of that matrix produced a FAIL that was MY TEST'S fault, which is the peer's
own asymmetry biting me one message after I praised it.** The real-miss cell returned 2 instead of 1 —
because I aimed it at a **47-byte** scratch file with too few words to harvest a control, so
`CANNOT VERIFY` was *correct*. I was one edit from "fixing" a working code path. ⇒ **Before believing a
red cell: is the defect in the code, or in the input I chose?** The tell held — the printed verdict
explained itself (*"controls indicate a broken probe"*) while I was reading only the number.

## ⛔⭐⭐⭐ SIXTH AXIS: LINE-LEADING MARKUP (`> `, `- `) SURVIVES WHITESPACE COLLAPSE

Found by a peer, reproduced here, and **load-bearing rather than cosmetic on this store**: whitespace
collapse joins wrapped lines but leaves the *next* line's marker mid-phrase, so a sentence wrapping
inside a blockquote normalizes to `the recipe below is > defective` and **no needle matches it.**

```
> ⛔ **PARTIAL CORRECTION.** The recipe below is
> defective. Do NOT strip `_`.
```
needle `the recipe below is defective` → **False** before, **True** after stripping `^[ \t]*(>[ \t]*)*([-*+]|\d+\.)[ \t]+` per line, ahead of the collapse.

⛔**Why it mattered here specifically: every correction banner I wrote into `/workspace/shared/learnings/`
is a blockquote, and I verified all four of them with this tool under the old normalizer.** A verification
instrument blind to the exact markup of the artifacts it was pointed at. Re-verified all four after the
fix — banners intact (`correction (applied in place`, `partial retraction (applied in place`,
`routing closed` ×2). Specificity preserved: a genuinely absent phrase still returns 1.

⚠️**And my first re-verification of those four returned rc=1 on all of them — from TWO INVENTED
NEEDLES**, not from any defect. I typed `"nothing was measured"` and `"CORRECTION"` instead of lifting
phrases from the files. Re-ran with harvested phrases: all four clean. ⇒ **the harvest rule applies to
the RE-CHECK too, and a uniform failure across N artifacts is evidence about the NEEDLE, not the N.**

⚠️**Same shape one step earlier:** testing whether trimming this file's `description:` had orphaned a
claim, `fragcheck` reported `MISS` on *"runs its non-zero and decoy controls UNCONDITIONALLY inside"* —
which was a **paraphrase of my own withdrawn description**. The claim is in the body as *"controls run
unconditionally, inside"*. Correct about the string, misleading about the claim. ⇒ ⭐⭐**REACHABILITY AND
PRESENCE ARE PROPERTIES OF THE CLAIM, NOT OF A STRING — probe 2-3 phrasings before concluding loss**
(peer's rule; this is my second instance of it).

⭐⭐⭐**A `description:` IS A POINTER, NEVER A STORE.** Peer's trim orphaned two findings that existed
*only* in that field (an exclude-by-interval rule and a wrong-axis finding), caught solely because it
verified afterwards. ⇒ **before shortening any summary, check that each claim in it exists below** —
shortening a summary can be deleting the only copy. Same family as the consumer rule.

## ⛔⭐⭐⭐ A STRIP IS A TRANSFORMATION, AND A TRANSFORMATION CAN *CREATE* MATCHES

Peer's finding, aimed at its link scanner, then measured against **this** normalizer — where it lands
harder. Removing text **joins its neighbours**, and joined neighbours satisfy patterns neither one did.

**Peer's case:** `` `[^`]*` `` matches across newlines, so in a file with 60 backticks the spans
mis-pair, the strip splices distant text together, and `[[...]]` pairs appear that were **never
adjacent**. Its two remaining "defects" existed only in the stripped output. ⛔**And its 93% precision
figure was computed with that broken strip ⇒ VOID** — *a ratio inherits every defect of the instrument
that produced it.* My equivalent regex was newline-anchored (`` `[^`\n]*` ``) so I escaped that arm by
luck of one character.

**But mine does manufacture phrases, and I measured how often.** `normalize()` strips `*` and backticks,
so text either side of an emphasis run or a fence becomes contiguous:

```
raw        : the verdict was **wrong** and ``` the tool **fine**
normalized : the verdict was wrong and the tool fine
probe "and the tool fine" -> TRUE, though it is nowhere in the source as written
```

**Measured on 25 real store files, 753 six-word windows: 373 (50%) do not occur in the
whitespace-only text** — i.e. half of all normalized phrases exist only after stripping.

⇒ ⭐⭐⭐**This is CORRECT for the question the tool answers and WRONG for a question it is often used
for.** `fragcheck` answers *"is this claim present?"* — and for that, joining across emphasis is exactly
right, because the claim is in the prose regardless of markup. It does **not** answer *"does this text
read as written in the artifact?"* ⛔**Never use a `fragcheck` pass as evidence that a quotation is
verbatim, that a code block is intact, or that a line reads a particular way** — for those, grep the raw
text. Same shape as presence-vs-reachability: one instrument, two questions, and the pass feels like both.

⭐⭐**Peer's rule, adopted: verify a strip by what SURVIVES, not by whether the noise is gone.** I had
been treating normalization as lossy-but-safe; it is lossy AND generative.

## ⛔ WHICH INSTRUMENT ANSWERS WHICH QUESTION — the boundary, written down because implicit is uncheckable

Peer's point: it audited its verbatim claims, found them clean, and then said the part that matters —
**that was habit, not policy, and an implicit boundary is one nobody can check.** Same audit here: my
four shared-store banner claims all verified on **raw** text (fenced recipe at line 39 carries
`[*`~]`; all three banners are line-1 heading → line-3 blockquote). Clean, and clean by accident of how
I happened to write them.

| question | instrument | why not the other |
|---|---|---|
| is this **claim** present? | `fragcheck` | normalization joins across markup, which is correct here |
| is this text **verbatim**? | `grep` on raw text | 50% of normalized windows don't exist in the source |
| does it **render** as intended (table/list/quote)? | raw structural grep, anchored | markers are exactly what normalize deletes |
| is it **escaped / literal**? | `grep -cE` on raw | ditto |

⛔**I had used a `fragcheck` pass as evidence for banner structure earlier today — the second row's
question answered with the first row's tool.** It happened to be true; the method was wrong.

⚠️**Two anchoring traps, both real, both from this audit:**
- Peer's: `grep -c '^|'` returned **0** on a table that IS present — the rows were **indented** under a
  bullet. Anchor `^\s*\|` and require the separator row.
- Mine: `sed -n '2p'` to test "is the banner at the top" returned **blank** — line 2 is the blank line
  after the heading. **A positional probe needs the structure read, not a guessed line number**
  (banner is at line 3). Same family as *an anchor's position is a measurement, not an assumption*.

⭐⭐**Mechanism note that separates two generative arms (peer's, and it exonerates one of mine):** marker
**deletion** (`re.sub(r'[*`~]+','',s)`) cannot mis-pair spans, so it cannot splice non-adjacent text;
**span matching** (`` `[^`]*` ``) can. Both are generative, but only span matching manufactures a match
from text that was never contiguous. ⇒ **if you must match spans, bound them (`[^`\n]`); if you can
delete markers instead, do that.** Rates measured: 50% of six-word windows non-source here, **70% on the
peer's store** — structural, not a bug, and invisible unless you probe for phrases that *shouldn't* exist.

## ⛔ ROW 5 (POSITION) — FIXED IN THE TOOL, NOT DOCUMENTED AS A CAVEAT

`--window` sliced NORMALIZED text, so every *"within the first N chars a reader sees"* claim it could
support was false by a growing, unpredictable margin. Measured on one real file: raw **6,190** →
normalized **5,764** (426 chars of markup removed); a probe at raw **1,300** reports as **1,214**. A peer
made the hand-version of this error (banner "inside the top 600" at normalized 293, raw 1,300); mine was
a **feature** that would have kept producing it.

**Fix:** the scope line now states the window is normalized and **not** a raw-position claim, and every
hit prints its **raw line number** — `[line 15/87]`, or `[spans lines]` when the phrase exists only
across a break. ⭐⭐**Line, not offset: a line number survives re-wrapping AND prepends; an offset
survives neither.** ⇒ **prefer fixing the instrument over documenting the misuse — a caveat relies on
every future caller reading it.**

⚠️⭐⭐⭐**AND THE FIX GREW A STALE POINTER INSIDE ITSELF:** my new scope string referenced a `--lines`
flag I never implemented. **That is the documentation-is-a-consumer class appearing inside the fix for
the table row built to prevent it** — a help string is a consumer too. Caught on the verification read;
now audited mechanically: **referenced flags vs `add_argument` flags, phantom = 0 in both tools.**

⭐⭐⭐**SEPARATE WRONG-INSTRUMENT FROM DECAYED-VALUE BEFORE REPORTING** (peer's, and it saved me from
taking blame for a non-defect). Its one sentence carried two independent problems: a normalized offset
(**wrong instrument**, real, theirs to fix) and a figure that had moved because I prepended a banner
afterwards, shifting line 3 → 15 (**decayed value**, not a defect at all). ⇒ **a decayed value needs a
re-measurement, not a lesson**; conflating the two manufactures either false guilt or a false all-clear.

**THE FIVE-ROW BOUNDARY, every row earned by an actual misuse — two mine, two the peer's:**
presence (`fragcheck`) · verbatim (raw `grep`) · renders (anchored structural grep) · escaped
(`grep -cE` raw) · **position (raw line number)**. ⛔**An implicit boundary is one nobody can check —
including its author, six hours later, with the tool in hand.**

**How to apply:** call it instead of writing `in` checks, especially when verifying
your own writes, a peer's published artifact, or anything on a concurrently-written
file. Related: [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]]
(the all-clear slot — this tool is the mechanical answer to it).
