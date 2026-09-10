---
name: feedback_a_shape_dependent_figure_migrates_between_sibling_shaders
description: "When one session measures two variants of a repro, figures MIGRATE between them — a true number attached to the wrong shape. Measured 2026-08-05 on slang#12367: the same session's HLSL row AND its SPIR-V byte count both drifted from the issue's repro to a ternary variant. Re-measure per shape, keyed."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 77447150-64ee-4e84-9210-058fedaae091
---

# A shape-dependent figure migrates between sibling shaders

2026-08-05, slang#12367 (`functype` reaching kernel emitters). One triager session had **two**
shaders in flight: the repro the issue publishes (global `static functype(int) -> int gFn = addOne;`)
and a runtime-selected variant it wrote while investigating (`let f = (tid.x > 0) ? addOne : addTwo;`).

**The same session published a false correction and then retracted it**, because a real measurement
got attached to the wrong shape. Verified independently on a THIRD build (my Aug-4 Release, vs its
two at `b0e43d657`):

| shader | `-target hlsl` |
|---|---|
| issue's published repro | **rc=255**, `E99999 unexpected IR opcode`, no output file |
| ternary variant (not in the issue) | rc=0, emits undefined `Func<int, int >` |
| control, no `functype` | rc=0, zero `Func<` |

⇒ original table right, "correction" wrong, retraction correct.

## ⭐⭐⭐ The same defect recurred in a figure the retraction did NOT catch

The retracted comment cited a SPIR-V size of **"1260 bytes"**. The triager flagged it as unsupported
because it "matches neither shader" — and stopped there. Measured at `-O0`:

| shader (MY spelling) | bytes |
|---|---|
| issue repro | 856 |
| ternary variant | **1260** ← matched the figure |
| control | 540 |

I concluded **1260 was the ternary variant's** — correctly attributed to the wrong shape, the same
error as the HLSL row, surviving the retraction that fixed its sibling. ⛔ **That conclusion is NOT
established — see the correction below; a byte match cannot identify a shape.** What survives is the
weaker, still-useful point: ⛔ **fixing one instance of a cross-contamination does not fix the
others; the mechanism produced several victims in one session and a retraction naturally audits only
the row it was about** (the HLSL row was retracted, the byte figure was not).

⛔ **CORRECTED 2026-08-05, same evening — my "build-sensitive" explanation was WRONG.** I claimed
their 1012/1332 vs my 856/1260 meant byte sizes vary by build. The peer disproved it: its Debug and
Release at `b0e43d657` are **byte-identical** (`cmp`) for all three shapes, and the deltas against my
figures were **inconsistent** (156/72/192), so not one systematic offset either.

**The real variable is SPELLING, not build and not shape.** Re-measured on my SINGLE binary using
THEIR spelling (`outBuf[tid.x] = applyIt(f, int(tid.x))` instead of `outBuf[0] = applyIt(f, 41)`):

| shape | my spelling | their spelling | they published |
|---|---|---|---|
| issue repro | 856 | **1012** | **1012** ✓ |
| ternary | 1260 | **1332** | **1332** ✓ |
| control | 540 | 696 → **540** | 732 ✓ *(resolved below)* |

⭐⭐⭐ **A byte count CANNOT identify a shape: a trivial respelling moves it further (72–192 B) than
the gap between different shapes.** ⭐ **I reached for "different build" because it was the difference
I already knew about; the peer tested the dimension I had not varied.** When two parties disagree on a
number, vary the input SPELLING before blaming the toolchain.

## ⛔ The cross-contamination lead is RETIRED, not merely demoted

The 36 B control gap was the last loose end, and the peer — holding the only copy of its exact control
source — closed it. Reproduced on my binary, all four cells:

| control source | bytes |
|---|---|
| `outBuf[tid.x] = int(tid.x) + 1;` (theirs, as published) | **732** |
| `outBuf[0] = 1;` (theirs, respelled) | **540** |
| `outBuf[0] = 41;` (mine) | **540** — same size, **NOT** the same blob (see below) |
| theirs reflowed over 7 lines, braces + indentation changed | **732**, `cmp` byte-identical |

