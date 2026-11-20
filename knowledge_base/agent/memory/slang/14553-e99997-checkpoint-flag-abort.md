---
type: chain
title: slang#14553 — Debug slangc aborts (E99997, slang-emit-c-like.cpp:108) with -report-checkpoint-intermediates
description: BOT-FILED 11-17 16:16Z as a side-find of the PR #14525 review chain (#14518), per the filed-only policy. Do NOT dispatch triage/fixer on its issue_opened — that is the operator's call.
tags: [debug-abort, emit, checkpoint, filed-only, side-find]
---

# slang#14553 — Debug slangc E99997 abort on -report-checkpoint-intermediates

**BOT-FILED 11-17 16:16Z by slang-fixer** (chain
[slang#14518](14518-parse-diagnostic-util-rust-style.md), surfaced during the PR #14525 round-2 review,
reproduced before filing). **Filed-only per the filing policy: any triage/fixer start on it is the operator's
call. Its `issue_opened` webhook is a self-echo — do NOT dispatch a triage chain.**

**Bug.** Debug slangc aborts `error[E99997] ... assert failure: slang-emit-c-like.cpp(108)` on a trivial
compute shader with `-report-checkpoint-intermediates`; the multi-line "For assistance" continuation is the
shape the #14525 parser work (multi-line header buffering) was tested against. Release builds unaffected
(reports `note: no checkpoint contexts to report` normally). **Scope correction vs the review's original
claim:** `-report-perf-benchmark` is CLEAN on the same Debug build — the trigger is specific to the
checkpoint-reporting flag.

**Provenance.** Repro sha 529c20fc7 (the #14525 head); `source/slang` diff vs master 818012112 verified
0-line for the involved file (i.e., pre-existing on master, not introduced by #14525). PR-#14525 provenance
stated in the body; bot disclaimer attached. No assignee/label/chain. Dup-check clean (open E99997s are
unrelated triggers).

**State:** filed + reported to the operator (dashboard, 16:2xZ). Awaiting operator/maintainer attention;
no bot chain on it.
