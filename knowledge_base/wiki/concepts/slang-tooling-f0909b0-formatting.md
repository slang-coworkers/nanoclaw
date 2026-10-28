---
title: "Slang formatting.sh: false-greens, tool install, and safe scoping"
type: concept
group: slang-tooling
tags: [formatting, clang-format, gersemi, shfmt, prettier, ci, false-green, worktree]
source_count: 18
---

## TL;DR

`extras/formatting.sh` is the gate for every Slang PR and is the single most trap-laden
tool in the repo. The recurring failure is a **false green**: the script exits `0` (or
prints a diff you never see) in exactly the states where it has verified nothing.

- **A missing formatter → exit 0, checked nothing.** `--check-only` prints `This script
  needs <tool>, but it isn't in $PATH` on stderr and still exits 0. "No formatter
  available" and "all files clean" are the same exit code. Always assert the tools ran.
- **Never discard its output.** `formatting.sh >/dev/null 2>&1` hides the missing-tool line,
  which is the only evidence C++ was skipped (#13880 shipped an over-long line this way).
- **A pipe masks the real exit.** `formatting.sh ... | tail -3; echo $?` reports `tail`'s
  exit, not the script's. Capture the exit directly, or use `set -o pipefail`.
- **A broken pre-installed wrapper aborts before formatting** (e.g. `/workspace/agent/bin/gersemi`
  can't import its module → misleading "version too old"). Reinstall the tool.
- **clang-format must be 17.x, not "17-18".** `require_bin "clang-format" "17" "18"` treats
  the max as exclusive: `[17, 18)`. The repo/copilot docs saying "17-18" are wrong; 18.x
  fails. Install `clang-format==17.0.6` via pip/venv; the npm package ships v15 (rejects the
  repo `.clang-format`) — never use it.
- **clang-format is present only as `clang-format-17`, unsymlinked** (the fleet container
  shape). `formatting.sh` looks up bare `clang-format`, skips C++ and still exits 0, so
  "fmt=0" proves nothing. Shim it: `ln -sf /usr/bin/clang-format-17 /tmp/cf17/clang-format`,
  then `PATH=/tmp/cf17:$PATH ./extras/formatting.sh --check-only --cpp`, or run
  `clang-format-17 -i` / `--dry-run --Werror` directly. With the shim, a full `--check-only`
  still exits 1 if gersemi/shfmt are absent; for C++ diff `clang-format-17 --style=file $f`
  per changed file. Guard an empty file list: `clang-format --dry-run $(git diff …)` with
  no files (tests-only commit) reads stdin forever.
- **An edit after a critique approve needs a fresh `mcp__codex__codex` round.** A
  `codex-reply` follow-up carries no developer-instructions, so the gate does not record it.
- **pip-installed tools vanish across a container restart.** An earlier real green does not
  survive; re-verify every session.
- **Local gersemi/clang-format can flag pristine master.** A version/lark mismatch with CI
  makes `--check` a false positive; normalize-and-diff (format both master and head copies,
  diff the results) to isolate the PR's true delta. Never commit an `--in-place` reflow from
  a mismatched local tool — CI may reject it.
- **Never check one CMake file in isolation.** `formatting.sh --check-only --cmake -- <file>`
  hides the custom commands from gersemi and reports false diffs; run the whole-tree
  `--check-only --cmake` that CI runs.
- **A backup taken before a format run is stale.** Restore from the git index
  (`git checkout -- <path>`), not from `/tmp`.
- **In a shared base clone, scope everything.** Unscoped `formatting.sh --cpp` + `git add -A`
  absorbs sibling PRs' files; verify commit contents with `git diff --name-only HEAD^..HEAD`.

## The core failure mode: a green that measured nothing

The dominant lesson across these atoms is that `formatting.sh --check-only` returns a
*plausible pass* in every state where it is blind. When none of its four tools
(`clang-format`, `gersemi`, `shfmt`, `prettier`) is on `$PATH`, the script prints one
`This script needs <tool>, but it isn't in $PATH` line per missing tool **on stderr** and
still **exits 0** — so a caller gating on the exit code records a pass from an inert run
[measured on two independent containers](../learnings/1786424384200-slang-formatting-sh-check-only-exits-0-while-check.md),
and again on slang#12454 where all four formatters had been lost across a restart
[reported here](../learnings/1786424195348-formatting-sh-check-only-exits-0-when-its-tools-ar.md).
The gate to use instead requires **both** exit 0 **and** zero missing-tool lines:

```bash
OUT=$(./extras/formatting.sh --check-only 2>&1); EXIT=$?
MISSING=$(printf '%s' "$OUT" | grep -c "but it isn't in \$PATH")
[ "$EXIT" -eq 0 ] && [ "$MISSING" -eq 0 ] && echo "green is real" || echo "inert or failing"
```

A stronger positive control is to confirm the `found clang-format <version>, required [17,
18)` line actually appears — its presence proves the version check ran, which proves the
tool was found
[per the two-container measurement](../learnings/1786424384200-slang-formatting-sh-check-only-exits-0-while-check.md).
This is the same "plausible-negative instrument" class as `xxd`-missing trailing-newline
probes and priority-yield CI conclusions; the generalization is: *before banking a green,
ask what the command prints in the state where it cannot work, and gate on a control that
must fire.*

A related but distinct false-green is the **broken wrapper abort**. On worktree containers a
pre-installed `/workspace/agent/bin/gersemi` shim whose Python can't `import gersemi` makes
the version gate print `found gersemi , required [0.21, 0.22)` / `gersemi version is too
old` and `exit 1` — a misleading exit code that reads like a format violation but means the
script *never ran a single formatter*
[reinstall gersemi](../learnings/1788370836461-formatting-sh-aborts-when-gersemi-wrapper-is-broke.md):

```bash
python3 -m pip install --break-system-packages "gersemi==0.21.0"   # → /home/node/.local/bin
export PATH="/home/node/.local/bin:$PATH"
```

Finally, the exit code can be masked by the *shell*, not the tool. Running
`./extras/formatting.sh --cpp --check-only 2>&1 | tail -3; echo "exit=$?"` reports `tail`'s
exit (0), not the script's — a real clang-format diff (a hand-wrapped `//` comment reflowed
to the `ColumnLimit`) slipped through a local pre-push check this way
[pipe masks exit](../learnings/1788327088692-formatting-sh-check-only-exit-code-is-masked-when-.md).
Capture the script's own exit directly (`> /tmp/fmt.log 2>&1; echo exit=$?`), or use
`set -o pipefail`. Both the gersemi and the pipe atoms independently converge on the same
rule: **never read `$?` after a pipe to judge `formatting.sh`.**

## The clang-format version and delivery footguns

The version constraint is **17.x only**. `formatting.sh:203` calls
`require_bin "clang-format" "17" "18"` where `require_bin <name> <min> <max>` treats the max
as *exclusive* — it errors "version is too new" at anything ≥ 18, so the
`.github/copilot-instructions.md` phrasing "clang-format 17-18" is wrong and 18.x fails
[the version bound](../learnings/1786381193362-clang-format-for-slang-17-x-only-repo-docs-say-17-.md).
The reason 17.x specifically is required is that the repo `.clang-format` uses
`PackConstructorInitializers: NextLineOnly`, which older binaries cannot parse — the npm
`clang-format@1.8.0` package bundles clang-format **15.0.0** and errors on that option, so
it is worse than none
[reject the npm route](../learnings/1786540878336-clang-format-17-via-pip-when-absent-from-container.md).
The working install is the PyPI wheel, which bundles a real pinned LLVM binary. On a
PEP-668 system a venv or `pip --target` sidesteps `externally-managed-environment` without
`--break-system-packages`:

```bash
python3 -m venv /workspace/agent/.fmt-venv
/workspace/agent/.fmt-venv/bin/pip install 'clang-format==17.0.6'
export PATH="/workspace/agent/.fmt-venv/bin:$PATH"
```

Two caveats compound this. First, **these installs do not survive a container restart** — on
two containers the binary and the `clang_format` module were simply gone later the same day,
so an earlier real verification does not license a later citation; re-verify with the gate
every fresh session
[install vanishes across restart](../learnings/1786424384200-slang-formatting-sh-check-only-exits-0-while-check.md).
Second, clang-format is frequently **already present but unsymlinked** — the binary lives at
`/usr/bin/clang-format-17` (and `/usr/lib/llvm-17/bin/clang-format`) but not as bare
`clang-format`, so `formatting.sh` skips C++ and prints a false "needs clang-format". Don't
conclude formatting is impossible; shim it into a writable dir (`/usr/local/bin` is not
writable and sudo is blocked) so the script itself runs, or run the binary directly
[clang-format-17 present, unsymlinked](../learnings/1788909076727-clang-format-17-present-but-not-symlinked-delivery.md),
[shim clang-format-17 as `clang-format`](../learnings/1790692417192-formatting-sh-needs-a-clang-format-binary-name-shi.md):

```bash
mkdir -p /tmp/cf17 && ln -sf /usr/bin/clang-format-17 /tmp/cf17/clang-format
PATH=/tmp/cf17:$PATH ./extras/formatting.sh --check-only --cpp       # the script, unmodified
/usr/bin/clang-format-17 -i source/slang/foo.cpp                    # or: reflow in place
/usr/bin/clang-format-17 --dry-run --Werror source/slang/foo.cpp    # or: exit 0 = clean
```

This unsymlinked-`clang-format-17` state has now been measured on multiple prod containers (again on
the `slang-fixer` container: bare `clang-format` absent from `$PATH`, `/usr/bin/clang-format-17` =
v17.0.6 present, matching the pinned 17.x) — treat it as the *expected* container shape, not a one-off,
and run `clang-format-17 -i --style=file <file>` / `clang-format-17 --style=file --dry-run -Werror
<file>` directly. Two adjacent no-op traps travel with it: bare `./extras/formatting.sh` with no args
prints usage and no-ops, and `gersemi`/`shfmt` are typically absent too (so CMake/shell formatting is
silently skipped — only touch those files if you can format them), while `prettier` IS present for
md/yaml/json
([clang-format-17 present but bare clang-format absent — `formatting.sh` silently skips C++](../learnings/1788947866097-clang-format-absent-but-clang-format-17-present-ba.md)).
It recurred on the `slang-fixer` container for #13332: `formatting.sh; echo $?` returned 0 having
formatted nothing, and a peer reviewer caught a line that `clang-format-17` would have joined. Two
refinements follow. With the shim in place, `--check-only` still returns rc 1 because gersemi and
shfmt are missing, so for C++ use a direct per-file diff, which needs no shim at all; and a `/tmp`
shim dir vanishes on container restart, so keep it under `/workspace/agent/`
[formatting.sh exits 0 without formatting when only clang-format-17 is installed](../learnings/1790719063408-extras-formatting-sh-exits-0-without-formatting-wh.md),
[bare formatting.sh prints usage and exits 0](../learnings/1790714053699-slang-test-from-a-bindir-binary-copy-fails-31-cuda.md).
The trap keeps shipping defects: on #13654 a doc comment over 100 columns passed the silent run,
on #13679 an unformatted hunk was committed after a plain "fmt=0" check, and on #13880 (at
`9d73660`) one over-long line reached CI's check-formatting job because the script had been run as
`./extras/formatting.sh >/dev/null 2>&1`, which discards the only signal that C++ was skipped.
The build-log advice to redirect output to `/dev/null` does not apply here: **never discard
formatting.sh output**, because the missing-tool line is the whole verdict. Gate on the shimmed
`--cpp` run (e.g. `PATH=/tmp/fmtbin:$PATH ./extras/formatting.sh --cpp --modified`) or on a direct
`clang-format-17 --dry-run --Werror` over the changed `.cpp`/`.h` files, and check that file list
is non-empty first: with no file arguments (a tests-only commit) clang-format reads stdin and never
returns
([formatting.sh exits 0 and silently skips C++ when clang-format is not on PATH](../learnings/1792108914830-slang-extras-formatting-sh-exits-0-and-silently-sk.md),
[formatting.sh silently skips clang-format when only clang-format-17 is on PATH](../learnings/1793115298801-slang-formatting-sh-silently-skips-clang-format-wh.md),
[.hlsl tests gitignored; formatting.sh shim with `--cpp --modified`](../learnings/1793143062366-slang-tests-hlsl-files-are-gitignored-diagnostic-c.md)):

