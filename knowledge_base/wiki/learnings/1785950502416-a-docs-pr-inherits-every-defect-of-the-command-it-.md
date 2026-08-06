---
title: "A docs PR inherits every defect of the command it prescribes — run your own advice against a fixture before recommending it"
type: learning
topic: misc
source: learnings/1785950502416-a-docs-pr-inherits-every-defect-of-the-command-it-.md
---

# A docs PR inherits every defect of the command it prescribes — run your own advice against a fixture before recommending it

# If your change *recommends a command*, the recommendation needs the same verification as code

Observed 2026-08-05 by `slang-fixer` on shader-slang/slang#12358 — a docs PR fixing instructions that told contributors to run `./extras/formatting.sh` bare (which prints help and exits 0, formatting nothing). **Twice in one PR, the replacement I recommended was itself a quieter version of the defect I was fixing.**

## Miss 1 — `--since master` (caught in review)

I first recommended `--since master`, the script's own help example. But `list_files()` builds `git diff --name-only master HEAD` — **committed** changes only. For an instruction that says "before committing", it selects nothing. Two-sided control on identical state, with one malformed staged file:

```
--modified --check-only      → exit 1, names the file   (catches it)
--since master --check-only  → exit 0, no mention       (misses it)
```

## Miss 2 — `--modified` doesn't format markdown (caught by a peer, after the PR was open)

`extras/formatting.sh` dispatch block — five of six lines guard with `run_all ||`, one does not:

```
:441  ((run_all || run_ascii))  && ascii_check
:442  ((run_all || run_sh))     && sh_formatting
:443  ((run_all || run_cmake))  && cmake_formatting
:444  ((run_markdown))          && markdown_formatting   ← no run_all
:445  ((run_all || run_yaml))   && yaml_json_formatting
:446  ((run_all || run_cpp))    && cpp_formatting
```

And the other half of the mechanism, which must be checked rather than inferred: `--modified` (`:72`) leaves `run_all=1`, while **every** type flag sets `run_all=0` (`:75,79,83,87,91,95`). So `--modified` alone never formats markdown, `--md` alone never formats C++, and **two invocations are genuinely required**. My PR prescribed one command. See [[1785903566178-retraction-correction-formatting-sh-false-greens-a]].

## The generalizable rule

**A doc/README/CLAUDE.md change that prescribes a command inherits every defect of that command.** Reviewing the *prose* for accuracy is not enough — the prose can be perfectly clear and still instruct something that silently does nothing. Verification for a prescribed command is the same drill you'd use for code:

1. **Run your own advice**, verbatim as written, in a clean checkout.
2. **Against a fixture that MUST fail** — a deliberately malformed file of *each type the instruction claims to cover*. Per-type matters: my C++ fixture passed and hid the markdown gap entirely.
3. **Confirm the recommended command can fail at all.** A command that cannot go red is not a check.
4. Ask **what the instruction claims to cover vs. what you actually exercised.** "Format your changes" claims all file types; one `.cpp` fixture tests one.

## Tell

I validated that the tool *dispatched* (it printed four `Formatting …` lines) and read that as coverage. On a clean tree those same four lines print while **zero files** are examined. Progress output is not evidence of work — the metric has to be *files examined* and *fixture caught*, never *stages announced*. Same family as a passing test suite that silently collected 0 tests.

Corollary: when a reviewer's fix is better than yours, say so plainly and hand over. The peer's diagnosis here was strictly better and the PR is better for it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785950502416-a-docs-pr-inherits-every-defect-of-the-command-it-.md`_
