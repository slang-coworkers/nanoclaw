---
name: project_12404_slang_package_tool_maintainer_owned
description: "slang#12404 `slang package`/`pkg` Git-backed module deps — TRIAGED maintainer-owned, verdict cmt 5208103219, NO fixer. Two design 'open questions' were already answered in-tree: the dispatcher exists (#10621, v2026.5.1+) and dot→slash import sugar serves a hierarchy. 3 latent defects found. My brief carried 2 errors."
metadata:
  node_type: memory
  type: project
  originSessionId: sess-1786037800083-onan60
---

# slang#12404 — `slang package` / `slang pkg` for Git-backed module dependencies

Author **jhelferty-nv** (MEMBER), filed 2026-08-06T17:36:31Z, **self-assigned**, Type `Feature`,
milestone Q3 2026 (Summer), labels `Dev Opened` + `Infra`. Webhook → dispatched slang-triager on
`gh-issue-shader-slang/slang-12404`; report back 18:16Z.

## Verdict (theirs, posted by them per closest-to-the-state)

**MAINTAINER-OWNED design decision — not bot-actionable as a whole. No fixer dispatched.** Open for a
human: manifest format, lockfile format, cache/materialization layout, package dir names,
implementation form (C++ in-tree target vs script).

Artifact = **cmt 5208103219** (`nv-slang-bot[bot]`, 18:12:07Z, 5 bullets, 1 disclaimer, `created ==
updated`, comments 0→1). I re-verified independently: 23 load-bearing fragments present, **0**
HTML-escaping, zero-control 0. **Issue live at 18:2xZ: `state=open`, `comments=1`.**

## What I VERIFIED myself, from an independent copy (not relayed)

All at `d7d59f374`, GitHub contents API — not the shared clone.

- **The `slang` dispatcher exists and needs zero changes for `slang package …`.** `main.cpp:484` →
  `delegateToExecutable(..., nullptr)` → `:327` builds `toolName = "slang-" + name`, `:298`
  `findExecutableInDir(ctx->binDir, toolName)`. Every cited line number checks out (66/77/89/94/298/
  325/484). `slang-package` absent in-tree (0 paths; control: 3 `slang-dispatcher` paths).
- **`pkg` is not in the builtin table** — `kBuiltinSubcommands` (`:66-77`) holds exactly
  compile/interpret/help/version. So `slang pkg` looks for `slang-pkg`.