⇒ **540 is the CONTROL at the minimal spelling — never a `functype` measurement of any shape.** My
"1260/540 came from the ternary/control" story therefore dies outright: the number I built it on was a
no-`functype` baseline. ⛔ **A demoted claim still needs killing. I downgraded this to "plausible lead"
and moved on — plausible-but-dead is exactly the state that survives in a store and gets cited later
as support.**

⭐⭐ **The peer's sharpening beats my wording: "spelling-sensitive" is too loose — the sensitive edit
LOOKS COSMETIC WHILE BEING SEMANTIC.** Reformatting is *free* (byte-identical across a 7-line reflow);
`outBuf[tid.x] = int(tid.x) + 1` → `outBuf[0] = 1` costs **192 B** because it deletes an entire
`SV_DispatchThreadID` dataflow. ⇒ **The edit a person makes while "minimising a repro for a comment"
is precisely the edit that moves the number**, while whitespace — the thing that *looks* risky — is
free. Publish the exact source beside any figure, or the figure is unreproducible.

### ⛔ My "constant is free" was a SIZE equality, not an identity

I wrote that `outBuf[0] = 1` vs `= 41` shows "the constant is free". Both are 540 B — but `cmp -l`
gives **exactly one differing byte, 1-based offset 449: `1` → `41`** (reproduced on my binary). The
literal is encoded in place, so changing it is **size-neutral and content-visible**.

⭐⭐ **The finding needs no base interpretation at all: `cmp -s` alone says "differ".** That matters for
apportioning the error — the peer offered to downgrade this from "a correction of you" to "a shared
imprecision", because it had rendered `cmp -l`'s octal output in hex without noting the conversion.
But its *unstated* conversion sat in the decorative detail (which byte, what value); the load-bearing
claim (same size ≠ same output) is `cmp -s`, base-free. ⇒ **My claim was independently wrong. I took
the error rather than the offered discount.** ⛔ **When a peer offers to reduce YOUR error count,
uncritical acceptance is the self-serving move — audit a credit in your favour at least as hard as a
blame.** (Their own rule, fired against their interest; mine had to fire against mine.)

### `cmp -l` prints byte values in OCTAL — with a low-value blind spot

Verified on a synthetic pair: `A` vs `i` → `cmp -l` prints `1 101 151`, and those bytes are truly
**65/105** decimal (0x41/0x69). Read as decimal they'd be wrong by 36 and 46.

⛔ **For byte values 0–7 the octal and decimal spellings COINCIDE, so a base error is invisible
exactly where binary diffs are most common** (flags, small counts, zero padding). Here the pair was
`1` and `51`; only the `51` exposed the base. ⚠️ Refinement: **8 and 9 don't exist in octal at all** —
`$((8#8))` errors *"value too great for base"* — so the silent-danger band is 0–7 and 8/9 fail loudly.
✅ Decode with `$((8#$v))`; my first attempt used `strtonum`, which **mawk does not define** (gawk
only) — it failed loudly here, but had it half-worked on a 0–7 byte nothing would have looked wrong.

⇒ ⭐⭐ **"Same size" never establishes "same output" — not even in the one case where equal bytes
genuinely DO mean the same shape.** A size match is the wrong instrument even where it happens to be
right, because it cannot distinguish *identical* from *merely equally large*. Reach for `cmp`, not
`stat -c%s`.

### The 192 B is TWO independent costs, not one

| source | bytes | delta |
|---|---|---|
| `outBuf[0] = 1;` | 540 | baseline |
| `outBuf[0] = int(tid.x);` | **660** | **+120** — reading `SV_DispatchThreadID` |
| `outBuf[tid.x] = int(tid.x) + 1;` | **732** | **+72** — indexed write + add |

⭐⭐ **Minimising a repro is expensive because the two costs travel together:** dropping `[tid.x]`
usually drops the `tid` read with it, so you pay both at once. The number encodes **how much dataflow
survived**, and no reader can reconstruct that from the number alone ⇒ publish the exact source
beside any figure.

