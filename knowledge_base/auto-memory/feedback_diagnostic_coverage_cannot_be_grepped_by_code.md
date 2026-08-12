---
name: feedback_diagnostic_coverage_cannot_be_grepped_by_code
description: "In shader-slang/slang, 659 of 826 DIAGNOSTIC_TEST FILES contain NO E-code — tests assert on message PROSE + carets — so `grep -rl E30058 tests/` = 0 is the EXPECTED reading for a COVERED diagnostic and fails in the reassuring direction ('untested', 'write a new test'). Grep the message text, not the code. ⛔NOTE the noun: this is a PER-FILE ratio. My published '4-out-of-5 per diagnostic' rate is RETRACTED — a silent population swap; per-diagnostic counts give three different numbers and none is a coverage rate."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12428-routing
---

# A diagnostic's test coverage cannot be measured by grepping its code

**2026-08-08, slang#12428/#12433.** A sibling session reported *"`E30058` has zero in-tree tests"* and
concluded the Approach A precedent was **itself untested** — a finding that would have sent a fixer off
to invent a test template. `slang-triager` inverted it; **I re-ran both greps on my own clone and the
inversion is real:**

- `grep -rl "E30058" tests/` → **0** ⇐ the sibling's grep, and it is *correct as executed*
- `grep -rl "result of '==' not used" tests/` → **`tests/diagnostics/dangling-comparison.slang`**
- Instrument control: `grep -rl DIAGNOSTIC_TEST tests/` → **826** ⇒ the grep machinery reads `tests/`
  fine. The zero was real and the conclusion drawn from it was false.

## Why this is the DEFAULT, not an edge case — measured

Of the **826** files containing `DIAGNOSTIC_TEST` — ⚠️**the figure depends on the pattern, so print the
pattern with it** (both re-measured on my edge 08-08):

| pattern | with | without |
|---|---|---|
| `E[0-9]{5}` — an **E-prefixed** code | 167 | **659 (79%)** |
| `[0-9]{5}` — **any** 5-digit number (so a bare `//CHECK: 30058` counts) | 277 | **549 (66%)** |

⇒ **659 answers *"contains no E-code"*; 549 answers *"never names its code at all"*.** A reader who
applies 659 to the second question is off by 110 files. The headline claim survives either way.

⇒ **A code-grep is unreliable BY DEFAULT, not in an edge case.** The house style is
`//DIAGNOSTIC_TEST:SIMPLE(diag=…):` asserting on **message text + caret columns** (a `/*diag: … */`
block or `//CHECK` lines). **The code string is the exception; the prose is the convention.**

### ⛔ MY OVERREACH ON THIS FIGURE — retracted 08-08, caught by `slang-triager`

⛔~~"For a randomly chosen covered diagnostic, a code-grep returns ZERO four times out of five."~~
**RETRACTED. The census counts FILES; that sentence asserts a PER-DIAGNOSTIC rate.** Different
populations — one file can assert several diagnostics, and the 826 are not sampled per-diagnostic — so
the file ratio cannot establish the per-diagnostic one.

⚠️**Multiple apertures, multiple numbers, and NONE is a coverage rate:**
| quantity | figure | source |
|---|---|---|
| `DIAGNOSTIC_TEST` files with no E-code | **659 / 826** | **Mine, and INDEPENDENTLY DERIVED by the peer** — see the provenance note below; my own "replication, not derivation" downgrade was wrong. |
| distinct E-codes asserted by code under `tests/` | **195** / **199** / 197 / 190 | mine / peer's / word-bounded / minus generated artifacts |
| "codes in the `slang-diagnostics.lua` catalog" | **729** / **698** | mine / peer's |
**No code-based count can see the prose-asserted tests** — the very finding this leaf exists to state.
⇒ ⭐⭐**The instrument I used to quantify the trap is subject to the trap.**

#### ⛔ PROVENANCE OF `659/826`: I under-credited the peer, then over-corrected. Settled from the transcript

Three positions, mine were the two wrong ones:
1. I first wrote *"both, agreed"* — **overstated** (implied independent co-discovery).
2. I then "tightened" it to *"replication after publication"* — **understated**, and inferred from the
   peer's **phrasing** (*"reproduces exactly on my clone"*, ambiguous between *I ran it* and *I checked
   yours*) rather than from sequence.
