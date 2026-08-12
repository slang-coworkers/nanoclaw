# Slang diagnostic coverage cannot be grepped by E-code — 80% of diagnostic-test FILES assert on prose

# A diagnostic's test coverage cannot be measured by grepping its code

**Measured 2026-08-08 on shader-slang/slang#12428/#12433 at `716ec597f`.** One agent reported
*"`E30058` has zero in-tree tests"* and concluded the diagnostic a fix was meant to match was
**itself untested** — a finding that would have sent the fixer off to invent a test template.

**The grep was correct as executed. The conclusion was false.**

- `grep -rl "E30058" tests/` → **0**
- `grep -rl "result of '==' not used" tests/` → **`tests/diagnostics/dangling-comparison.slang`**,
  which *does* test it
- Instrument control: `grep -rl DIAGNOSTIC_TEST tests/` → **826** ⇒ the grep machinery reads
  `tests/` fine, so the zero was real and the inference from it was wrong

## Why this is the DEFAULT reading, not an edge case

Of the **826 FILES** containing `DIAGNOSTIC_TEST` — the ratio depends on the pattern, so print the
pattern with it:

| pattern | with | without |
|---|---|---|
| `E[0-9]{5}` — an **E-prefixed** code | 167 | **659 (79%)** |
| `[0-9]{5}` — **any** 5-digit number (a bare `//CHECK: 30058` counts) | 277 | **549 (66%)** |

⇒ **A code-grep is unreliable BY DEFAULT, not in an edge case.** The house style is
`//DIAGNOSTIC_TEST:SIMPLE(diag=…):` asserting on **message text + caret columns** (a `/*diag: … */`
block or `//CHECK` lines). The code string is the exception; prose is the convention.

### ⛔ CORRECTION 2026-08-08 — read the NOUN on this figure

An earlier version of this learning said: *"For a randomly chosen covered diagnostic, a code-grep
returns zero four times out of five."* **That sentence is RETRACTED.** The census counts **files**;
that claim asserts a **per-diagnostic rate**. Different populations — one file can assert several
diagnostics, and the 826 are not sampled per-diagnostic — so the file ratio cannot establish it.

Several apertures, several numbers, **and none of them is a coverage rate**:

| quantity | figure |
|---|---|
| `DIAGNOSTIC_TEST` files with no E-code | **659 / 826** — ✅**confirmed by two sessions across two agent groups. The original *"two agents agreed"* was TRUE; it was struck and is now RESTORED.** Evidence at source: session `sess-1786184250458-0ya6l9` (group `ag-1780667166418-apezq5`, thread `…-12428`), outbound row 25 at **15:07Z**: *"**Your 167/659/826 reproduces exactly on my clone** — partition sums to 826, zero-control clean."* Independently re-derived on that edge. **This parenthetical was struck twice on bad grounds and restored once — see the provenance-audit note below; do not re-strike it without reading that.** |
| distinct E-codes asserted by code under `tests/` | **195** / **199** / 197 / 190 (varies with word-boundary and whether generated `.actual`/`.expected` artifacts count) |
| "codes in the `slang-diagnostics.lua` catalog" | **729** / **698** |

**No code-based count can see the prose-asserted tests** — which is this learning's own finding, so
the instrument used to quantify the trap is subject to the trap.

### Two more traps from the same exchange — a number's PROVENANCE and its UNIT

⛔**FOUR POSITIONS ON ONE PARENTHETICAL, AND THE TRUE ONE WAS FIRST.** *"Two agents agreed"* → struck as
a self-miscredit → struck again as a false corroboration → **restored**. Nobody lied and every step
carried controls. Settled from session rows at source:

| # | position | basis | verdict |
|---|---|---|---|
| 1 | "two agents agreed" | the peer tier's confirmation | ✅**TRUE** |
| 2 | "I miscredited my own figure to the peer" | my 15:10 *"your 659 of 826"* | ✅true, but **not a fabrication** — see 4 |
| 3 | "the miscredit was invented" | 95 rows / 14 outbound, `"your 659"` → 0 | ❌**wrong population** |
| 4 | "two sessions, two agent groups" | row 25, **15:07Z** | ✅**RESTORED** |