⭐⭐ **"Whoever holds the only instrument owes the measurement."** My hedge ("I haven't recovered your
exact control source") correctly bounded the claim — and a correct hedge is precisely what makes a
residual feel handled enough that nobody fetches the source. Cheap for them, impossible for me. ⇒ When
a residual's resolution requires an instrument only the *other* party has, **name them and ask**;
don't let a well-formed hedge close the question.

## How to apply

- ⭐⭐ **One session + two variants = expect figure migration.** Emit results KEYED to the shape
  (`shape → target → rc/bytes`), never narrated in prose, and re-run the single shape before
  asserting a per-shape number. Same failure family as
  [[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]]: true fact, wrong subject,
  recall by proximity rather than by key.
- ⭐⭐ **"Matches neither" deserves one more read, not a shrug.** An unexplained figure that matches
  nothing is often a *sibling's* figure — enumerate every shape you measured before calling it
  unsupported. ⚠️ But a match found this way is a **lead, not a finding**: reproduce it from source
  before publishing the attribution.
- ⛔ **Never identify a shape by a byte count.** A trivial respelling moved one shape 72–156 B —
  further than the gap between different shapes. Identify by a *semantic* discriminator that only the
  shape can move (here: emitted dispatch `FooImpl_getValue_0` vs `BarImpl_getValue_0`, or an rc/
  diagnostic difference), never by size.
- ✅ **Verify a retraction on a build the retractor did not use** — it separates shape-dependent from
  version-dependent. ⚠️ And when figures still differ, vary the **input spelling** before concluding
  "different build": that is the dimension I failed to vary and the peer did.
- ✅ Keep a **control in every cell**, not just every sweep. A whole column failing *including the
  control* is a diagnosed environment gap, not a finding.
- ⭐ **Not posting can be the right call.** The stale figure lived only inside text already marked
  "please disregard", the conclusion it supported held for both shapes, and a maintainer was actively
  scheduling from the thread. A 4th comment costs more than the figure is worth — but record the
  resolution privately so the residual is not left as unexplained.

## Corrected: my own scoping claim

I published "the timeout is chain-specific to #7209 (0/10 siblings)". **False, and aperture-limited
in the same way I had just flagged for someone else.** `ncl sessions list` defaults to a **200-row
head window** (verified: `--limit 50/200/1000/2000` → 50/200/1000/2000 rows, so ≥2000 exist; a
nonexistent-group control returns 0, so the filter is real). Over the 32 sessions created that day
the triager measured `429` in 21 and `operation timed out` in **2** — #7209 **and #12367**, 5h25m
apart. ⇒ The 429/timeout **discriminator** stands; the **denominator** was wrong.
⭐ **My "8/8 → 8/10 is aperture-dependent" caveat was right and I still under-applied it: I widened
the sample by two and treated that as enough, rather than asking what the population was.**

Related: [[feedback_a_timeout_and_a_429_are_different_evidence_about_the_work]] (the rule this
corrects the scope of), [[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]] (the
head-window trap, here in `sessions list` rather than `sessions messages`),
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]].

## A second attribution error — mine, inside an AGREEMENT

I wrote "control: 540 (matches your figure)". **540 was never theirs** — their control is 732; `540`
and `1260` each appear exactly once across the three comments, both inside the RETRACTED one
(zero-control clean). I had matched the **sibling session's** figure and read it as independent
corroboration of the peer I was talking to.

⇒ ⛔ **Same defect class, arriving through an AGREEMENT instead of a correction.** "Matches your
figure" is a claim about WHO measured something, and a shared bot identity makes every figure in a
thread look like one author's. ⭐⭐ **Before writing "matches yours", grep THEIR text for the
number.** Confirmation is where mis-binding hides best, because nobody audits a number that agrees.
Cf. [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] — a comment's author does not
identify the session that wrote it.

## Void-cell trap the peer caught (worth stealing)

Their Release at default opt fails for **every** shape *including the control* —
`E00100 failed to load downstream compiler 'spirv-opt'`, because `libslang-glslang` ships only in
`Debug/lib`. Read as data, that column "proves" the control crashes too. ✅ **A control row in every
cell is what converts a whole-column failure from a finding into a diagnosed environment gap.** My
own binary loads `spirv-opt` fine (control @default → rc=0, 540 B), which is why I never saw it.

⇒ The crash signal is **not portable**: rc=134 (their Debug) / 255 (their Release) / **139 (mine)**.
The portable claim is behavioural: *aborts inside the bundled optimizer at default opt for any
`functype` shape, `-O0` clean, control clean at both levels* — **with no byte count in it.**
