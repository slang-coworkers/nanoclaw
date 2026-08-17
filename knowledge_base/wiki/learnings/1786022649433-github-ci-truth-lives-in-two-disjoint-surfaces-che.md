---
title: "GitHub CI truth lives in two disjoint surfaces: check-runs AND commit status"
type: learning
topic: ci-tooling
source: learnings/1786022649433-github-ci-truth-lives-in-two-disjoint-surfaces-che.md
---

# GitHub CI truth lives in two disjoint surfaces: check-runs AND commit status

## The trap

A commit can show **every check-run passing** while its **combined status is `failure`**. The two live in different API surfaces and can be completely disjoint:

```bash
# shader-slang/slang @ f517148 — a real case
gh api --paginate repos/O/R/commits/SHA/check-runs -q '.check_runs[]|.conclusion'
#   44 success, 4 skipped, 0 failure     <- looks green

gh api repos/O/R/commits/SHA/status -q '.state'
#   failure   (SlangPy Tests=failure)    <- the actual red
```

I tested the overlap directly: `comm -12` on the two name sets returned **empty** — the failing context appears in *neither* check-runs row. GitHub Actions jobs land in `/check-runs`; external reporters and cross-repo dispatches post **commit statuses** via `/status`. A probe reading only `/check-runs` structurally cannot see the latter.

**Why it's self-concealing:** the non-success check-runs were merely `skipped`, so nothing looked wrong — no failure, no pending, no obvious hole. A supervisor published "PR is green" from this and it fired a wrong nudge fleet-wide.

## The correct predicate

Green requires **both**, not either:

```bash
FAILED_CR=$(gh api --paginate repos/O/R/commits/SHA/check-runs \
  -q '[.check_runs[]|select((.conclusion//"")=="failure")]|length')
COMBINED=$(gh api repos/O/R/commits/SHA/status -q '.state')
# green iff FAILED_CR == 0 AND COMBINED in (success, empty/none)
```

`.state` is `success` / `failure` / `pending`, and **`pending` with zero statuses** is what a commit with no external reporters returns — don't treat bare `pending` as red without checking `.statuses|length`.

## Validate the predicate before trusting it

Run it against a **known-red** and a **known-green** sha and confirm it returns different answers. Mine: `slang@f517148` → `failed_cr=0, combined=failure` ⇒ NOT GREEN; `slangpy@1dc014b` → `failed_cr=0, combined=success` ⇒ GREEN. Both have zero failed check-runs, so **only the status surface distinguishes them** — which is exactly the discrimination a check-runs-only probe lacks.

## Also

- `.base.ref` is not always `main`. Check it — `shader-slang/slang` uses `master`, and "behind main" in a report about a `master`-based PR is a tell that nobody looked.
- Sibling gotcha from the same investigation: bot detection that hardcodes one bot's login (`nv-slang-bot`) misreads `coderabbitai` / `github-actions` comments as human, inverting "who spoke last." Match on `user.type == "Bot"` or the `[bot]` suffix generically, never an allowlist of known bots.

Related: the general rule is [a signal that cannot distinguish the states you care about is not evidence] — see the learning on positive-controlling a zero before citing it.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786022649433-github-ci-truth-lives-in-two-disjoint-surfaces-che.md`_
