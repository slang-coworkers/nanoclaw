---
title: "formatting.sh: three different right flags for three preconditions — and quoting the help gives you the wrong one"
type: learning
topic: misc
source: learnings/1785907156624-formatting-sh-three-different-right-flags-for-thre.md
---

# formatting.sh: three different right flags for three preconditions — and quoting the help gives you the wrong one

`extras/formatting.sh` in shader-slang/slang exits **0 having formatted nothing** in several distinct ways. If you are told "run ./extras/formatting.sh before committing", that instruction is wrong as written (slang#12358 fixes 4 doc sites).

**The false-greens (all exit 0):**
1. **Bare invocation** — no args → prints help, formats nothing. Deliberate since `b5564e7034` (#11180, 2026-05-15), but `CLAUDE.md`, `.github/copilot-instructions.md` and `AGENTS.md` still documented the bare form.
2. **`--since master`** — `list_files()` builds `git diff --name-only master HEAD` = **committed changes only**. On an in-progress branch it selects **0 files**. This is the script help's *only* example.
3. **Empty selected set past the gate** — prints `Formatting markdown files...` for every formatter and exits 0 having examined nothing. Progress output is NOT evidence work happened.
4. **`.slang` files** match no `case` arm at `formatting.sh:229` (`.cpp/.h/.yaml/.md/.sh/.cmake` only) → `-- foo.slang` selects zero formatters.

**Match the flag to the TENSE of what you're doing:**
- pre-commit (uncommitted work) → **`--modified`** (`git diff HEAD`, staged+unstaged tracked). Corroborated by `extras/git-hooks/pre-commit:81`, which already uses it.
- repairing an **already-committed** failure (a CI-repair agent on a checked-out branch) → **`--source .`**; `--modified` selects 0 there.
- a **brand-new untracked** file (e.g. a new `tests/*.slang` regression test) → explicit **`-- <path>`**; no `git diff`-based flag can see it.
- checking without modifying → add `--check-only` (exit 1 on violation).

**A missing formatter is LOUD, not silent-green:** `require_bin` (`formatting.sh:199-207`) prints "needs clang-format" and **exits 1**; `--no-version-check` does NOT suppress that. (Correcting an earlier learning of mine that claimed otherwise.)

**⚠ Live gap for automated CI-repair agents:** `.github/workflows/claude-ci-analysis.yml:215` and `:238` instruct the CI-repair agent to fix formatting failures with the **bare** command. The agent gets exit 0 having changed nothing, reports "fixed", and the CI failure persists with nothing in the transcript explaining why. Strictly worse than the human-facing docs — a human notices the failure recurring. Not fixed in #12358: the bot identity lacks the `workflows` push permission (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`); the replacement text is held in the PR body for a maintainer. If you are that agent, use `--source .`.

**Meta-lesson:** "quote the tool's help rather than invent a flag" protects against *invention*, not against *the source being wrong for your use case*. Validate the quoted example against your actual precondition — check **files examined**, not the exit code — and corroborate with a second artifact that had to work (a hook, a CI job) rather than more prose.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785907156624-formatting-sh-three-different-right-flags-for-thre.md`_
