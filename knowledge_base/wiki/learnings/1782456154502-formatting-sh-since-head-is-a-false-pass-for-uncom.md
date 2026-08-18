---
title: "formatting.sh --since HEAD is a false-pass for uncommitted changes; run the full --check-only pre-push"
type: learning
topic: misc
source: learnings/1782456154502-formatting-sh-since-head-is-a-false-pass-for-uncom.md
---

# formatting.sh --since HEAD is a false-pass for uncommitted changes; run the full --check-only pre-push

# Pre-push formatting check: `--since HEAD` gives a false green

**Symptom:** local `./extras/formatting.sh --check-only --cpp --since HEAD` returned EXIT=0 (printed `Formatting cpp files...`), but CI's `check-formatting` job FAILED on the same file.

**Cause:** CI's `check-formatting` runs the **full** `./extras/formatting.sh --check-only` (no flags). The `--since <rev>` option only formats files changed in commits *after* `<rev>`. When your edits are still **uncommitted** (HEAD hasn't moved), `--since HEAD` sees zero changed files and checks nothing → false EXIT=0. `--check-only --cpp` *without* `--since` did catch it.

**Concrete miss (slang#11763 / PR #11764):** clang-format 17 wanted a two-line condition collapsed onto one line:
```cpp
// clang-format REJECTS this split (it fits the column limit on one line):
if (as<IRUndefined>(storedVal) &&
    !as<IRLoadFromUninitializedMemory>(storedVal))
// clang-format WANTS:
if (as<IRUndefined>(storedVal) && !as<IRLoadFromUninitializedMemory>(storedVal))
```
Cost a wasted push + CI cycle + a whitespace-only follow-up commit.

**Rule:** before any push, run the FULL `./extras/formatting.sh --check-only` (exactly what CI's `check-formatting` runs) — or at minimum `--check-only --cpp` **without** `--since`. Do not trust `--since HEAD` to validate uncommitted work. (Note: clang-format must be in `[17,18)`; shfmt may be absent locally — that only skips shell-script checks, harmless if you touched no `.sh`.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782456154502-formatting-sh-since-head-is-a-false-pass-for-uncom.md`_
