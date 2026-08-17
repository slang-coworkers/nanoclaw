---
title: "Prove the branch executes before reporting an edit as effective — and never test a script that stamps the file you monitor"
type: learning
topic: misc
source: learnings/1785901095680-prove-the-branch-executes-before-reporting-an-edit.md
---

# Prove the branch executes before reporting an edit as effective — and never test a script that stamps the file you monitor

Two hazards from one authorized one-line change, both of which would have let me report a fix that fixes nothing.

**1. A syntactically-correct edit inside a guarded branch is indistinguishable from a fix by inspection.**

I was authorized to add a Discord channel id to a monitoring script's polled-channel list. Minimal edit, `bash -n` clean:
```diff
-  for ch in 1305995870046650368; do
+  for ch in 1305995870046650368 1303735244108595330; do
```
It accomplishes nothing, for two independent reasons I only found by tracing:

- **Wrong copy.** Line `:6` reads a token file that does not exist, yet the live scheduled runs keep returning nonzero counts. A script that cannot read a token cannot produce those counts ⇒ **the executing copy is the host-side task definition; my workspace file is a stale artifact.** A file sitting in your workspace is not evidence it is the deployed one.
- **Unreachable locally.** Line `:34` wraps the entire block in `if [ -n "$TOKEN" ]`. Token absent ⇒ block skipped ⇒ the counter stays 0 **regardless of which ids sit at `:35`.**

`bash -n` proves syntax, never reachability. Before reporting an edit as effective, trace every enclosing guard to a value you have **measured**. Then report the diff *and* what it does not accomplish — "edit applied, gap NOT closed, here's the lever and who holds it" is far more useful than a clean-looking fix that silently no-ops.

**2. Never execute a script that writes the file you use to monitor it.**

Running the precheck to test my edit **stamped the very timestamp file the script uses as its "have I seen this already" watermark.** I advanced it by hand — perturbing the instrument I monitor with. No harm that time (newest messages were older than the prior watermark, so nothing was skipped), but I checked rather than assumed, and had a message arrived in between, my *test* would have suppressed a real wake.

**Fix: copy to `/tmp` and run the copy.** Generally: enumerate a script's side effects on shared state before test-running it, especially watermarks, cursors, lockfiles, and last-seen timestamps.

**3. Calibration datapoint on carried figures.** Of five carried figures checked in one session, **four did not survive.** The survivor's distinguishing property was not accuracy — it was that I had labelled it as *someone else's measurement* rather than folding it into my own prose, which is what kept it re-checkable. **Label provenance inline; an unlabelled figure becomes unfalsifiable** once it's been repeated a few times.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785901095680-prove-the-branch-executes-before-reporting-an-edit.md`_
