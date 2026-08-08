---
name: project-slang-formatting-toolchain-absent-in-containers
description: "Slang's extras/formatting.sh cannot run in coworker containers — clang-format/gersemi/prettier absent; install_packages (apt+npm, no pins) cannot fix it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# `extras/formatting.sh` cannot run in coworker containers

**Measured 2026-08-07 on my own edge** (not inferred from a peer's report — the triager reported it for its container, I re-probed mine and it matches):

| tool | required by `extras/formatting.sh` | my container |
|---|---|---|
| `clang-format` | 17–18 (`:203`) | **ABSENT** (no apt candidate for `clang-format` or `clang-format-17`) |
| `gersemi` | 0.21–0.22 (`:200`) | **ABSENT** (PyPI-only; see below) |
| `prettier` | 3+ (`:204`) | **ABSENT** |
| `shfmt` | 3+ (`:205`) | ✅ 3.6.0 |

## Gating is PER-MODE — established by execution 2026-08-07

Each check is guarded: `((run_all || run_cmake)) && require_bin "gersemi" …` etc. (`:199-205`). **`run_all=1` is the DEFAULT** (`:61`), cleared only by an explicit mode flag (`:75-95`) or by passing file paths (`:227`). Measured exit codes, unpiped:

| invocation | rc | outcome |
|---|---|---|
| `./extras/formatting.sh --check-only` (what CLAUDE.md prescribes) | **1** | needs all four; reports gersemi + clang-format + prettier missing |
| `--check-only --cpp` | **1** | needs `clang-format` — absent |
| `--check-only --sh` | **0** | **runs to completion** — "Formatting sh files…", `shfmt 3.6.0` suffices |

⇒ **Shell formatting genuinely works on MY edge; C++/cmake/yaml do not.** So "the script cannot run" is too strong, and "shfmt is present" must not be read as "the script will run" — *which* binary is missing decides which changes are formattable. A doc-comment-only C++ change (option 1 on #12316) needs `clang-format` ⇒ still blocked.

**Cross-edge confirmation (slang-triager ran the same three cells, 08-07).** The `--sh` row is the discriminator, observed from both sides:

| `--check-only …` | my edge | triager's edge |
|---|---|---|
| bare | rc=1 (3 complaints — shfmt passes) | rc=1 (**4** complaints) |
| `--cpp` | rc=1 — `clang-format` | rc=1 — same |
| `--sh` | **rc=0** — completes | **rc=1** — *"needs shfmt, but it isn't in $PATH"* |

The two containers differ by **exactly one binary** (`shfmt`), with `git`/`diff` passing their gates on both — so the opposite `--sh` results are one mechanism seen from either side. Stronger evidence for per-mode gating than either edge alone, and it also fixes the complaint *count* as per-edge (3 here, 4 there) rather than a property of the script.

⚠️ **rc is not diagnostic:** bare and `--cpp` both return 1 for different causes. Read the complaint lines, never the code alone, to learn which mode is blocked.

Consequence: **a coworker cannot satisfy the bare "run `./extras/formatting.sh` before committing" rule**, and any C++/cmake/yaml PR must have formatting run by the human author or CI — stated in the PR body, not assumed.

⚠️ **Measurement trap hit here:** `cmd | head -8; echo rc=$?` reported `rc=0` for the bare run, because `$?` was `head`'s. True rc is 1. ⇒ [[feedback_piping_to_head_masks_the_exit_code_you_are_testing]]

## Why I could not just fix it

`install_packages` is admin-only (mine) but takes **apt + npm only** and **rejects version specs** (`"prettier@3.3.3"` → `Invalid npm package name`). Blockers:
- **gersemi is PyPI**, not npm. npm's `gersemi` is `git://github.com/esha/gersemi.git` at **0.1.5** — an unrelated project sharing the name. Installing it would put wrong software on PATH under the right name. ⇒ [[feedback_a_package_name_match_is_not_the_package]]
- **clang-format has no apt candidate** in this image (`apt-cache policy clang-format` / `clang-format-17` both empty) — needs an LLVM apt source, or the `clang-format` PyPI wheel.
- Version pinning (`clang-format` **17–18** specifically; 19+ reformats differently) is unexpressable through the tool.

⇒ A durable fix needs a **Dockerfile/image change** (LLVM apt source + `pip install gersemi==0.22.x` + pinned `prettier`), not an `install_packages` call. Not attempted unilaterally: it changes every coworker image.

**Status:** unresolved, operator decision. Interim rule — coworker PRs on slang state plainly that formatting was not run locally and why.

Related: [[feedback_a_package_name_match_is_not_the_package]], [[project_12316_type_layout_policy_duplication_techdebt]] (surfaced from its option-1 draft-PR handoff).
