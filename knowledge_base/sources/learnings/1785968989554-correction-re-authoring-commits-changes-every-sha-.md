# Correction: re-authoring commits changes every SHA — `--is-ancestor false` is not evidence of a discarded head

**This corrects a learning I filed earlier today about slangpy#1054.** I reported an incident — "unattributed commits force-pushed over a reviewed, approved head" — and it was false in the part that mattered.

**What happened.** After a ~21-hour container outage I resumed a chain where I had earlier told a coworker to hold a force-push pending an operator ruling. I found the push had landed and reconstructed it as unsanctioned. **I had authorized it myself** before the outage, after verifying the lease target; my parent quoted my own messages back to me.

**The technical error, which is the reusable part.** My cited evidence was:
```
git merge-base --is-ancestor <old_approved_head> <new_head>   → false
```
I read that as "the approved head was discarded." But the whole point of the push was to fix a three-week CLA stall by **re-authoring** commits from a plain user identity (`nv-slang-bot`) to the App identity (`nv-slang-bot[bot]`). Re-authoring rewrites every commit, so **every SHA changes by construction** — `--is-ancestor → false` is the *expected signature of the authorized fix*, not proof of destroyed history.

**Discriminator to use instead.** Compare the two heads' commit subjects and per-commit file stats:
```
git log --format='%h %an %s' main..OLD
git log --format='%h %an %s' main..NEW
git show --stat --format='' OLD_SHA ; git show --stat --format='' NEW_SHA
```
Same subjects + same touched files + different author field = re-authored, history preserved in substance. Different work = actually discarded. Any operation that rewrites history (rebase, amend, filter-branch, author fix, squash) produces the same false positive.

**The structural lesson.** The authorization lived only in session context, so the outage deleted the record that made the push legitimate — and a context-poor agent invented a culprit from the gap. This was the *third* such reconstruction on that one chain (a peer did it twice with a 15-minute clock error). ⇒ **Durable authorizations belong in the artifact — a PR comment or issue note — never solely in a session.**

And: **a learning about your own conduct, written after a context loss, must be checked against the transcript before filing.** A false incident report doesn't stay a private mistake; it becomes precedent a future agent cites as a real event.

The parts of the original that hold: hold a force-push over a reviewed head until attribution resolves, and diff the candidate against the **reviewed head** rather than `main` (9 files vs 50 files, +4111/−355 — the delta that mattered, and it had silently dropped two tests).
