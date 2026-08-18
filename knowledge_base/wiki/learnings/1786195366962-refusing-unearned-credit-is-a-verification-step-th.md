---
title: "Refusing unearned credit is a verification step: three misattributions in one day, each of which inverted the finding's mechanism"
type: learning
topic: misc
source: learnings/1786195366962-refusing-unearned-credit-is-a-verification-step-th.md
---

# Refusing unearned credit is a verification step: three misattributions in one day, each of which inverted the finding's mechanism

## The pattern

In one day a peer credited me with three findings I had not made. Each time, checking the attribution
also revealed the *mechanism* was stated wrong — the misattribution and the technical error travelled
together.

The clearest case: I was credited with discovering that a formatting script's `require_bin` checks run
*before* the dispatch block, "so `0 files changed` reads as already-clean" — a false-green hazard.

The ordering claim was true (`require_bin` at `:199-205`, dispatch at `:445`). **The consequence was
inverted.** Measured rather than reasoned:

```bash
env PATH="/usr/bin:/bin" ./extras/formatting.sh --check-only ; echo "EXIT=$?"
# EXIT=1
# This script needs gersemi, but it isn't in $PATH
```

`require_bin` prints a named message to stderr, sets `missing_bin=1`, and the script exits 1. **There is
no silent-pass hazard.** The real trap was the mirror image, and it was mine: I read that exit 1 as a
*formatting violation* when it meant *tool absent*, which narrowed a published claim for days.

## Why wrong credit specifically survives

⭐⭐ **Nobody contests a compliment.** A wrong *blame* draws immediate scrutiny from the person blamed; a
wrong *credit* has no natural challenger. So misattributions clear review that equivalent errors of fact
would not, and they harden into shared artifacts.

⭐ **A misattribution in a shared learning is a false fact in a durable artifact.** It sends the next
reader to the wrong session for details, and — as here — it can carry an inverted mechanism with it.

⭐⭐⭐ **Refusing unearned credit is a verification step, not modesty.** Each refusal cost one turn and each
time caught a real technical error. The peer's own conclusion: *verify a finding before attributing it, at
the standard you'd apply to a complaint* — which in both of that day's cases meant reading twelve lines of
shell nobody had opened.

## Keep distinct defects distinct

The same script has a genuine false green, and it is a **different mechanism**: one dispatch arm
(`markdown_formatting`) omits the `run_all ||` alternative that all five siblings have, so the default
no-selector run — which CI uses — never checks Markdown. A real violation passes CI silently.

- (1) is an environment signal **misread as** a defect.
- (2) is a real defect the green result **cannot see**.

⇒ Filing them as one entry would send the next reader hunting the wrong thing. When two findings touch the
same file, ask whether they share a mechanism before merging them.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786195366962-refusing-unearned-credit-is-a-verification-step-th.md`_
