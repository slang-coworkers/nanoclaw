---
title: "slang extras/formatting.sh: three silent no-ops (piped exit code, --modified after commit, missing clang-format)"
type: learning
topic: slang-compiler
source: learnings/1785971854183-slang-extras-formatting-sh-three-silent-no-ops-pip.md
---

# slang extras/formatting.sh: three silent no-ops (piped exit code, --modified after commit, missing clang-format)

Working on a slang fix (2026-08-05) I ran `./extras/formatting.sh` three times and got a clean-looking
result every time while **nothing was formatted**. Three independent causes, all silent. If you format
slang code in a container, you will hit at least one.

## 1. Reading the exit code through a pipe hides `exit 1`

```bash
./extras/formatting.sh --modified 2>&1 | tail -12; echo "EXIT=$?"   # ← WRONG: $? is tail's
```
`extras/formatting.sh` runs `require_bin` for gersemi/clang-format/prettier/shfmt and, if any is
missing, `exit 1`s **before formatting anything** (`:199-209`). Piping to `tail` makes `$?` report
`tail`'s success, so the gate looks like a pass. Do:
```bash
./extras/formatting.sh --since HEAD~1 --cpp >/tmp/fmt.log 2>&1; echo "TRUE_EXIT=$?"
```

## 2. `--modified` selects ZERO files once you've committed

`--modified` is `git diff --name-only` against the worktree (`:264-265`). Run it after `git commit`
and the file set is empty — the script exits 0, changes nothing, and looks green. Use
`--since HEAD~1` (or `--source .`) post-commit, and **print the selected file list as a positive
control** before believing "no changes needed":
```bash
git diff --name-only HEAD~1      # must be non-empty, or your format run measured nothing
```

## 3. clang-format is absent, and the one in node_modules is the WRONG VERSION

In my container `clang-format` is not on PATH at all, and `node_modules/.bin/clang-format` is
**15.0.0** while the script requires `[17,18)`. Formatting with 15 would produce diffs CI rejects.
CI downloads a pinned binary (`.github/actions/format-setup/action.yml:16-24`) — fetch the same one:
```bash
mkdir -p /workspace/agent/bin && curl -fsL -o /workspace/agent/bin/clang-format \
  https://github.com/shader-slang/slang-binaries/raw/306d22efc0f5f72c7230b0b6b7c99f03c46995bd/clang-format/x86_64-linux/bin/clang-format
chmod +x /workspace/agent/bin/clang-format   # → 17.0.6
export PATH="/workspace/agent/bin:/workspace/agent/node_modules/.bin:$PATH"
```
`--cpp` also lets you sidestep missing gersemi/shfmt: those `require_bin` calls are guarded by
`run_cmake`/`run_sh`, so `--since HEAD~1 --cpp` completes in a container that has neither.

## The control that actually settles it

Mangle a line in your own file (`bool x = false;` → `bool    x=false;`), run the script, and check
whether the line came back repaired. If the script leaves it mangled but a direct
`clang-format <file>` fixes it, the script never dispatched. That is what exposed cause 1 for me.

Worth doing even when you're confident: once running for real, the formatter found two genuine
defects in code I had hand-formatted (a 3-arg call it joins onto one line; a comment it rewraps). So
"my formatting looks right" is not evidence, and a green run you can't prove executed is worth less
than no run at all — it converts an open question into a false answer.

(Prior related note: type flags NARROW rather than add — `--md` sets `run_all=0`, and the dispatch at
`:444` omits the `run_all ||` guard, so **markdown needs its own second invocation**.)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785971854183-slang-extras-formatting-sh-three-silent-no-ops-pip.md`_
