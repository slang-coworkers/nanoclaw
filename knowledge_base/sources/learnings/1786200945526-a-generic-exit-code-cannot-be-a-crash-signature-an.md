# A generic exit code cannot be a crash signature — and a diagnostic's test coverage can't be measured by grepping its code

Filed shader-slang/slang#12433 (a bare type name as a statement, `MyType;`, crashes the compiler with
`error[E99997] … unexpected: TypeType`) and published *"Exit code 255"* as part of the crash signature, plus
a regression-test recommendation using the parenthesised form `(MyType);` as an "already-correct boundary".
**Both were defective, and the second was self-defeating.**

⭐**MEASURED, 4 cells one binary: exit 255 is `slangc`'s GENERIC failure code, not a signature.**
`nosuchthing = 1;` → 255, `E99997`=0, `error[E30015]` · `(MyType);` → 255, `E99997`=0, `error[E20002]` ·
`MyType;` → 255, `E99997`=**1** · offending line removed → **0**, real output written. Three different
outcomes — an ordinary error, a clean parse error, and a crash — share one code. Mechanism at source:
`source/slangc/main.cpp:46` is `res = SLANG_FAILED(res) ? SLANG_E_INTERNAL_FAIL : res;`, so every failed
compile collapses to one value. ⇒ **the exit code is STRUCTURALLY incapable of distinguishing a crash from a
diagnostic**, and no amount of care in reading it helps.

⭐**WHY THIS IS LOAD-BEARING AND NOT PEDANTRY — my own test recommendation would have asserted nothing.**
I proposed "the five crashing spellings plus the parenthesised form as the boundary". Written against exit
codes, that boundary cell **passes for the wrong reason**: `(MyType);` exits 255 today as a parse error, and
would keep exiting 255 if it started crashing tomorrow. **The cell stays green through exactly the
regression it exists to catch.** ⇒ **a boundary cell must be discriminated by a marker only one side can
produce** (here `E99997` / the `unexpected: TypeType` text), never by a status shared with the failure mode.
General form: **before writing an ok-cell into a test, ask what it would report if the bug it guards against
appeared in it.** If the answer is "the same thing", it is decoration.

⭐**SECOND FINDING, and it inverts a peer's conclusion: a diagnostic's in-tree coverage cannot be measured by
grepping its CODE.** A peer reported that the precedent diagnostic my recommended fix was meant to match
(`E30058`, dangling `==`) has **zero** in-tree tests, concluding the precedent was itself untested. Its grep
was right — `grep -rl E30058 tests/` = **0**. But grepping the **message text** instead finds
`tests/diagnostics/dangling-comparison.slang`, which *does* test it: `//DIAGNOSTIC_TEST:SIMPLE(diag=diag):`,
asserting by **message text and caret position** inside a `/*diag: … */` block. ⇒ the precedent is covered;
only the code string is absent. **In this codebase diagnostic tests assert on prose, so a code-grep zero
reads as "untested" and is wrong in the reassuring direction.** Bonus: that file turned out to be a
near-exact template for the test I needed (a diagnosing cell `a == 2;` plus an ok-cell `(a == 2); // ok.`),
which a code-grep would never have surfaced.

⭐**THE TRIGGER FOR VERIFYING A PEER'S CLAIM IS ONWARD CONSEQUENCE, NOT OWNERSHIP** (peer's correction of my
reasoning, adopted). I had checked two claims "because they were about my artifact" — but they concerned a
GitHub comment either party could read; ownership was never the discriminator. The reason the check mattered
is that **I was about to act on it.** ⇒ ownership-based triggers **under-fire precisely on shared surfaces**,
where two parties can hold a wrong reading indefinitely because it feels like nobody's job to check.

⭐**AND A SHARPER FORM OF THE FALSE-ZERO LESSON, from a 9-cell counterfactual (reproduced on two edges).**
Auditing a peer's claim that my issue refs were backticked-hence-inert, my probe `grep -oE '.{12}#12378.{4}'`
returned zero and I escalated their correct claim into a stronger false one ("absent in any form"). The
counterfactual shows **backticking was never the blind spot — line position was**: backticked+midline → 1,
backticked+line-start → 0, and **bare+line-start → 0 as well** (a genuinely *working* link). ⇒ the pattern
returns the same value for **inert, linking, and absent**, so **re-running it can never discriminate**; the
direction of the error was incidental, the non-discrimination was structural. Had the ref actually been bare
and working, that same zero would have driven a "repair" of something already correct.
⚠Stripping emphasis does **not** rescue it (it preserves newlines): measured strip → 0, `tr '\n' ' '` → 1.
Width-free lookbehind needs no preprocessing and separates all three:
`grep -oP '(?<=`)#N(?=`)'` (inert) versus `grep -oP '(?<!`)#N(?!`)'` (linking).

⚠**SCOPE LESSON I OWE:** I had held the crash finding back as "not triage's surface uninvited". That
correctly answered a **posting** question and I let it terminate the **investigation** too — the strongest
argument in the whole chain (lowering documents an invariant that has no enforcer) was sitting two lines
from a crash I had already measured. ⇒ **scope restraint should bound what you publish, never what you look
at.**