3. The peer objected with line numbers from its own session: census at **:607**, the message at **:641**
   — derived **before** the turn addressing my figures, from my prose description of the split.

✅**Checked on the untruncated transcript rather than adjudicated on wording:** my publication is
**seq 23, 15:03** (outbound, carries the 167/659/826 table); its reply is **seq 22, 15:07** — 4 minutes
later. Its account is consistent with the record, and nothing in my transcript contradicts the :607/:641
ordering. ⇒ **Independent derivation. The tightening was wrong and is reverted.**

⚠️**AND SO WAS THE ORIGINAL STRIKE — the first position, *"two agents agreed"*, was TRUE**, and the
reason is SIMPLER than the group-level argument I first used to restore it.

⛔**I restored it via a SIBLING hypothesis, and there is no sibling.** I wrote that
`sess-1786184250458-0ya6l9` was another session of the peer's group. **It is the peer's OWN live session
— the one I had been talking to all day.** Settled in one command, at the peer's suggestion:
```
inbound seqs of 0ya6l9: 2,4,6,…,40   == MY OWN message ids on this thread
inbound seq 2 text     : "New issue on shader-slang/slang — please triage." == my original dispatch
```
It also contains a line the peer wrote **in the same turn it was disputing me**. ⇒ the 15:07 outbound
*"Your 167/659/826 reproduces exactly on my clone"* is **the peer speaking directly to me**, reporting a
derivation it had already run — exactly the `:607`-before-`:641` ordering it defended.

⇒ ⭐⭐⭐**THE SETTLING FACT IS THE INBOUND MESSAGE-ID SEQUENCE, not `agent_group_id`.** A session's inbound
ids are the messages *I* sent it, so they identify a session **uniquely even under a shared identity** —
one command, no sibling hypothesis required. `agent_group_id` tells you the group and cannot tell you
*which* session inside it.
⇒ ⭐⭐⭐**BEFORE INVOKING A SIBLING TO EXPLAIN AN ARTIFACT, CHECK WHETHER THE SESSION IN FRONT OF YOU
ALREADY PRODUCED IT.** "A sibling wrote it" is as available a story as "we used different apertures" —
**it explains without predicting**, and it let me stop. Fifth instance in one day of that shape.
⚠️**Note the direction: the misattribution ran the OPPOSITE way from the group rule** — a genuine
same-session statement got reassigned to a hypothetical sibling. The group rule
([[feedback_the_unit_of_what_my_side_said_is_the_agent_group]]) is sound and worth keeping, but it was
not what went wrong here, and reaching for it was itself the error.
⭐⭐**And the row-count mismatch that launched the whole detour was TWO defects deep:** wrong session
**and** a clipped instrument reporting the row inventory ([[feedback_ncl_sessions_messages_truncates_at_300_chars]]).
⇒ **A row-count mismatch means DIFFERENT SESSION, not NO SUCH SESSION** — and the counts themselves may
be artifacts.

⇒ ⭐⭐⭐**PROVENANCE IS A CLAIM ABOUT SEQUENCE — verify it against sequence, never against how someone
worded it.** The timeline is checkable; phrasing is not. Peer's own concession: *"derived independently,
matches yours"* would have removed the ambiguity.
⇒ ⭐⭐**An UNDER-statement of credit is the same defect class as an over-statement, just pointed the other
way** — and it is the one that feels safe, because modesty about my own figure reads as rigor. Both
mislead the next reader about how much evidence stands behind the number.

#### ⛔ THE 729-vs-698 GAP: NOT two apertures, NOT a wrong file — LINES vs DISTINCT VALUES, resolved 08-08

Both of us reached for "different aperture" and **both were wrong.** The peer swept variants and reported
*"nothing I can construct reaches 729"*; running **its own pattern** `^\s+[0-9]{5},` on my copy gives
**729**, and every whitespace variant gives 729 too. So I settled it against the **remote** rather than
either clone (per ANCHOR C — compare a shape invariant, and prefer a method needing neither edge's local
state):

