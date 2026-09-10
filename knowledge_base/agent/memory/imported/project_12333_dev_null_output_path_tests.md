---
name: project_12333_dev_null_output_path_tests
description: "#12333 `-o /dev/null` tests can pass on a failing compile. Three ordered PRs: #12334 (test cleanup -o /dev/null → -o -, APPROVE_WITH_NITS, draft) · #12414 (FileStream null-device write, draft) · #12717 (slang-test reject absolute -o paths, draft, held pending human review, latest). ⚠️the 'Windows-only' premise is FALSE — binary targets fail on Linux too (getPathType rejects char devices before fopen). Live chain; see CONTROLLING STATE."
metadata:
  type: project
  originSessionId: 6cb5ba36-0d3a-4bd6-a56f-0e0eb4c9f5b1
---

# #12333 — `-o /dev/null` in tests is invalid and can pass on a failing compile

> ⚠️ **CONTROLLING STATE — as of 2026-08-25.** A maintainer (jkwak-work) reframed the direction three
> times; **each reframe SUPERSEDES, it does not stack — drive the latest, archive the rest.** Three
> ordered PRs, all draft, all held pending human review:
>
> - **#12717** (latest) — *"slang-test: reject absolute `-o` / `-separate-debug-info-output` paths in
>   test directives"*, head `5dbb25cdb`, `pr: non-breaking`, 4 files +296/−21
>   (`slang-test-main.cpp` + `test-output-path-util.{cpp,h}` + `unit-test-slang-test-output-path.cpp`).
>   Reworked after a peer **REQUEST_CHANGES** caught that a blanket absolute-`-o` reject would break the
>   whole nightly `/dev/null` corpus (~hundreds of files under `docs/generated/tests`). Fix: a
>   **host-specific null-device EXEMPTION** (`/dev/null` on POSIX, `NUL` on Windows), NOT a blanket
>   reject. Investigation widened the guard from `-o` to also `-separate-debug-info-output` — and the
>   fixer **named the widening rather than doing it silently**, as asked.
> - **#12414** — *"Allow FileStream to write to the null device"* (`4881fffa60`, `pr: non-breaking`,
>   2 files +157/−4). The root-cause producer fix. Formatting UNKNOWN until ready-flip (see below).
> - **#12334** — test cleanup, `-o /dev/null` → `-o -` + pin `result code`, `APPROVE_WITH_NITS`, draft.
> - ⚠️ **SEQUENCING: #12334 must land FIRST.** The #12717 exemption is host-specific, so on the Windows
>   every-PR leg `/dev/null` is (correctly) not exempt, so any standard-suite file still using
>   `-o /dev/null` is rejected until #12334 converts it to `-o -`.
> - **Design point left to the maintainer:** exempt `/dev/null` vs *translate* it to `NUL` — translation
>   was #12414's abandoned direction, so the fixer chose exemption and offered override. Do not silently
>   re-adopt a closed approach.

## The bug (the "Windows-only" premise is FALSE — mine-verified end to end)

`-o /dev/null` fails for **binary** targets on **every** platform, not just Windows; **text** targets
(`spirv-asm`, `hlsl`, `glsl`, `metal`, `cuda`, `cpp`) succeed. It looked Windows-only only because all
three #12334 tests use `spirv-asm`, a text target.

- The **text** branch (`slang-artifact-output-util.cpp:217-219` → `writeAllTextIfChanged` →
  `writeNativeText`) calls `fopen_s(...,"w")` directly and never consults `getPathType` — that is *why*
  text targets succeed: they bypass the check.
- The **binary** branch reaches `FileStream::_init` (`slang-stream.cpp:~86`), which does
  `if (File::exists) → Path::getPathType → if (pathType != SLANG_PATH_TYPE_FILE) return
  SLANG_E_CANNOT_OPEN` before any `fopen`. `Path::getPathType` (`slang-io.cpp:641`) recognises only
  `S_ISDIR`/`S_ISREG`; `/dev/null` is a **character device** ⇒ falls through to failure. Both platform
  branches are written the same way — **we refuse a path the OS would accept** (`fopen("/dev/null","w+b")`
  succeeds). The separate `// PREFIX: result code = N` mechanism the issue relies on is real
  (`slang-test-main.cpp` appends `result code = ` at `:1876`/`:3754`).

## The root-cause fix and its ABI constraint

The guard's own comment says *"not a directory"* but the code rejects *"not a regular file"* — they
differ exactly on char/block devices, FIFOs, sockets. ⛔⛔ **Do NOT add a `SLANG_PATH_TYPE_*`
enumerator** — `SlangPathType` (`include/slang.h:1724-1729`) has exactly two enumerators, no sentinel,
and is returned by `ISlangFileSystemExt::getPathType` (a public COM vtable, `:1853`), so a new value is
an ABI break; the cheap-looking fix is the breaking one. #12414 instead matches the null device by
**device identity** (`st_rdev` equality vs `stat("/dev/null")`, so symlink aliases work) + `NUL`
case-insensitively — **naming the safe member, not accepting the type class** (see lessons).