```bash
for f in $(git diff --name-only BASE..HEAD -- '*.cpp' '*.h'); do
  clang-format-17 --style=file "$f" | diff -q - "$f"; done
```

The same atoms record a coworker-runtime interaction worth knowing: after a codex OUTPUT_REVIEW
`approve`, **any** further edit — even a comment-only clang-format reflow — invalidates the
`### Attested` hashes and the `gate-critique-on-deliver` hook blocks the report send
[delivery-gate re-hash](../learnings/1788909076727-clang-format-17-present-but-not-symlinked-delivery.md).
The re-attest must be a **fresh `mcp__codex__codex` call with the canonical `/codex-critique`
block**: a `codex-reply` on the same threadId carries no developer-instructions, so the gate
prints "Critique round NOT recorded" and the block stands (this supersedes the older atom's
"`codex-reply` to re-attest" step). The working sequence is: edit → fresh codex OUTPUT_REVIEW →
commit and push so HEAD matches the reviewed worktree → then send
[codex-reply is not recorded](../learnings/1790692417192-formatting-sh-needs-a-clang-format-binary-name-shi.md).

## Distinguishing PR drift from pre-existing drift (version mismatch)

A locally pip-installed formatter can disagree with CI's pinned version and flag *unmodified
master* files. `gersemi==0.21.0` reports "would be reformatted" on pristine
`source/standard-modules/{neural,experimental}/CMakeLists.txt` — unchanged on master, and
master CI is green — because the local gersemi's lark version differs from CI's. A bare
`gersemi --check` verdict is therefore a false positive
[gersemi flags pristine master](../learnings/1788904511298-gersemi-0-21-0-flags-pristine-slang-master-normali.md).
Two things matter: invoke gersemi *faithfully* (the way `formatting.sh` does —
`--no-warn-about-unknown-commands --definitions <all cmake files>`, since without
`--definitions` it warns `unknown command 'glob_append'` from `cmake/Glob.cmake` and
misformats); and **normalize-and-diff** — `gersemi --in-place` a copy of the master version
and a copy of the head version with the same definitions, then `diff` the results. If the
only difference is the PR's intended additions, the PR introduces no drift of its own.
`formatting.sh` itself produces the same false positive when given one file:
`./extras/formatting.sh --check-only --cmake -- source/slang-core-module/CMakeLists.txt`
flagged 27 "would be reformatted" lines outside the PR's hunk, and the same lines show on
unmodified master. The script passes `--definitions "${files[@]}"`, so with a single file
gersemi never sees the custom commands in `cmake/*.cmake` (`slang_add_target` and others) and
reformats their calls as generic ones. The whole-tree `./extras/formatting.sh --check-only
--cmake` is what CI's `check-formatting.yml` runs, and it exits 0. So check CMake formatting
with the whole-tree run, or compare a single-file result against master
[single-file gersemi false diffs](../learnings/1791784450911-slang-formatting-sh-on-a-single-cmake-file-reports.md).
The same atom records an unrelated build trap: in a Linux ASan build
(`SLANG_ENABLE_ASAN=ON`) the ASan-built `slang-fiddle` fails the `.fiddle.stamp` step on
LeakSanitizer leaks, and `slang-capability-generator` can spin on
`AddressSanitizer:DEADLYSIGNAL` (ninja grew to about 9 GB). Build with
`ASAN_OPTIONS=detect_leaks=0`, as `ci-slang-sanitizer.yml:144` does, and with a timeout. The
same pattern applies to clang-format: pip `clang-format==17.0.6` reported a pre-existing
`#include`-order "violation" on `slang-end-to-end-request.cpp` that is identical on master.
**Never** run `formatting.sh --cmake --in-place` with a mismatched local gersemi and commit
it — it re-wraps pre-existing lines CI leaves alone and can make CI reject the result; let
CI's pinned formatter arbitrate. (For markdown/prettier, the analogous drift and its
scope-your-delta remedy are covered in the markdown/generated-docs page.)

