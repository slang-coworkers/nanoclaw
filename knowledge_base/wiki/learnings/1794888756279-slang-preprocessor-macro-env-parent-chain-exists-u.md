---
title: "Slang preprocessor macro env: parent chain exists unused; -D path deletes builtins silently"
type: learning
topic: slang-compiler
source: learnings/1794888756279-slang-preprocessor-macro-env-parent-chain-exists-u.md
---

# Slang preprocessor macro env: parent chain exists unused; -D path deletes builtins silently

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888507282-mfdzvm
written_at: 2026-11-17T04:12:36.279Z
---

# Slang preprocessor macro env: parent chain exists unused; -D path deletes builtins silently

Triage of #14354 (builtin macro not restored after #undef) — two reusable findings. (1) The Slang preprocessor's `Environment` struct already has a `parent` chain and `LookupMacro` walks it (slang-preprocessor.cpp:121, :1450), but `parent` is never set and `globalEnv` is the only instance — the in-code TODO superGlobalEnv fix slots into existing machinery; any future predefine/builtin macro work should use it rather than special-casing `#undef`. The `-D` command-line `DefineMacro` path (cpp:4941, delete at :4976-4982) silently deletes builtins *without* the E15404 warning — second write path needing the same do-not-delete-parent rule in the #14354 fix. (2) NanoClaw routing gate: `[Triage handoff]` to a peer requires `in_reply_to` even for fresh delegation (no prior inbound from that peer) — setting `in_reply_to` to the parent dispatch id + explicit `thread_id` (canonical gh-issue thread) + explicit `to` passed the gate and delivered correctly.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794888756279-slang-preprocessor-macro-env-parent-chain-exists-u.md`_
