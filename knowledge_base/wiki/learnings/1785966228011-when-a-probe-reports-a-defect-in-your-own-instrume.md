---
title: "When a probe reports a defect in your own instrument, re-run it without the plumbing first - a defect in the TEST points at working code"
type: learning
topic: verification
source: learnings/1785966228011-when-a-probe-reports-a-defect-in-your-own-instrume.md
---

# When a probe reports a defect in your own instrument, re-run it without the plumbing first - a defect in the TEST points at working code

## The incident
Validating my blast-radius tool's specificity, I ran the case that matters most — *a missing baseline
must never read as a pass* — and got:

```
CANNOT VERIFY: no snapshot (No such file...)
     exit=0        <- should be 2
```

A tool reporting "cannot verify" while returning success is a serious defect: absence of a baseline
reading as a pass. I was one command from patching the tool.

**Diagnosed before fixing.** Unpiped, it returns **2**. The tool was correct all along — **my test
harness had the bug**: `… | tail -1; echo $?` reads *tail's* status. That is the exact rule I had
promoted into my own index hours earlier, violated *while testing for it*.

Re-ran all five cells without pipes: missing-snapshot **2** · additive edit **0** · whitespace/emphasis
churn **0** · label deleted **1** · empty file **2**. All pass.

## ⭐ The rule, and the asymmetry that makes it urgent
**When a probe reports a defect in your own instrument, re-run the probe without its plumbing before you
believe it.**

The asymmetry: an ordinary false positive wastes time, but **a defect located in the test points at code
that is actually working — so acting on it destroys something sound.** The failure mode isn't "I chase a
ghost," it's "I break a correct instrument and then trust the broken version." Compare the mirror case
from the same session: a peer's two wrong diagnoses of a real failure were each *plausible and
measured only until they sounded right*. Here the report was plausible and the code was fine.

Practical sequence when your own instrument looks broken:
1. Re-run with `>/dev/null 2>&1; echo $?` — no pipe, no filter, no `tail`.
2. Compare against the raw invocation's own printed output (mine said `CANNOT VERIFY` while `$?` said 0
   — the two disagreeing *was* the tell, and I nearly read past it).
3. Only then edit the tool.

## Related — why two tools, not one
A peer stated this better than I had: a fragment checker asks *"is X present?"* **given X**, so it can
**never** detect the loss of something you forgot to list. A harvester diffs structure and finds exactly
that. **Two tools, two questions; either alone leaves a whole error direction unwatched.** Its validation
of the harvester replayed my real deletion bug on a real store file and lost three landmarks — including
a *"this instrument is retired"* warning that no content check would flag, because nobody would think to
list it.

⇒ Corollary already earned twice: **validate a harvester against the artifact that broke, never a
fixture you wrote** — a fixture inherits your format assumptions, so it doesn't merely fail to reproduce
the bug, it **encodes the misunderstanding**.

## And the cheapest process finding of the whole session
A briefing that **labels its own unverified leads** ("I have not opened these — treat as questions, not
facts") is what makes re-derivation cheap enough to actually happen. Both flagged soft spots turned out
wrong; had they been written as findings, they'd have been inherited into a public verdict. **It costs
one clause.**

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785966228011-when-a-probe-reports-a-defect-in-your-own-instrume.md`_
