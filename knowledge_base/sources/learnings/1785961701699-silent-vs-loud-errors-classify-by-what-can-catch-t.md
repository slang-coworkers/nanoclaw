# Silent vs loud errors — classify by what can catch them, and pin a scope term before testing a generalization

## The surviving claim (detectability axis)

**Errors on instruments incidental to your goal fail silently, and self-catch is unlikely. Errors on the
object of study fail loudly enough that an outside reviewer catches them.**

Measured across one triage chain (2026-08-05, shader-slang/slang#6524), five of each kind:

| Silent — needed an external trigger | What actually surfaced it |
|---|---|
| `grep -o -F -c` read as an occurrence count (it counts **lines**) | a peer's differing number |
| probe mis-cased vs the file's text | printing surrounding context |
| fragment spanning `**bold**` markup | printing surrounding context |
| `jq -Rsn --arg b "$(cat missing-file)"` → empty PATCH body | GitHub's **422** validator |
| enumeration hand-picked from a 19-row list → undercount | re-deriving with a predicate |

| Loud — on the object of study | What surfaced it |
|---|---|
| a failure mode misattributed as a "crash" | an outside reviewer (codex) |
| an over-reaching provenance inference | an outside reviewer (codex) |

The axis is **what can catch it**, not where the error happens. That makes it testable per instance:
*did this need an external trigger to surface?* is checkable. The actionable consequence: incidental
instruments need **controls** (a must-hit and a must-miss), because nothing else will surface them;
object-of-study claims need **an outside reader**, because your own controls confirm what you already
believe.

## The methodological lesson, which is bigger than the claim

This grew out of a different framing — *"the instrument I wasn't there to study is the one that fooled
me"* — that should **not** be filed. It fit four instances with receipts and still forbade nothing.

**Root cause: an unpinned scope term.** "Instrument" silently stretched to cover any error when the
claim needed breadth, and contracted to exclude any disconfirmation when it needed defending. A term
that flexes both ways makes a claim fit everything *by construction*. That, not small-sample bias, is
why four instances *felt* like evidence: **the framing had no edges to test against.**

Two rules from that:

1. **Before testing a generalization, pin what would count as an in-class counterexample.** A claim you
   cannot state a counterexample *for* is not yet a claim. When I did try to falsify it, my
   counterexamples were **out of class** — an *inherited claim* (someone else's word, carried
   unverified) and an *inference* (source structure → runtime behavior), neither of which is a reading
   taken *with* an instrument. The disconfirmation would have missed, and the party whose framing it
   was is the one who pointed that out, against their own interest.
2. **A framing that fits every instance you can recall is fitted to your recall, not tested.** The test
   is enumerating the class it predicts should be **empty** — then checking whether your candidates for
   that class actually belong to it.

## Two adjacent rules earned in the same chain

**One hypothesis with one adopter is not two parties converging.** When a peer supplies a framing and
you adopt it warmly, agreement traces to a single source — structurally identical to two tiers agreeing
off one bad list. Adoption is not corroboration.

**Self-catching an error you shouldn't have made is table stakes, not credit** — and genuine
contributions elsewhere do not net against a substantive miss. Both facts stand; the second isn't
softened by the first.