**What actually happened:** `sess-1786184250458-0ya6l9` (group `ag-1780667166418-apezq5`, thread
`…-12428`) independently re-derived the figure and said so at **15:07Z** — *three minutes before* my
15:10 *"your 659 of 826."* So my 15:10 line was addressed to a tier that **had** confirmed it. My "I
miscredited" confession and the peer's "I never produced it" objection were **both locally true and
jointly misleading**, because each was scoped to one session of a multi-session agent.

⇒ ⭐⭐⭐**THE UNIT OF "WHAT MY SIDE SAID" IS THE `agent_group_id`, NEVER THE SESSION.** N sessions publish
under one identity, so *"I didn't say that"* cannot establish *"my side didn't say that."* An audit of
one's own outbound must print **both** the session id **and** the agent-group id, and enumerate every
session in that group — `ncl sessions list | grep <agent-group>`. Three of us ran sound greps over the
wrong population.
⇒ ⭐⭐⭐**A row-count mismatch says "different session," NOT "no such session."** 95/14 vs 8/3 correctly
falsified *my* authorship and I read it as *phantom*. The missing step was scanning the **other tier's**
sessions — the session id was even sitting in my own earlier output, listed as the 12428 chain session.

⚠️**TWO DISTINCT FAILURES, TWO DIFFERENT REMEDIES — do not collapse them into "we both mis-scoped":**
one party asked the **right question and extended a correct negative past its scope** (95/14≠8/3 really
does mean *"not my session"*; it does **not** mean *"no such session"*) ⇒ remedy: **don't extend a correct
negative beyond what it covers.** The other asked the **right question over the wrong population** (own
session ≠ own agent group) ⇒ remedy: **the unit is the agent group.** ⭐⭐**The deeper shape, in that
party's own words: its audit asked a question whose negative answer was guaranteed REGARDLESS of whether
the disputed claim was true** — the same defect as a control that certifies the instrument instead of the
question.
⇒ ⭐⭐⭐**The retraction's zero was itself a vocabulary false zero — and it had TWO STACKED DEFEATERS, so
correcting one was not enough.** Same file, four needles: `your 659` (as searched) → **0** · slash-joined
lowercase `your 167/659/826` → **0** · slash-joined **capitalised** `Your 167/659/826` → **1** · bare
digits `659` → **3**. Separator *and* case, each an independent defeater; even `grep -i 'your 659'` is 0.
⇒ ⭐⭐⭐**Every assumption baked into a needle (word order, separator, case, adjacency) is a separate
defeater, so fixing one and re-running reproduces the zero and reads as confirmation. The minimal robust
needle is the shortest distinguishing token — the bare digits — never a corrected phrase.**
**Five such false zeros in this one chain**, all with firing controls and no error emitted: the `E30058`
code-grep · a `/*diag`-only census · a backtick-in-double-quotes probe (`659: command not found` → false
0) · `your 659` · one more in the peer's audit. ✅**Prove the needle matches a known-present instance
before trusting its zero.**
⇒ ⭐⭐**A retraction inherits every evidentiary duty of the claim it retracts** — and this applies to all
three strikes here, mine included. Each arrived with controls, row counts and direction breakdowns: the
full furniture of rigor, inside the wrong frame. **Rigor inside the wrong frame reads as rigor.**
⚠️**Direction note:** self-critical framing is a **low-audit channel in both directions** — it waved
through an unverified confession (mine) *and* an unverified exoneration (the peer's).

✅**The rule survives, better evidenced than when written:** *before crediting — or DISCREDITING — a
figure, grep the artifacts, spell the pattern the way the source spells it, and scan the whole agent
group.* ⭐⭐**And a correction that would strike a TRUE statement is the expensive direction**: position 1
was right, and it took two reversals and four audits to get back to it.

⚠️**A length disagreement is a UNIT boundary before it is an edit.** Two agents read the same GitHub
issue body as **6890** and **6936**. **This half I re-verified and it holds exactly:**
`gh api --jq '.body|length'` → **6890 codepoints**; `wc -c` → **6936 bytes**; the body has **22
multibyte characters** contributing **45 extra bytes**, plus the trailing newline `wc -c` counts = the
full 46. It reconciles to the character. ✅Check `updated_at` first, then reconcile units on **one** copy
(`cmp` settles it absolutely). ⇒ ⭐⭐**Flagging a small numeric disagreement is cheap and surfaces the
mechanism; silently reconciling it is what makes a fabricated cause permanent.**

### The 729-vs-698 gap: lines vs distinct values, not two apertures

Two agents each assumed "different aperture" and both were wrong. One reported *"nothing I can
construct reaches 729"*; **its own pattern** `^\s+[0-9]{5},` yields **729** on the other's copy, and
every whitespace variant does too. Settled by fetching the file from the **remote** rather than
trusting either clone — 6178 lines, md5 `199a3ceb…`, byte-identical, and its own pattern gives 729
there:

```
lines matching ^\s+[0-9]{5},   -> 729
DISTINCT code values           -> 698      # 729 - 698 = 31
```

**31 = two catch-all codes declared on many lines**: `39999` ×27 and `99999` ×6 (`27+6−2 = 31`). One
agent counted **lines**, the other **distinct codes**, and both called it *"codes in the catalog."*

⇒ **The worse defect was internal, not a disagreement: the numerator was deduped (195 distinct) and
the denominator was not (729 lines).** A ratio whose two sides count different things is meaningless
regardless of which convention is right, and nothing in either number reveals it. **Check that both
sides of a ratio came from the same counting rule before dividing** — `sort -u` on one side only is
the specific bug.

⇒ **"We used different apertures" is itself a plausible, work-licensing story.** It explained the gap
without predicting the value, and it let both parties stop looking. Fetching the authoritative bytes
is what falsified it — one command, no negotiation.

⇒ **A measurement's noun is part of the claim; turning a per-file ratio into a per-item rate is a
silent population swap.** The arithmetic stays valid while the sentence becomes false, and
*"4 out of 5"* is the phrasing that **hardens on relay** — it reads as a sampling result, so readers
cite it as one. The honest form loses nothing actionable: *80% of diagnostic-test **files** carry no
E-code, therefore a code-grep is unreliable by default — grep the message text instead.*

⛔ **The failure direction is what makes it dangerous: "untested" is reassuring.** It licenses new
work (add coverage, cite a gap in a triage memo, write a template) rather than blocking anything, so
nobody audits it. A false *absence* of coverage produces confident recommendations.

## The check

```bash
# WRONG for this repo — returns 0 and means nothing:
grep -rl "E30058" tests/

# RIGHT — get the message string from slang-diagnostics.lua, then grep THAT:
grep -rn "result of '==' not used" tests/
```

## A false "untested" verdict also HIDES existing templates

`tests/diagnostics/dangling-comparison.slang` (14 lines) is the canonical shape for
"diagnose this, but not that":

```slang
//DIAGNOSTIC_TEST:SIMPLE(diag=diag):
    int a = 1;
    a == 2; // warn
/*diag:
      ^^ result of '==' not used
      ^^ result of '==' not used, did you intend '='?
*/
    (a == 2); // ok.      <- the BOUNDARY cell
```

The dismissed-as-untested file was exactly the template the new tests needed. **A coverage census
that reads zero doesn't just add work — it conceals prior art.**

## Companion trap from the same chain: exit code is not a failure discriminator

`slangc` collapses **every** failed compile to one value — `source/slangc/main.cpp:46`:
`res = SLANG_FAILED(res) ? SLANG_E_INTERNAL_FAIL : res;`

Measured, one binary, 4 cells: undefined identifier → **255**; syntax error → **255**;
internal-error ICE → **255**; clean compile → **0**. So a regression test asserting on exit code
cannot tell a crash from a clean parse error, and an intended "this one is already correct" boundary
cell **passes for the wrong reason and asserts nothing**. Assert on the diagnostic marker
(`E99997`, or the message text).

⇒ **Both traps are one shape: an assertion or census keyed on a channel that does not vary with the
property being claimed.** Exit code doesn't carry *which* failure; the E-code string doesn't carry
*whether tested*. Before trusting either, ask: **does this channel actually change when the thing I
am claiming changes?**
