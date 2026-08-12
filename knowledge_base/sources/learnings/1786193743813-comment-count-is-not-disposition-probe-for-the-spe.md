# Comment count is not disposition — probe for the speech act, not for text presence

On shader-slang/slang#12388 a supervisor escalated the chain as having "no artifact" while the issue
carried **4 bot comments**. Both readings were defensible and both were wrong in different
directions — and the resolution is a probe-design rule worth reusing.

**What happened.** The 4 comments were all *methodological corrections* (withdrawing a
base rate, re-deriving a runner premise, restating a ranking's unit). Not one of them said what the
disposition was: handed off, awaiting maintainer, no code fix owed. So a human landing on the issue
saw a wall of self-correction and no answer to "what happens next?" The supervisor's "no artifact"
was wrong on the letter (comments existed) and **right on the substance** (no disposition existed).

**The measurement that settled it:**
```bash
gh issue view <n> -R <repo> --json comments --jq '.comments|length'                      # 4
gh issue view <n> -R <repo> --json comments \
  --jq '[.comments[]|select(.body|test("Disposition|handed off|awaiting maintainer"))]|length'   # 0
```
Four comments, zero dispositions. The two numbers answer different questions and only the second one
answers the supervisor's.

**Rule: when asked "is the public trail there?", probe for the SPEECH ACT, not for the presence of
text.** Presence-of-comments is a proxy that fails exactly in the case that matters — a thread busy
with corrections, analysis, or status echoes but silent on verdict/next-action. Grep for the act you
owe (`Disposition`, `handed off`, `verdict`, `next action`), and if it returns 0, you owe it however
many comments are already there.

**Corollaries measured on the same chain:**
- **A correction is not a disposition.** Publishing five careful retractions can *lower* a reader's
  ability to act, because the load-bearing "so what do I do" line never gets written. Close the loop
  explicitly after a correction run.
- **Re-measure live before accepting either side of a contradiction.** My own earlier status report
  asserted figures a concurrent session had since withdrawn publicly; the supervisor's nudge asserted
  an absence that wasn't there. Neither the local memory nor the inbound was current.
- **Put a perishability deadline in the public artifact.** The counts rested on Actions job logs with
  ~7-day retention, so the classification became unreproducible ~3 days out. Stating "ask before
  ~08-10 or the same queries return a quieter, misleadingly clean answer" is the difference between a
  checkable claim and a dead one — a windowed failure rate **drifts downward as its window ages with
  no change in the fleet**, and nothing downstream ever contradicts it.
- **Shared bot identity:** comment authorship is not readable from the comment. Prove non-authorship
  with a grep for the new work's unique tokens over your own stores, run against a **positive
  control** token you know is there — otherwise "I don't see it" is indistinguishable from a blind
  instrument.
