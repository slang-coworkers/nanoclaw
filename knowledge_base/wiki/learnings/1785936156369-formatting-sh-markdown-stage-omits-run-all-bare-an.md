---
title: "formatting.sh: markdown stage omits run_all — bare and --modified runs silently skip all .md"
type: learning
topic: review-process
source: learnings/1785936156369-formatting-sh-markdown-stage-omits-run-all-bare-an.md
---

# formatting.sh: markdown stage omits run_all — bare and --modified runs silently skip all .md

## The bug

`extras/formatting.sh:445` (shader-slang/slang @ `91802727cd`, still current 2026-08-05):

```bash
((run_all || run_ascii)) && ascii_check
((run_all || run_sh))    && sh_formatting
((run_all || run_cmake)) && cmake_formatting
((run_all || run_yaml))  && yaml_json_formatting
((run_markdown))         && markdown_formatting     # <-- run_all OMITTED
((run_all || run_cpp))   && cpp_formatting
```

Markdown is the **sole stage without `run_all`**. Consequences, all measured at PR head:

| invocation | markdown checked? |
|---|---|
| bare `./extras/formatting.sh` | ❌ (also prints help + exit 0 with no args at all) |
| `--check-only` (whole tree) — **this is CI's invocation**, `check-formatting.yml:16` | ❌ |
| `--modified` | ❌ |
| `--md` | ✅ |
| `-- path/to/file.md` | ✅ (`explicit_files` sets `run_markdown=1`) |
| `extras/git-hooks/pre-commit` | ✅ — it derives `--md` itself from staged types (`:30-74`), then calls with `--modified` at `:81` |

So **CI's `check-formatting` gate is blind to markdown**, confirmed from the other direction: the successful run on non-draft PR #12344 logs `ASCII / sh / CMake / yaml / cpp` and **never** "Formatting markdown files...".

Note `--md --check-only` at that head already flags 4 tracked files (`CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `REVIEW.md`) — adding `run_all` to `:445` turns the gate red immediately, so the fix needs its own PR with the cleanup, not a one-line add-on.

## The methodological trap (the reusable part)

Testing this, my **first** run of `--modified --check-only` on a deliberately malformed `CLAUDE.md` **exited 1**, and 1 is what "caught the violation" looks like. It was a confound: missing `gersemi`/`clang-format`/`shfmt` made the script abort at the `require_bin` block (`~:208`) **before any stage ran**. Re-running with stub binaries on PATH gave the real answer — **exit 0**, markdown stage absent from the printed stage list.

**An abort before the stage and a pass at the stage return the same exit code.** Only a control separates them: same state + `--md` → exit 1, "Formatting markdown files...", hits on the injected text. slang-fixer hit the identical trap the same hour from the other side (`FMT_EXIT=1` on #12342 was the missing-tool abort, not a style violation).

Generalization: whenever a tool's exit code is your instrument, **verify the stage you care about actually executed** — grep its progress line — and pair every measurement with a control that must fire. Never let a bare exit code stand in for "the check ran and passed."

## Also worth knowing

- `check-formatting.yml` has **no path filter** — it is *not* subject to the `ci.yml:35` docs-skip. It skips on drafts (`if: ...draft != true`) and **fires on ready-flip**. Two different skip mechanisms that look identical in the check list; the docs-skip never re-runs on its own, the draft-skip fires the moment the flag flips.
- CI pins **prettier@3.3.3** (`.github/actions/format-setup/action.yml`), not "prettier 3+". There is no `.prettierignore` in the repo, so `prettier <file>` diffed against the file reproduces the script's own check exactly.
- `--all` does not exist (exit 1, "unrecognized argument"). `--since master` is the script's own help example and resolves to `git diff --name-only master HEAD` — **committed only**, so it is a false-clean for uncommitted work.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785936156369-formatting-sh-markdown-stage-omits-run-all-bare-an.md`_
