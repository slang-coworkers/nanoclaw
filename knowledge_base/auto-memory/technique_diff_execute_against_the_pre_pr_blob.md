---
name: technique_diff_execute_against_the_pre_pr_blob
description: "For a PR that rewrites a heuristic, fetch the pre-PR blob and run BOTH versions on the same inputs — introduced regressions are invisible to reading because the new code is self-consistent. Then prevalence-check before assigning severity."
metadata: 
  node_type: memory
  type: technique
  originSessionId: 5fec3d9a-41d7-403a-ba6e-6378ba6f1820
---

# Differential execution: the old version is the oracle

When a PR **rewrites a heuristic** (regex, window, scoring, parser, classifier), reading the new
code cannot find what it broke. The new code is *self-consistent* — its tests pass, its comments
explain its own logic, and every branch reads as deliberate. The information about what changed
lives only in the **difference** between the two versions' behavior on identical inputs.

```bash
# head blob (the PR)
gh api "repos/$REPO/contents/$PATH?ref=$HEAD_SHA" --jq .content | base64 -d > new.py
# pre-PR blob (the oracle)
gh api "repos/$REPO/contents/$PATH?ref=$BASE_BRANCH" --jq .content | base64 -d > old.py
```

Then load both and table them on the same inputs:

```python
import importlib.util
def load(p, n):
    s = importlib.util.spec_from_file_location(n, p)
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
new, old = load("new.py", "new"), load("old.py", "old")
for label, inp in cases.items():
    o, n = old.f(inp), new.f(inp)
    print(f"{label:32s} {str(o):>16s} {str(n):>16s} {'*** LOST' if o and not n else ''}")
```

⭐⭐⭐ **A cell where old finds something and new finds nothing is an introduced regression, and it
is not derivable from reading either file.** Measured on nanoclaw#1107: two body shapes
(`Caused by:` + blank + list, `Root cause:` + blank + para) went `[12345,12346] → []` and
`[12345] → []` while the shapes the PR's own tests covered stayed green.

## Generating the case table: vary the axis the tests don't

The PR's tests define the axes the author already thought about. Findings live on the axis they
*didn't* vary. On #1107 the passing test (`## Cause` + blank + para) and the failing shape
(`Caused by:` + blank + list) differ **only** by whether punctuation sits between the marker and the
newline — so enumerate the punctuation/whitespace/heading-style variants of each passing case.
⭐⭐ **When a passing case and a failing case differ by one character class, that character class is
the untested axis — sweep it.**

## Then prevalence-check before assigning severity

A reproduced defect is not yet a severity. Run the *real* corpus through it:

```python
issues = fetch_real_corpus()          # e.g. 85 real labelled issues
hits = sum(1 for i in issues if hits_the_broken_shape(i))
```

On #1107 both findings dropped 🔴→🟡 on measurement — 0 of 85 real issues hit the degenerate
window, and the max real filed-vs-merged lag was 1 month against a 12-month window. ⭐⭐⭐ **The
same defect is a blocking finding or a nit depending entirely on a number you have to go get; a
review that reports the mechanism without the prevalence is asking the author to prioritize
blind.** Publishing "latent, 0/85 today, fix anyway because the shape is common Markdown" is both
more accurate and more actionable than 🔴.

## Close the loop: verify the proposed fix against THEIR suite

Patch a scratch copy, run the PR's own tests unchanged. A fix that passes all N existing tests is a
patch the author can take in one paste; a fix you didn't run is a suggestion they have to validate
themselves. On #1107 the candidate `lstrip(" \t:-—.)")` skip passed all 27.

Related: [[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_never_read_an_exit_status_through_a_pipe]] (bit me in this very review — `| tail` ate the
RC and nearly produced a false 🔴 on the PR's central claim),
[[project_nanoclaw_1107_regression_quality_cohort]], [[project_nanoclaw_1078_regression_quality]].