- **PATH is genuinely not searched.** `findExecutableInDir` is the *only* lookup; no `getenv`/`"PATH"`
  anywhere (the 2 `environ` hits are `posix_spawn`'s env passthrough at `:18`/`:245`). #10621's body
  line 19 says *"in the same directory as the `slang` executable, **or on the system path**"* — **the
  prose is wrong, or the feature is missing.** Maintainer call.
- **`//TEST:DISPATCHER` = 1 case tree-wide.** `tests/dispatcher/smoke.slang`, `version` only; category
  registered `slang-test-main.cpp:4597`.
- **v2026.5.1 containment, by must-miss control:** merge sha `d11dc42c8a`; `v2026.4.2` → `ahead`,
  `v2026.5` → `ahead`, **`v2026.5.1` → `behind`**, `v2026.5.2` → `behind`. First release is v2026.5.1.
- **Dot→slash import sugar is real and is the PARSER.** `slang-parser.cpp:1341-1352`, comment *"We
  allow a dotted format for the name, as sugar"*, appends `/` per Dot. `-I` search is flat
  (`slang-include-system.cpp:124-136`, depth 1). ⇒ one `-I` root serves a hierarchy **iff** imports are
  dotted.
- **IR-before-source is real.** `slang-session.cpp:1586-1594`: language server tries Source then IR;
  **everything else tries IR then Source** (*"Look for a precompiled module first"*). Staleness escape
  at `:1875-1881` — *"If the module's own source file is unavailable, we can't prove staleness, so fall
  back to accepting the standalone precompiled module."* ⇒ a stale `.slang-module` in a materialized
  tree shadows freshly checked-out source.
- **F5's published NEGATIVE (dispatcher undocumented) HOLDS, verified with a must-hit control.** Fetched
  all 29 `docs/user-guide/*.md` + `command-line-slangc-reference.md` + `building.md`; word-bounded
  `slang (compile|interpret|help|version|package|pkg|format)` → **0**; control `slangc` → 10 of 29
  user-guide files non-zero. The one `building.md` hit is `SLANG_ENABLE_SLANGI`, unrelated.
- **#5526** — 243-char body, **1** comment (csyonghe 2024-11-20, "essential … no concrete timetable").
  **#7840** "Conan package manager support" — Ideas, 3 comments, expipiplus1 + jkwak-work + karel-tomanec;
  inverse direction (ship the *compiler* via Conan). Bogus-number control → NOT_FOUND.

## ⛔ MY BRIEF CARRIED TWO ERRORS — both the class already in this store

1. **`LABELS=(none)`** — true at the webhook instant, false 60 s later; the author set
   milestone/assignee/Type/label himself. This is
   [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]] instance **5**, and the same
   *dispatch-side* variant as instance 4 (#12398's retitle): a decaying field quoted into a brief is a
   stale read planted in someone else's head, laundered into fact by the transport. The webhook payload
   is a snapshot **of the filing instant**, and on a self-triaging author's issue it is stale within a
   minute.
2. **"#5526 … may already carry maintainer positions on manifest/layout"** — false; it carries a
   position *in principle only*. I also missed **#7840** entirely. ⇒ a hypothesis in a brief must be
   labelled as one; this one was, and the triager correctly refuted it rather than inheriting it.

## Aperture differences that are NOT defects (checked, so nobody re-litigates)

- Their "7166 chars" vs my 7219-byte file: **7166 = codepoints** (jq `length`), 7218 = UTF-8 bytes
  (18 `—`, 3 `·`, 3 `→`, 2 `…`, 1 🤖), +1 trailing newline. Same artifact.
- codex's `41 import` vs their `26`: case-insensitive vs case-sensitive. Controls only; no conclusion moved.

## Two bounded slices — offered, NOT taken

(a) `pkg` → `slang-package` builtin alias + dispatcher tests. **Note for whoever takes it — CONFIRMED BY
EXECUTION, not code read** (triager ran a compiled argv[0] probe + direct-invocation control after its
first `#!/bin/sh` stub gave a void result): `toolName` comes from `extra`, but `argv0` is *always*
`"slang-" + name` (`:325-327` → `:292` → `posix_spawn` `cargs[0]`). Measured — `compile` ⇒ launches
`slangc` with `argv[0]="slang-compile"`; `package` ⇒ `argv[0]="slang-package"`; `pkg` ⇒
`argv[0]="slang-pkg"`; control `./slangc` ⇒ `argv[0]="./slangc"`. So a `{"pkg", …, "slang-package"}`
entry launches `slang-package` telling it it is `slang-pkg`. **Decide that's intended before copying the
pattern** — a tool branching on `argv[0]` would see the alias, not its own name.

⚠️**But scope the concern honestly: no shipped tool branches on argv[0]'s NAME.** I checked both
delegation targets. `slangc/main.cpp:103` passes `argv[0]` to
`TestToolUtil::setSessionDefaultPreludeFromExePath`, which uses it as a **path** —
`_getCanonicalOrExecutablePath` (`source/core/slang-test-tool-util.cpp:116-142`) tests `Path::hasPath()` (= "contains
a separator", `slang-io.h:130`) and, for a bare name, **falls back to `Path::getExecutablePath()`**, i.e.
the OS answer, ignoring argv[0] entirely. `slang-pkg` has no separator ⇒ fallback path ⇒ correct prelude
root regardless. `tools/slangi/main.cpp:178` parses from `i = 1`, never reading argv[0]. ⇒ the argv0
mismatch is a **latent contract wart for future tools**, not a live bug in either target.
(b) Document the dispatcher + its external-tool contract (sibling-dir-only lookup).
Whether to *add* PATH lookup is the maintainer call, since prose and impl disagree.

⚠️`extras/formatting.sh` cannot run in the triager's container (gersemi/clang-format/prettier/shfmt
absent) — any PR author must run it elsewhere.

## Instrument lessons from this exchange (both parties, one message apart)

Filed as [[feedback_a_probe_that_cannot_observe_the_subject_returns_a_confident_value]] — a probe blind to
its subject returns a plausible value, and both near-misses here were aimed at **contradicting a peer**:
my `git status` on a per-group mount (would have refuted a TRUE dirt report) and their `#!/bin/sh` stub
printing `$0` (would have refuted a TRUE argv0 claim). Nothing reached GitHub: `argv0`/`slang-compile`/
`shebang` all grep **0** in cmt 5208103219 (non-zero control `slang-package` = 5), and the body is
**byte-identical** to my 18:2xZ read with `created == updated`, so no public correction was owed.

## RESUME

jhelferty-nv answers a design question (manifest/lockfile/layout/impl form) **or** says "make a PR" →
then release `slang-fixer` for a **DRAFT** PR, slice (a) or (b) first, `pr: non-breaking`. Re-open on any
fresh substantive human comment. Related: [[feedback_group_clone_is_shared_by_all_sibling_sessions]]
(the dirty-tree report that arrived with this memo, acted on for #12330 —
[[project_12330_entrypoint_throws_not_diagnosed]]).
