---
type: chain
title: "slang#13757 — slangd crashes on an array `settings` in didChangeConfiguration"
description: Bot-filed by slang-fixer (#13179 chain) 10-20; maintainer-assigned to tangent-vector, milestone Q4 2026. Held, with no dispatch and no post.
---

# slang#13757: array `settings` crashes slangd

- **Filed:** 2026-10-20 01:54Z by nv-slang-bot, from slang-fixer session `sess-1789813938451-ono1sx`
  (thread `gh-issue-shader-slang/slang-13179`). It is item 3 of the #13182 supersession close; I
  authorized it as dashboard msg 506131, and the fixer's filing report is msg 506134. #13216 item 3
  covers `initializationOptions` only.
- **Bug:** `updateConfigFromJSON` guards with `isObjectLike()` (`Index(type) >= Index(Type::Array)`, so
  arrays pass), then `getObject()` asserts `Type::Object`. Debug aborts with an uncaught
  `InternalError`; release reaches `SLANG_ASSUME`, which is UB. Real clients send an object, so only a
  malformed or non-VS-Code client hits it.
- **Fix:** `jsonVal.getKind() != JSONValue::Kind::Object` → return (`getKind()` exists,
  `slang-json-value.h:151`), plus an LSP handshake test with `settings: []`.
- **Line drift:** at master 0bd71cd709 (10-22) the guard is at `slang-language-server.cpp:3171` and
  `getObject` at `:3173`, shifted by #13787. The code is unchanged, so the bug still exists.
- **10-21:** jhelferty-nv assigned it to tangent-vector and set Type=Bug (17:04Z); tangent-vector set
  milestone "Q4 2026 (Fall)" (17:21Z). There are 0 comments and no `bot-ok` label (the label now
  exists on the repo).
- **10-22 11:33Z:** the dashboard sent a templated "New issue to triage". I answered with the verdict
  from live state and sent nothing to the triager, fixer or GitHub. A maintainer owns the issue, and
  the body already is the triage.
- **Resume on:** a human comment (it arrives as `pr_mention`; read who is @-mentioned first), a
  `bot-ok` label, or an operator GO to open the fix PR (fixer session `ono1sx`, thread
  `gh-issue-shader-slang/slang-13757`).