## Top transferable lessons (the durable yield)

- ⭐⭐⭐ **A maintainer reframe supersedes, never stacks** — a 3× reframe (Windows-map → all-platform
  accept → test-time reject) is normal exploration.
- ⭐⭐⭐ **A test matrix derived from the fix's own story systematically omits the cases that refute it.**
  Neither `mkfifo` nor `/dev/full` was on the original 4-case matrix, and both caught real defects —
  they came from OUTSIDE the fix's story (blast-radius question; chasing a reviewer's mechanism). Ask:
  *what does this change now ACCEPT that it previously refused, and which member of that new set behaves
  worst?*
- ⭐⭐⭐ **NAME THE SAFE MEMBER; DO NOT ACCEPT THE TYPE CLASS.** "Let the OS decide" HANGS on a FIFO
  (rc=124); "any character device" accepts `/dev/full`, which `fwrite`-buffers and returns rc=0 for
  never-written output — the exact silent-success this issue exists to eliminate. Only the null device
  guarantees *write discarded* AND *reported as succeeding*.
- ⭐⭐⭐ **My reasoning shape, hit 5× this chain: every premise true, the inference false** — set-member
  →set · necessary→sufficient · arm-reachable→reached · matches→files · line-changed→line-reached. A
  `file:line` citation authenticates the LOCATION, never the SCOPE of the claim built on it; a fix must
  be traced from the function's entry to the edit (my one-line fix was a NO-OP because
  `SLANG_RETURN_ON_FAIL` returns on the line *above* my edit — `getPathType` returns `SLANG_FAIL` for a
  char device, so `pathType` is never written).
- ⭐⭐⭐ **A run id's `conclusion` MUTATES IN PLACE across attempts** — same id, attempt 1 `failure` /
  attempt 2 `success` ~12h later. "I already measured this run id" is not grounds to trust a cached
  reading. **A stale PESSIMISTIC CI claim never gets re-checked** (a stale optimistic one is challenged
  instantly), so state CI findings with an expiry: timestamp + FULL sha + run id + `run_attempt` +
  non-skipped count + real-build-job count. Never bare "CI is unconfirmed."
- ⭐⭐ **`/commits/<sha>/check-runs` returns the CUMULATIVE aggregate across all runs on that head** (a
  red X can be pure history) and **pages at 30** (a 36-run suite reads as 30) — key on the webhook's
  `check_suite.id`, and pass the FULL 40-char sha to `head_sha=` (an abbreviated sha returns a silent
  `total_count: 0`). `search/code`'s `total_count` counts MATCHES, not files — paginate for a file count.
- ⭐⭐ **SILENCE THAT INVITES A WRONG INFERENCE IS ITSELF A DEFECT** — the fixer added a formatting
  disclosure though its PR body made no formatting claim, because two silent instruments
  (`extras/formatting.sh` **exits 0 while saying it cannot run** — no `clang-format` in-container — and
  `check-formatting` is `skipped` on drafts) let a reviewer ASSUME the check happened. Worth a report to
  the operator if the repo-wide gate recurs: it mis-certifies every bot PR.
- ⭐⭐ **A held-provenance echo isn't a zero-dispatch echo when a human commissioned it** — bot-authored
  describes the typist, not the originator; check whether a human asked before applying the echo rule
  ([[project_12320_coverage_macos_segfault_base_rate]] contrast).

## RESUME

🔵 **CHAIN STATE:** three PRs all draft, all held pending human review; #12334 must land first. Nothing
new to dispatch on a bot echo. Resume triggers, in order: (1) #12717 review/merge; (2) once #12414
lands, re-derive what null-device policy still needs (may reduce to a docs change); (3) #12334
review/merge; (4) **Gap 1 unfiled** — `docs/generated/tests/_meta/prompts/_common.md:881-885` still
*mandates* `-o /dev/null`, and the nightly corpus (`nightly-slang-test.yml:137`, ubuntu) runs it, so the
portability bug is latent there; `regenerate.py lint` (`lint_bundle` @`:1147`) has no `/dev/null` check.
Filing it against #12333 is the reasonable path but needs a maintainer nod (the don't-file-unilaterally
rule that bit #12219). Do NOT re-dispatch on further bot echoes.

Related: [[project_11917_pass_gating_epic]],
[[feedback_search_code_total_count_is_not_a_file_count]],
[[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[slang-evidence-lessons-index]],
[[project_approver_pipeline_defects_devin_fetch_ci_green]].
