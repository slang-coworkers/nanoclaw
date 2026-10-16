---
type: chain
title: slang#13662 — slang-wasm loadModuleFromIRBlob + Module.serialize
description: "albertrodriguezclo, human-filed feature request: wasm bindings expose only Session.loadModuleFromSource; asks for Session.loadModuleFromIRBlob(name, path, Uint8Array) and Module.serialize(): Uint8Array. Dispatched to slang-triager 10-15 17:0xZ."
---

# slang#13662

**2026-10-15 17:0xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, assignee jkwak-work (set 16:59:42Z, ~40 s after creation), human-filed by albertrodriguezclo
(same reporter as the #13631–#13662 batch). The only session on `gh-issue-shader-slang/slang-13662`
was this Main webhook session. `gh search` found no duplicate ("loadModuleFromIRBlob wasm",
"slang-wasm serialize module", "wasm precompiled module", "slang-wasm loadModule").

Orchestrator receipt at master 6597ec9202: the only module-loading binding is
`loadModuleFromSource` (`slang-wasm-bindings.cpp:26-27`, impl `slang-wasm.cpp:120`); no IR-blob or
serialize binding exists. Related: sibling wasm-API ask [#13642](13642-slang-wasm-createsession-options.md)
(parked on maintainer API shape), and native-side history #6557 (`loadModuleFromIRBlob` digest
mismatch from `UseUpToDateBinaryModule`, PR #12068) — relevant to the version/compat caveat.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13662`.

**Resumes on:** the triager's [Triage] report, or a human comment.

**17:02Z, triager progress (msg 8):** researching the wasm bindings and the native IR-blob/serialize paths
(3 subagents). Not a report. No reply sent.

**17:14Z, [Triage] (msg 10, memo `/workspace/inbox/a2a-1792084484360-97f4n9/triage-13662.md`).** Feature / low /
slang-wasm JS bindings / P3. The triager set Issue Type to Feature; no `reproduced` label. Findings:
- **Duplicate #8744** ("Web/WASM: Enable loading IR binary modules", brussig-tud, 2025-10-17, OPEN). My dedup
  missed it. My queries returned a real no-match, not a dead instrument: `wasm` alone returns rows, and
  `loadModuleFromIRBlob` alone returns #8744. Adding a second term ANDed it out. Lesson: search the distinctive
  API identifier **alone** first.
- **Reporter PR #13663** @acfe8338 (16:59:19Z, non-draft, `Fixes #13662`, +112, 4 files: bindings/.cpp/.h +
  `tests/wasm/smoke/smoke-test.js`). It is approach A (thin bindings, `RawBlob::create` in, JS-owned `Uint8Array` out).
  The triager read the diff only (no emsdk here). Nits: null `bytes` throws a JS exception (CodeRabbit), a failed
  `serialize` leaves `g_error.message` empty, and import resolution against already-loaded names is undocumented.
- No compiler change is needed. wasm already deserializes the embedded core module (`slang-api.cpp:186-196`).
  #6557/#12068 is not on the wasm path because wasm sessions set no `UseUpToDateBinaryModule`.
- #13642 is independent, but #13651 and #13663 textually conflict in `smoke-test.js`.

Verified live by me at 17:2xZ: #8744 (title, author, OPEN, 2025-10-17); #13663 (OPEN, non-draft, `Fixes #13662`,
+112/4 files, no labels); Issue Type = Feature; 0 issue comments; assignee jkwak-work. On the PR head, `CI`/format/
REUSE/PR-Maintenance are `action_required` (fork approval), and Claude PR Review + SlangPy have run. The triager's
re-check session `system:tasks:t-ea7eeb` exists (10-22 15:00Z), so I did not add a duplicate Main one-shot.

**Disposition:** watch-only on #13663, no fixer, no bot PR (same as #13643/#13648). The issue post is suppressed
(the PR carries the trail). The triager's 5-bullet draft is held: **no GO**, pending an operator GO-issue call,
consistent with #13643. Batch-wide fact flagged to the operator: 4 reporter PRs (#13646, #13648, #13651, #13663)
all sit at fork-CI `action_required`.
**Resumes on:** #13663 merge/close/review, a human comment, t-ea7eeb, or an operator GO.

**17:20Z, triager ack (msg 24):** the draft is held until an explicit GO, and t-ea7eeb is unchanged. The held draft already
links #8744 as a duplicate, so on an operator GO it posts as is. Waiting on the operator's GO-issue answer.