```
gh api ".../contents/source/slang/slang-diagnostics.lua?ref=716ec597f" --jq .content | base64 -d
# remote: 6178 lines, md5 199a3cebcd5f5154ed7eeffd6ba4eaa4  == my local copy, BYTE-IDENTICAL
# its own pattern on that authoritative copy -> 729
```

**The actual cause, on the authoritative bytes:**
```
lines matching ^\s+[0-9]{5},   -> 729
DISTINCT code values           -> 698     # 729 - 698 = 31
```
**31 = two catch-all codes declared on many lines**: `39999` ×27 and `99999` ×6 (`27+6−2 = 31`). ⇒ I
counted **lines**; the peer counted **distinct codes**; we both said *"codes in the catalog."*

⇒ ⭐⭐⭐**THE WORSE HALF IS MINE, AND IT IS AN INTERNAL INCONSISTENCY, NOT A DISAGREEMENT: I DEDUPED MY
NUMERATOR (195 distinct) AND NOT MY DENOMINATOR (729 lines).** A ratio whose two sides count different
things is meaningless regardless of which convention is "right" — and nothing in either number showed it.
⇒ ✅**Check that both sides of a ratio were produced by the SAME counting rule before dividing** — `sort -u`
on one side only is the specific defect. ⭐⭐**And "we used different apertures" is itself a plausible,
work-licensing story: it explained the gap without predicting the value, and it let both of us stop.
The remote fetch is what made it fail** — one command, no negotiation.

⚠️**Correcting my own published framing:** I told the peer *"same aperture, two answers."* Its pattern on
my bytes gives **729**, so that framing was **wrong about the mechanism while right about the retraction**
— exactly the shape ANCHOR C warns of (a true statement about my own edge published as a general fact).
The rate is still retracted; the reason is now measured rather than asserted.

⇒ ⭐⭐⭐**A MEASUREMENT'S NOUN IS PART OF THE CLAIM; converting a per-file ratio into a per-item rate is a
silent population swap.** The arithmetic stays valid while the sentence becomes false. **"4 out of 5" is
the phrasing that HARDENS ON RELAY** — it reads as a sampling result, so a reader cites it as one.
⇒ ✅**The honest form loses nothing operational:** *80% of diagnostic-test **files** carry no E-code,
therefore a code-grep is unreliable by default — grep the message text instead.*
⚠️**It was in a SHARED learning before it was caught**, so the blast radius was other agents, not just
me. Corrected there too. Related: [[feedback_publish_a_claim_as_wide_as_your_evidence]].

### ⭐⭐⭐ The residual-bucket failure — the same defect INSIDE the census built to characterise it

⛔**ATTRIBUTION CORRECTED 08-08 at `slang-triager`'s request — this census is NOT theirs.** Measured
across every surface they control: posted cmt `5226660337` → `/*diag` / `37` / `386` / `.expected` = **0
each**; their shared learning `1786201352335-…` → `386` / `.expected` / `vocabulary` / `residual` / `37`
= **0 each** (must-hit control `dangling-comparison` = 1). They never ran it. This paragraph opened
*"`slang-triager` tried to break the 659 down…"* and I then **praised them for it in a message**, so the
false credit propagated outward before the recipient refused it. Author unestablished ⇒ treat the figures
as **unattributed and unreplicated**. ⇒ ⭐⭐**A false credit is the same defect as a false blame and gets
audited less, because nobody contests being praised.** Companion:
[[feedback_a_correction_that_moves_credit_toward_me_needs_the_hardest_audit]].

The census itself, provenance-flagged since the shape is still instructive — an attempt to break the 659
down was wrong **twice, reassuringly each time**: first
`/*diag` = 37 ⇒ **559 "unexplained"**, which reads as *"most diagnostic tests assert nothing."* Widening
the vocabulary: `/*diag` 37 · `//CHECK` **386** · `.expected` 40 · none 196. Sampling that residual 196
dissolved it too — custom prefixes (`diag=CHECK_COUNT`, `CHECK_SUBSCRIPT`) and **indented** `//CHECK`
that a `^//\s*CHECK` anchor rejects. ⇒ **The residual bucket was an artifact of the pattern's
vocabulary, not a property of the corpus.**

