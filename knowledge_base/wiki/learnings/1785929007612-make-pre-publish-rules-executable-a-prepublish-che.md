---
title: "Make pre-publish rules executable — a prepublish-check.sh found a second overclaim that three careful re-reads missed"
type: learning
topic: verification
source: learnings/1785929007612-make-pre-publish-rules-executable-a-prepublish-che.md
---

# Make pre-publish rules executable — a prepublish-check.sh found a second overclaim that three careful re-reads missed

Rules about overclaiming fail in exactly the state where they're needed: right after you finish (or *correct*) an
artifact, when re-reading feels fine. The fix is to make each rule a **command you run**, not a note you remember.

**The evidence, from one GitHub comment, four passes:**
1. Careful re-read → shipped "**jointly necessary**" (a universal claim from 20- and 30-trial samples) and "**at
   ~1/400** unmodified runs" (a *rate* from **one** observed failure, on a build that gave 0/4000 separately).
2. Verb-only grep (`immune|deterministic|necessary|guarantees|unaffected`) → caught the verbs, **cleared the
   ratio**. `~1/400` contains no modal word, so a *correctly executed* verb sweep routes around it. A filter that
   filters nothing on the specific claim it was built for.
3. Verb+ratio grep → caught one `~1/400`; hand-fixed.
4. **Script** → found a **SECOND** `~1/400` in a different bullet that all three prior passes missed.

Every pass felt complete. Only the executed check was.

**Tool:** `/workspace/agent/prepublish-check.sh <file|->`, exit 0 clean / 1 = hits to justify or rescope
(advisory, and it *will* flag your own correctly-worded caveats — noise is the right trade). Pipe artifacts in
directly:
```bash
gh api repos/O/R/issues/comments/<id> --jq .body | ./prepublish-check.sh -
gh pr view <n> -R O/R --json body --jq .body | ./prepublish-check.sh -
```
Five predicates, each from a real defect shipped this session: **UNIVERSAL** (modal verbs from finite trials) ·
**RATIO** (bare `~N/M` — the one a verb scan misses) · **CI_GREEN** ("0 failures" ≠ green; `conclusion` is null
while a check runs) · **DONE** (done-ness with no named artifact) · **ELIMINATION** (rivals ruled out read as the
survivor confirmed).

**Two transferable points beyond the script:**
- **A bare `N/M` reads as a measurement rather than an assertion**, so it doesn't present as the kind of thing a
  scan looks for — same shape as searching `0xC0000005` when the log holds `3221225477`. The form carrying the
  claim isn't the form you'd search for. Extend scans to *quantitative* claims, not just modal ones.
- **A ratio inherited from a peer arrives looking pre-measured** even when the peer's own memo says it isn't a
  rate. A number is the least likely thing anyone re-derives. This one propagated from a fixer → me → my parent →
  the operator before anyone checked it. When relaying a figure, check whether it's load-bearing first.

Generalize: for any rule you agree on and intend to follow, write the runnable form immediately. An unexecutable
rule is a rule that fires only when a peer challenges you — and self-review reliably fails on the artifact you
just felt good about finishing.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785929007612-make-pre-publish-rules-executable-a-prepublish-che.md`_
