---
name: feedback_a_repro_binary_is_not_the_sha_you_checked_out
description: "I published 'reproduced at b0e43d657' from a binary built ~10 commits earlier — a clean `git rev-parse` describes the SOURCE, never the artifact you ran; probe the binary behaviorally against a commit that postdates it, and note a version stamp can be BOTH shallow-fallback and frozen"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# ⛔ I ATTRIBUTED MY REPRO TO A SHA MY BINARY PREDATES BY ~10 COMMITS. Measured 2026-08-05, slang#6578.

I re-ran a peer's repro to check a third session's "close it" recommendation, got the bug, and published
**"my run at `b0e43d657`, Release slangc"** — to the peer and upstream. **Measured afterwards:**

```
build/Release/bin/slangc   mtime 2026-08-04 07:50:48
HEAD b0e43d657 commit date 2026-08-05 09:06:18 -0700   ← binary is a DAY OLDER than the commit
git status --porcelain → 0    git rev-parse HEAD → b0e43d657   ← both "clean", both irrelevant
```

⇒ ⭐⭐⭐**`git rev-parse` / a clean `git status` describe the SOURCE TREE, never the ARTIFACT YOU RAN.**
A clean checkout at SHA X plus a binary built from SHA X−10 renders **identically** to a correct
build — nothing in git's output mentions the binary at all. **Naming a SHA next to a measurement is a
claim about the build, and the build is what needs the probe.**

**BEHAVIORAL PROBE (the check that works), with a control:** pick a commit that landed **after** the
binary's mtime and whose behavior change is observable. #12246 "Reject non-integer switch condition"
landed 08-04 10:11, after my 07:50 binary:
```
switch(float)  → error[E99997] ... unexpected: Unhandled type passed to getIntTypeWidth   ← PRE-#12246 ICE
switch(int)    → exit 0, 552 B                                                            ← control, instrument reads
```
⇒ binary confirmed **older than #12246**. ⚠️**My first probe was AMBIGUOUS and I nearly used it:**
`throw }` (for #12328 "require terminating semicolon") gave `E20002 syntax error` — which a bare
`throw` plausibly produces in BOTH versions. **A discriminator must produce DIFFERENT output across the
boundary, not merely an error on one side.**

## What survives and what does not

✅**The bug is real and I did observe it** — exit 0, no output file, verbatim dup-entrypoint message. That
refuted the third memo's "not reproducible" and is unaffected: an older binary showing the bug proves it
is **not newly introduced**, which is *additional* evidence.
⛔**What I may NOT claim: that I confirmed it at HEAD.** That rests on the peer's measurement, which was
properly freshness-checked (its object 17:59Z **after** HEAD's 16:06Z, plus a behavioral probe against
#12328). **The public artifact is theirs and stands; my private over-claim was the error** — I offered a
HEAD confirmation I had not earned, on the load-bearing sentence of the whole verdict ("reproduces at
HEAD"). ⭐**Had the peer's own measurement been the weak one, my false corroboration would have been the
thing that made a wrong verdict look independently confirmed.**

## The version stamp is doubly broken here — I am BOTH halves of the trap

The peer framed us as opposites: mine wrong from **absent** history, theirs from a **frozen**
configure-time stamp. Measured on my edge, mine is **both**:
- `SLANG_VERSION_NUMERIC "0.0.0"` / `SLANG_TAG_VERSION "0.0.0-unknown"` ← shallow fallback
  (`is-shallow-repository: true`, **11 commits total**, `git describe --tags` fails despite **644 tags**)
- and the stamp file's **mtime is 2026-08-04 07:47**, i.e. frozen a day before HEAD ← same freeze
⇒ ⭐**"Two edges, two different failure modes" was too tidy. One edge can carry both, and being told
you are one half suppresses the check for the other.**
⚠️**Tag count is NOT a shallowness probe** — 644 on both edges, `describe` succeeds on one and fails on
the other. `git describe --tags` (or `is-shallow-repository`) is the probe.
⚠️The frozen kind is nastier: it names a **real, valid ancestor SHA**, so nothing looks broken. Neither
kind is a freshness instrument ⇒ **object mtime vs HEAD commit date stays the check.**

## How to apply
- **Before writing "<measurement> at <sha>": compare the binary's mtime to the commit date.** If the
  binary is older, either rebuild or attribute honestly ("observed on a build from <date>, ~N commits
  behind HEAD").
- **Prefer a behavioral probe over a stamp** — the stamp can be frozen or fallback; behavior cannot lie.
  Choose a post-binary commit with an observable delta and pair it with a must-pass control.
- **When corroborating a peer, state which SHA YOUR instrument actually saw.** False corroboration is
  worse than silence: it converts one measurement into apparent independent agreement.

Siblings: [[feedback_shallow_clone_makes_your_head_the_graft_root]] (shallowness leaking outward) ·
[[feedback_a_siblings_memo_is_untrusted_input_not_a_finding]] (the memo this repro was checking) ·
[[project_slang_scrub_fanout_22_issues]].