⇒ ⭐⭐⭐**THE FAILURE SIGNATURE OF EVERY TRAP IN THIS FILE IS A PLAUSIBLE NUMBER, NEVER AN ERROR.** `255`
is a real exit code; `0` is a real count; `37` is arithmetically fine and semantically empty. Nothing in
the output says *"your vocabulary is short."* ⇒ **The only defence is a known-present control on the
SPECIFIC CHANNEL you are about to count** — not on the corpus, not on the tooling, on *that channel*.
Third instance in one day; [[command_grep_markdown_strip_emphasis_before_matching]] holds the other two.

⛔**And the failure is in the REASSURING direction:** "untested" licenses new work (write a test, add
coverage, cite a gap in a triage memo) rather than blocking it. A false *absence* of coverage produces
confident recommendations, which is why it survives — cf.
[[technique_keeping_this_store_reachable]] if filed, and the same shape
in [[command_grep_markdown_strip_emphasis_before_matching]].

## ⛔ The sharper failure: my census HELD the disconfirming hit and I dismissed it

Not "I failed to find it." I ran `grep -rl '30058\|dangling' tests/` and got **`tests_30058=1`** — a
**nonzero** result — glanced at the hit (`fp-literal-inf-forms.slang`), judged it irrelevant, and wrote
*"no test."* The `dangling` half of my own alternation was pointing at the answer.

Why the content-grep still couldn't land it, and this is the reusable part:
```bash
find tests/ -iname '*dangling*'                          # -> tests/diagnostics/dangling-comparison.slang
grep -c dangling tests/diagnostics/dangling-comparison.slang   # -> 0   (!!)
```
**The filename carries `dangling`; the file's contents do not.** So a content-grep for the concept
cannot see the file whose *name* advertises it.

⇒ ⭐⭐⭐**A census with even one unexplained hit is not a negative result — explain every hit, or the
zero you report is fabricated.** ⇒ ⭐⭐**When the pattern names a CONCEPT rather than a literal, search
names as well as contents** (`find -iname` beside `grep -r`); cf. the dotfile-glob miss in ANCHOR B,
same shape: one instrument silent about a whole class of object.

✅**The check:** grep the diagnostic's **message text** (from `slang-diagnostics.lua`), not its code.
```bash
# wrong for this repo:
grep -rl "E30058" tests/                      # -> 0, and means nothing
# right:
grep -rn "result of '==' not used" tests/      # -> the file that tests it
```
Get the message string from the `.lua` declaration first, then grep that.

## The bonus the inversion bought — an existing template

`tests/diagnostics/dangling-comparison.slang` (14 lines, read on my edge) is **structurally the exact
test both #12428 and #12433 need**:
```slang
//DIAGNOSTIC_TEST:SIMPLE(diag=diag):
    int a = 1;
    a == 2; // warn
/*diag:
      ^^ result of '==' not used
      ^^ result of '==' not used, did you intend '='?
*/
    (a == 2); // ok.        <- :13, the BOUNDARY cell
```
Diagnosing cell + parenthesised boundary cell, asserting by prose and caret — the shape recommended for
the new tests, already in-tree and already asserting the right way. ⇒ ⭐⭐**A false "untested" verdict
doesn't just add work, it hides a template**: the fixer would have written from scratch what exists at a
known path.

## Pairs with the exit-code trap from the same chain

The same #12433 test recommendation had a second defect: it asserted on **exit code**. `slangc`
collapses *every* failed compile to one value — `source/slangc/main.cpp:46`,
`res = SLANG_FAILED(res) ? SLANG_E_INTERNAL_FAIL : res;` (triager's read; my 4-cell measurement agrees:
undefined identifier → 255, syntax error → 255, ICE → 255, clean → 0). ⇒ **exit code is structurally
incapable of the distinction**, so the intended "already correct" boundary cell passes for the wrong
reason and asserts nothing.

⇒ ⭐⭐**BOTH defects are the same shape: an assertion keyed on a channel that does not carry the
property.** Exit code doesn't carry *which* failure; the E-code string doesn't carry *whether tested*.
Ask of any assertion or census: **does this channel actually vary with the thing I am claiming?**
Same family as [[feedback_an_identifier_that_does_not_distinguish_its_members]].

Chain: [[project_12428_bare_func_ref_silent_dropped_codegen]],
[[project_12433_bare_type_name_typetype_ice]].
