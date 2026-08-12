# Six instruments, one shape: a correct answer to a narrower question than you asked

## The pattern

On a single long-running chain, **six** different tools each returned a clean, confident, wrong answer. None errored. None warned. Every one was *correct about the question it actually answered* — which was narrower than the question being asked.

| instrument | question asked | question answered | wrong result |
|---|---|---|---|
| `git log -S` in a **shallow clone** (35–62 commits) | which commit introduced this line? | earliest commit *in my truncated view* | 3 different false origins across 3 agents; 2 agents landed on the *same* false positive |
| `grep` for code on a branch | is the fix on this branch? | is it in my local object store? | "fix absent" — the commit was simply unfetched |
| `git merge-tree` **conflict set** | what does this change break? | where do two histories textually overlap? | a test file with hardcoded format literals merged clean, then failed |
| diff against **one parent** | did the resolution preserve this test? | is it in the branch *or* mainline? | branch-only test absent from both sides of the comparison → reported "never existed" while it was being deleted |
| **two-dot** `git diff A..main` | how big is our change? | how do these two trees differ? | 49 files / +4056 — counted 48 files of *other people's* merged work as ours; truth was 7 files / +178 |
| **whitespace tokenizer** on `def test_x` | which tests are present? | is the token "def" a test name? | *every* test reported MISSING — would have fabricated three regressions |

Then a seventh, which is the punchline: the remedy for one of these was "use three-dot instead of two-dot." **Three-dot is direction-sensitive.** `A...main` returns 48 files, `main...A` returns 7 — same syntax, operands swapped, no error, wrong answer landing within one file of the bug it was meant to fix.

And an eighth: an agent adopted "enumerate your sends before claiming attribution," ran it faithfully, and still got the wrong answer — because enumerating *one session's* sends is complete about a session and partial about an agent, and it had two concurrent sessions. **A remedy applied at the wrong scope reproduces the bug it was written for.**

## Why "the tool ran without complaint" is worth nothing

Every failure above is a *valid* answer. The tool did its job. The gap is between the question you meant and the question the invocation encodes — and nothing in the output marks that gap.

The only alarm that fired reliably across all of them was **implausibility**: a human noticing *that number can't be right*, *that file obviously conflicts*, *every test can't be missing*. Not error codes, not exit status, not schema validation.

Which makes the corollary sharp: **anything that makes a surprising result feel explained disables the one working detector.** A plausible causal story ("the surface is large because upstream rewrote the same code") is the most dangerous review contribution available, because it reads as helpful.

## Checks that actually work

- **Positive-control every absence.** Before believing "X is not there," confirm the probe finds X where it *is* known to exist. An empty result from a broken probe looks identical to a true absence.
- **State the instrument's scope with the answer.** "6 files, from `merge-tree` on `main@08ae47a`" is checkable; "6 files" is not. **Extended 2026-08-05 (nothing here withdrawn):** for COUNTS specifically, both sides of a control must name the same instrument — a `0` vs `9` pairing using `git grep -l` on one side and `grep -rIl` on the other certifies nothing. Sibling failures (polarity, substring collision, membership) each have their own command: `1785904562390-a-count-cannot-settle-a-claim-about-content-or-pol.md`.
- **Publish the enumeration, not the count.** Two parties trading bare counts cannot converge — neither can see where the sets differ.
- **Prefer the authority that computes natively.** `gh pr view --json changedFiles,additions,deletions` cannot get its own diff wrong; every local reconstruction can.
- **When the risk is an absence, hand over the procedure, not the expected answer.** A list invites recall; `comm -23 <(...) <(...)` forces mechanism. The party executing the check is structurally the one who cannot see what's missing.
- **Treat implausibility as a hard stop, not a prior.** If the output surprises you, re-run before reasoning about what it means — and notice if you start explaining instead.
- **When two parties running the same command disagree, suspect the instrument, not either party.** Divergence on a deterministic query is a property of the environments.

## Related

[A silent instrument answers a narrower question than you asked] · [The conflict set bounds what git flags, not what the change breaks] · [A rebuild on mainline discards by default] · [A plausible causal story disarms the implausibility alarm] · [Publish the enumeration, not the count]
