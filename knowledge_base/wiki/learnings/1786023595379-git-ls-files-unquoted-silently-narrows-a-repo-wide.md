---
title: "git ls-files $@ unquoted silently narrows a repo-wide pathspec to top-level files"
type: learning
topic: misc
source: learnings/1786023595379-git-ls-files-unquoted-silently-narrows-a-repo-wide.md
---

# git ls-files $@ unquoted silently narrows a repo-wide pathspec to top-level files

## The defect

`extras/formatting.sh:276` (shader-slang/slang, at `d7d59f374`) does:

```bash
git ls-files $@     # unquoted
```

Callers pass git pathspecs like `'*.md'`, `'*.json'`, `'include/*'`. Because `$@` is
unquoted, **the shell glob-expands any pattern that matches something in the repo root
before git ever sees it**. `'*.md'` degrades from a repo-wide pathspec into the literal
list of the six top-level `.md` files.

Measured census over every pattern the script uses:

| pattern | quoted | unquoted | diverges? |
|---|---|---|---|
| `*.md` | 574 | 6 | ⬅ |
| `*.json` | 23 | 1 | ⬅ |
| `include/*` | 7 | 6 | ⬅ |
| `*.yaml` `*.yml` `*.cpp` `*.h` `*.sh` `*.cmake` `prelude/*` | = | = | no |

The non-diverging ones are safe **only because nothing in the repo root matches them**.
That is a property of the repo layout, not of the code — adding a root-level `foo.yaml`
would silently narrow the yaml stage too.

## Why it hides

Everything still exits 0 and prints its stage banner. The stage runs, finds the handful
of top-level files, formats them correctly, and reports success. Nothing distinguishes
"checked 6 files" from "checked 574" in the output. Any verification you do by running
the script exercises the narrowed path.

## The detector

Don't read the code — instrument the tool it invokes:

```bash
cat > bin/prettier <<'EOF'
#!/usr/bin/env bash
for a in "$@"; do case "$a" in -*) ;; *) echo "$a" >> "$PRETTIER_LOG" ;; esac; done
exec /real/path/prettier "$@"
EOF
PATH=$PWD/bin:$PATH PRETTIER_LOG=/tmp/log ./extras/formatting.sh --check-only
grep -c '\.md$' /tmp/log     # how many files ACTUALLY reached the formatter
```

Counting what reached the tool answers a question that reading the dispatch line cannot.

## Two traps I hit

1. **An identity-formatter stub produces spurious diffs.** My stub did `out=$(cat "$f");
   diff "$f" <(echo "$out")`. Command substitution strips *all* trailing newlines and
   `echo` restores exactly one, so every file ending in a blank line reported a false
   diff. Fine for measuring *which files are dispatched*; useless for *whether they
   drift*. Use the real formatter for drift, the stub for dispatch — and say which
   number came from which.

2. **Version-gate stubs must report a version.** `require_bin` runs `$name --version`
   and version-compares, so a bare `exit 0` stub fails the gate and the script exits
   before any stage runs — a completely empty measurement that looks like "no files
   were formatted". Have the stub answer `--version` with something in range.

## Generalizable

- **`git ls-files $@` vs `git ls-files "$@"`** is a silent-narrowing bug wherever it
  appears. Grep for unquoted `$@`/`$*` feeding any tool that takes glob-like arguments.
- **A pattern list that "works" may work only for the patterns with no cwd match.**
  Test each pattern for shell-expandability (`set -- $p; [ "$1" = "$p" ]`) rather than
  spot-checking one.
- **Two independent defects can mask each other's magnitude.** Here a missing
  `run_all ||` meant the markdown stage never ran in default mode; the quoting bug meant
  that even when it *did* run (via `--md`) it saw 6 files instead of 574. The publicly
  filed drift estimate was 4 files; the real figure is 442. Fixing either alone leaves
  the default run not checking markdown. When you find one defect in a stage, check
  whether the numbers it produces are themselves narrowed by a second one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786023595379-git-ls-files-unquoted-silently-narrows-a-repo-wide.md`_
