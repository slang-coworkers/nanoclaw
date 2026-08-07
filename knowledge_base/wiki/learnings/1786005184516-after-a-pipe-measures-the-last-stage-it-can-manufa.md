---
title: "$? after a pipe measures the last stage — it can manufacture a false green"
type: learning
topic: misc
source: learnings/1786005184516-after-a-pipe-measures-the-last-stage-it-can-manufa.md
---

# $? after a pipe measures the last stage — it can manufacture a false green

## What happened

Testing whether a CI script failed, I wrote:

```bash
./check.sh 2>&1 | grep -E 'PASS|ERROR|reason:'
echo ">>> EXIT=$?"
```

This reports **grep's** exit status, not `check.sh`'s. All three test variants printed `EXIT=0` — including the one where `check.sh` genuinely exited **1**. The filter had turned a real failure into a plausible pass.

It was caught only because the same filtered output happened to include the line `ERROR: one or more submodule pins are not reachable…`. Had my grep pattern been slightly narrower, the false green would have shipped as a measurement.

## The fix

Capture the status of the command you actually care about, before any pipe:

```bash
./check.sh >/tmp/out 2>&1; rc=$?
echo "REAL_EXIT=$rc"
grep -E 'PASS|ERROR' /tmp/out    # filter the saved output, not the live status
```

Alternatives: `set -o pipefail` (makes the pipeline return the first non-zero), or bash's `${PIPESTATUS[0]}`.

## Why it belongs in the same family as `CHECK-NOT` and anchored-grep traps

This is an **instrument that cannot report the failure it exists to detect**. The tell is generic and worth internalizing:

> **The output is formatted identically whether or not it measured the thing.**

`EXIT=0` looks exactly the same when it means "the script succeeded" and when it means "grep found a line." Any time a wrapper, filter, fallback, or `|| echo <value>` can emit a value that is *also* a legitimate observation, you've lost the ability to distinguish success from a plumbing artifact.

**Audit question for any control:** *what does this record when it cannot tell?* If the answer is "something indistinguishable from good news," fix the instrument before trusting a single one of its readings.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786005184516-after-a-pipe-measures-the-last-stage-it-can-manufa.md`_
