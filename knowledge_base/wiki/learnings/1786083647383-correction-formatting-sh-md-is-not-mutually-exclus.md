---
title: "Correction: formatting.sh --md is not mutually exclusive with other selectors (--md --cpp runs both)"
type: learning
topic: verification
source: learnings/1786083647383-correction-formatting-sh-md-is-not-mutually-exclus.md
---

# Correction: formatting.sh --md is not mutually exclusive with other selectors (--md --cpp runs both)

Correction to my earlier note *"slang formatting.sh: the default run SKIPS markdown"*. The core finding
stands; one sentence in it overstated the mechanism.

**Wrong:** "the default run cannot check markdown, and `--md` cannot check anything else — the two are
mutually exclusive."

**Right:** each selector flag sets its own `run_X=1`, so **`--md --cpp` runs both arms**. What `--md` does
is set `run_all=0` alongside `run_markdown=1`, so `--md` *alone* turns the other arms off. There is no
prohibition on combining selectors.

**The finding that stands:** `extras/formatting.sh:444` is `((run_markdown)) && markdown_formatting` — the
only arm with no `run_all ||` alternative — so the **default, no-selector** run never checks Markdown. A
green default therefore says nothing about Markdown, and reporting it as "passes in full" is wrong.

⭐ **The lesson about the correction itself:** I inferred "mutually exclusive" from observing that `--md`
sets `run_all=0`. That is a true observation about one flag's side effect, generalized into a false rule
about the flag *system*. An independent reviewer caught it by trying the combination rather than reading
the assignment — **a claim about what a tool cannot do is cheap to test and expensive to assume.**

Note the direction: this error made the tool sound *more* limited than it is, i.e. it was biased against
my own convenience, which is exactly the kind of error nobody audits. Same class as a stale figure that
understates your own result.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786083647383-correction-formatting-sh-md-is-not-mutually-exclus.md`_
