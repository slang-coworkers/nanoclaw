---
type: chain
title: slang#14190 / #14191 / #14192 / #14193 — side bugs from the #14183 CPU Atomic<T> chain
description: BOT-filed 2026-11-02 ~15:17–15:58Z by the #14183 slang-triager (the fixer found them; the triager reproduced, deduped and filed them). MAINTAINER-OWNED since 11-02 18:14–18:21Z (jkwak-work self-assigned all four, milestone Q1 2027). Fixer go/no-go withdrawn 11-04; no bot work, no timer. Their issue_opened webhooks need NO dispatch.
tags: [cpu, llvm, capabilities, atomics, bot-filed, filed-only, maintainer-owned]
---

# slang#14190 / #14191 / #14192 / #14193 — #14183 side bugs

**Origin.** The #14183 slang-fixer (`sess-1793627606743-nurj2k`, draft PR #14189) found them. The #14183 slang-triager
(`sess-1793626511071-fu0jn0`, thread `gh-issue-shader-slang/slang-14183`) reproduced, deduped and filed each one under
[the filing policy](../orchestrator/filing-verified-issues-policy.md), with codex OUTPUT_REVIEW. It reported at 15:24Z (msg 24).
I checked all three live at 15:26Z: author `app/nv-slang-bot`, OPEN, label `reproduced`, Type Bug, no @-mentions, no
Fixes/Closes link. Each body mentions #14183 as its source.

- **#14190**: property and `__subscript` accessors don't enforce capability requirements on any target. This covers a
  `[require]` on the getter and requirements inferred from the getter body; a `[require]` on the property itself works. This
  is how `Atomic<T>.load` inside a getter reaches the cpp emitter. Front-end hole, every target. The triager rates it most valuable.
- **#14191**: on LLVM CPU targets (`llvm-ir`, `host-object-code`), every `Atomic<T>` extension method aborts with E99997
  (slang-emit-llvm.cpp "TODO: atomics").
- **#14192**: on CPU, `AppendStructuredBuffer.Append`/`ConsumeStructuredBuffer.Consume` fail with E99999 (cpp) or E41403 (llvm),
  with no source location, although their `[require]` includes cpp and llvm. It can't be fixed in #14189. Two design options
  are in the body: lower via the `_slang_atomic_add` prelude helpers, or drop cpp/llvm from the `[require]`.
- **#14193** (filed ~15:58Z, from the #14189 R1 reviewer's finding S2, relayed by the fixer): the default formatter drops the
  span message of a diagnostic that has no location (`slang-rich-diagnostics-render.cpp:895-927`: `hasValidLocation` also
  skips `renderOrphanedLabels`). Reproduced on master with `-target llvm-ir` E41403. It is #14137's option B1; the reporter's
  PR #14147 doesn't fix it. I checked it live at ~16:00Z: bot, `reproduced`, Bug, no @-mentions, no Fixes link, refs #14137 and #14147.
  Its issue_opened reached the sibling Main session `9xigbj`; it needs no dispatch.

**State: filed-only, fan-out held.** No fixer chain without the operator's OK. The issue_opened webhooks reached sibling Main
sessions (`gd4cm2` #14190, `u2kleu` #14191, `uyk7mo` #14192); none of them needs a dispatch. The #14183 Main session
(`3oaflr`) asked the operator once for all three.

At ~16:00Z I added #14193 to the same operator ask and to the re-check `recheck-14190-92-operato-3d5d`.

## 11-04 re-check (`recheck-14190-92-operato-3d5d`, 15:30Z): maintainer-owned, ask withdrawn

- **GitHub:** all four are OPEN with label `reproduced`, 0 comments and no linked PR. The timeline shows that jkwak-work
  **assigned themself and set milestone Q1 2027 (Winter)**: #14192 at 18:14Z, #14191 at 18:15Z, #14193 at 18:21Z and #14190 at
  18:21Z, all on 11-02. That is the same sweep as #14162, #14173, #14174, #14181 and #14143.
- **Operator:** I read the dashboard session from seq 509952 (11-02 06:24Z) to 510802 (11-04 15:30Z). There was no answer on any
  of the four after the 15:26Z ask (row 510114) and the 16:00Z addendum (row 510120).
- **Action:** I followed the #14162 and #14173 precedent: no reminder, and I **withdrew the go/no-go** in one combined message to
  orchestrator-dashboard (msg 9, 11-04 15:3xZ). I dispatched no fixer.
- **State:** maintainer-owned and filed-only, with **no timer**. Bot work resumes only on an @nv-slang-bot mention or a maintainer
  comment; a webhook will deliver either.
