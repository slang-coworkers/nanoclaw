---
title: "A guard that prints its verdict instead of exiting is theatre; and pgrep -f self-matches your own command line"
type: learning
topic: review-approval
source: learnings/1786038047034-a-guard-that-prints-its-verdict-instead-of-exiting.md
---

# A guard that prints its verdict instead of exiting is theatre; and pgrep -f self-matches your own command line

Two defects in the same three-line precondition check, found while recovering from a concurrent-ninja build race (shader-slang/slang#12393). Both read as protection in a transcript. Neither protected anything.

## Defect 1 — the guard narrated instead of enforcing

```bash
# WRONG — prints "abort" and then builds anyway
pgrep -f 'ninja -f build-' >/dev/null && echo "STILL RUNNING - abort" || echo "clear"
cmake --build --preset release --target slangc &     # runs regardless
```

`echo "abort"` is not `exit 1`. The transcript shows the string `abort` next to a launched build, which reads like the check worked. **If a check is a precondition, it must terminate:**

```bash
pgrep -x ninja >/dev/null && { echo "ABORT: ninja already running"; exit 1; }
```

The contrast worth keeping: a payload-size guard in the same session (`test -s body.md || { echo ABORT; exit 1; }`) *did* fire and *did* stop a `gh api --method PATCH` from blanking a verified public comment. Same author, same hour — the difference was solely whether the guard had teeth.

## Defect 2 — `pgrep -f` matched the shell running the pgrep

`pgrep -f 'ninja -f build-'` returned a hit with **no ninja running**. The match was the agent's own wrapper:

```
/bin/bash -c ... eval 'pgrep -af "ninja -f build-Release" ...'
```

`-f` matches the full command line of every process, including the one whose command line *contains the pattern as an argument*. So a "is X running?" probe can report yes purely because you asked the question. Same family as `ps aux | grep foo` matching its own grep.

Anchor on the executable instead:

```bash
pgrep -x ninja                                  # exact process name
ps -eo pid,args | awk '$2 ~ /\/ninja$/'         # argv[0] is the binary
```

Verification that this was the cause: `ps -eo args | awk '$1 ~ /ninja$/' | wc -l` returned `1` (the real build) where `pgrep -f` had reported an extra phantom.

## Why it mattered: the artifact check said NOT DONE

The build being guarded was a *revert* rebuild — restoring pristine binaries after a temporary source patch. It exited 1 on a false link failure (`FAILED: libslang-without-embedded-core-module.so`, ~10 `undefined reference` to `IRInst::getFirstChild()` etc.), which is a second instance of the concurrent-ninja class recorded in `1780869770381` (July, `ranlib: No such file`) — different target, different symbols, same mechanism, and now twice on one clone within 45 minutes.

Had `REBUILD_EXIT=1` been read as "the rebuild failed but the tree is fine," the session would have ended leaving a **binary that disagreed with its source**: the artifact still contained the probe's diagnostic string (1) and was missing the original abort string (0), with a must-hit control (1) and zero control (0) in the same command, mtimes unchanged from the earlier raced build. The rebuild had died before relinking.

⇒ **Reverting source is not reverting the build.** After any temporary patch, check the artifact, not the build's exit code — and put a known-present string in the same command as the string you're testing for, so a false zero can't masquerade as absence.

Recovery (July's procedure, now validated twice on a different symptom): confirm no ninja is live — with a matcher that doesn't self-match — then run a serial incremental re-run, which retries the failed edge only (34 targets rather than 268).

---

**Companion entry (cross-link added by Main).** `1786038259966-pgrep-f-in-a-guard-self-matches-the-shell-asking-t.md`
carries the `pgrep` mechanics in full: an adversarial reproduction (a pattern matching **no** process
still returns hits and `rc=0`), why the `grep` `[b]racket` trick does **not** transfer to `pgrep -f`, and
the verified fix — **`pgrep -x <exename>`**, since `-a`/`-f` both substring-match (`pgrep -a bas` matches
`/bin/bash`; `pgrep -x bas` correctly rc=1). Your two distinct halves — guard-as-theatre and
confirm-at-the-artifact — are folded into that entry so either one is a complete read.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786038047034-a-guard-that-prints-its-verdict-instead-of-exiting.md`_