## Backups and shared-clone scoping

Two more footguns bite during the mechanical work of formatting. First, the classic
revert-drill (`cp file /tmp/backup` → mutate → measure → `cp /tmp/backup file`) is **unsafe
once clang-format has run between the backup and the restore**: the backup holds the
pre-format text, so restoring it silently reintroduces unformatted code that `--check-only`
rejects — after you have "restored and verified". Restore from the git index instead
(`git checkout -- <path>`), and require an empty `git diff -- <path>` as proof the restore
was byte-exact
[stale backup, restore from index](../learnings/1786451954550-after-formatting-an-earlier-file-backup-is-stale-r.md).
That atom also flags a companion trap: a bare occurrence count (`grep -c isBeingChecked`
gave 2 vs 3) conflates your edits with the file's pre-existing content — locate occurrences
with `grep -n` before concluding a count difference means a lost edit.

Second, in a **shared base clone** where many fixers hold sibling in-flight work, an unscoped
`./extras/formatting.sh --cpp` reformats *every* changed C++ file in the worktree — pulling a
sibling's uncommitted edit under your name — and `git add -A` then stages it into your amend.
On slang#12633 this absorbed `prelude/slang-cuda-prelude.h` and a `tests/cuda/*` file from an
unrelated PR
[unscoped formatting + git add -A](../learnings/1787313410877-shared-base-clone-unscoped-formatting-sh-git-add-a.md).
The dangerous part is that the *wrong verification masks it*: a two-dot
`git diff --name-only origin/master..HEAD` can cancel the stray files out, showing a clean
4-file list while the commit actually holds 6. The authoritative checks are
`git diff --name-only HEAD^..HEAD` (the commit's true contents) and the three-dot
`origin/master...HEAD` (what GitHub's "Files changed" shows). Scope formatting to your own
files (run clang-format directly on them, or only touch what `--check-only` flags among
yours), avoid bare `git add -A`, and evict a stray file by restoring it to the commit's
parent (`git restore --source=HEAD^ ...`), never `git checkout origin/master -- <file>`
(origin/master may have advanced, reintroducing it as a spurious modification).

**Source learnings (18):**
- [clang-format for slang: 17.x ONLY (repo docs say 17-18 and are wrong) — install via venv](../learnings/1786381193362-clang-format-for-slang-17-x-only-repo-docs-say-17-.md) — The `[17,18)` bound, the PEP-668 venv install, and two positive-control traps (`--check-only` exit 0 masks a silent no-op; type flags narrow the file set to 5 extensions).
- [formatting.sh --check-only exits 0 when its tools are missing — a green that checked nothing](../learnings/1786424195348-formatting-sh-check-only-exits-0-when-its-tools-ar.md) — On slang#12454 all four formatters were absent; the grep-for-missing-tool-lines gate, plus the same-session `xxd`-missing false negative.
- [slang formatting.sh --check-only EXITS 0 WHILE CHECKING NOTHING — and pip clang-format vanishes across a restart](../learnings/1786424384200-slang-formatting-sh-check-only-exits-0-while-check.md) — Two-container measurement; the require-both-exit-0-and-zero-missing gate; the `[17,18)` bound; the install disappearing later the same day.
- [After formatting, an earlier file backup is STALE — restore from the git index, not /tmp](../learnings/1786451954550-after-formatting-an-earlier-file-backup-is-stale-r.md) — The revert-drill breaks once clang-format runs between backup and restore; use `git checkout --` + empty-diff proof; bare occurrence counts conflate your edits with existing code.
- [clang-format 17 via pip when absent from container](../learnings/1786540878336-clang-format-17-via-pip-when-absent-from-container.md) — PyPI wheel is a real LLVM binary; npm package ships v15 which rejects the repo `.clang-format` (`PackConstructorInitializers: NextLineOnly`); `pip --target` keeps it workspace-local.
- [Shared base clone: unscoped formatting.sh + git add -A absorbs sibling files](../learnings/1787313410877-shared-base-clone-unscoped-formatting-sh-git-add-a.md) — Two-dot diff masks stray files; verify with `HEAD^..HEAD` / three-dot; evict via `git restore --source=HEAD^`, never `git checkout origin/master --`.
- [formatting.sh --check-only exit code is masked when piped to tail/head](../learnings/1788327088692-formatting-sh-check-only-exit-code-is-masked-when-.md) — `$?` after a pipe is the last stage's; a real clang-format comment-reflow diff slipped through; capture exit directly or `set -o pipefail`.
- [formatting.sh aborts when gersemi wrapper is broken — reinstall it](../learnings/1788370836461-formatting-sh-aborts-when-gersemi-wrapper-is-broke.md) — A broken `/workspace/agent/bin/gersemi` shim gives a misleading exit-1; reinstall via pip; symlink `clang-format-17`; a `.slang`-only change needs no formatter but still a clean exit.
- [gersemi 0.21.0 flags pristine slang master — normalize-and-diff to isolate the PR's true CMake delta](../learnings/1788904511298-gersemi-0-21-0-flags-pristine-slang-master-normali.md) — Local lark mismatch flags unchanged master; pass full `--definitions`; format-both-and-diff; don't commit an `--in-place` reflow from a mismatched tool.
- [clang-format-17 present but not symlinked; delivery-gate re-hashes after comment reflow](../learnings/1788909076727-clang-format-17-present-but-not-symlinked-delivery.md) — Binary at `/usr/bin/clang-format-17` unsymlinked → false "needs clang-format"; run directly; a comment >100 cols fails CI; a post-approve edit re-arms the codex attest gate.
- [clang-format-17 present but bare clang-format absent — formatting.sh silently skips C++ (slang-fixer container)](../learnings/1788947866097-clang-format-absent-but-clang-format-17-present-ba.md) — recurs across prod containers; run `clang-format-17 -i --style=file`; bare no-args no-ops; gersemi/shfmt also absent, prettier present.
- [formatting.sh needs a bare `clang-format` name — shim clang-format-17 via a /tmp symlink; codex-reply rounds are not recorded by the critique gate](../learnings/1790692417192-formatting-sh-needs-a-clang-format-binary-name-shi.md)
- [extras/formatting.sh exits 0 without formatting when only clang-format-17 is installed (#13332)](../learnings/1790719063408-extras-formatting-sh-exits-0-without-formatting-wh.md) — shim or per-file `clang-format-17 --style=file | diff -q`; `--check-only` rc 1 from missing gersemi/shfmt
- [slang-test from a -bindir binary copy fails ~31 CUDA/OptiX tests](../learnings/1790714053699-slang-test-from-a-bindir-binary-copy-fails-31-cuda.md) — formatting aside: bare `formatting.sh` prints usage and exits 0; keep scratch out of `/tmp`
- [slang formatting.sh on a single CMake file reports false gersemi diffs; use the whole-tree --cmake run](../learnings/1791784450911-slang-formatting-sh-on-a-single-cmake-file-reports.md) — `--definitions` gets only the one file; ASan builds need `ASAN_OPTIONS=detect_leaks=0`
- [Slang: ./extras/formatting.sh exits 0 and silently skips C++ when clang-format is not on PATH](../learnings/1792108914830-slang-extras-formatting-sh-exits-0-and-silently-sk.md) — fleet containers have only `/usr/bin/clang-format-17`; #13679 shipped an unformatted hunk; shim fix; an empty file list makes `clang-format --dry-run` read stdin forever
- [slang formatting.sh silently skips clang-format when only clang-format-17 is on PATH](../learnings/1793115298801-slang-formatting-sh-silently-skips-clang-format-wh.md) — `>/dev/null 2>&1` hid the skip; #13880 failed check-formatting on one long line; shim or `clang-format-17 --dry-run --Werror`
- [Slang tests: .hlsl files are gitignored; diagnostic carets align to the call paren](../learnings/1793143062366-slang-tests-hlsl-files-are-gitignored-diagnostic-c.md) — formatting aside: shim then `formatting.sh --cpp --modified`
