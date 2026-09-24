---
title: "slangpy#886/#1177: read the maintainer's actual GitHub comment for scope — relayed scope omitted 'also fix #1177'"
type: learning
topic: slang-compiler
source: learnings/1790193131048-slangpy-886-1177-read-the-maintainer-s-actual-gith.md
---

# slangpy#886/#1177: read the maintainer's actual GitHub comment for scope — relayed scope omitted "also fix #1177"

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226253800-9l0w9m
written_at: 2026-09-23T19:52:11.048Z
---

# slangpy#886/#1177: read the maintainer's actual GitHub comment for scope — relayed scope omitted "also fix #1177"

**Outcome:** My PR shader-slang/slangpy#1182 (scoped to `device.create_slang_session` inheriting device include paths — sessions only) was **closed unmerged by @kaizhangNV** and superseded by the merged **PR #1183 "Add slangpy shader path to devices and sessions by default" (Fixes #886, Fixes #1177)**. #1183 took the broader scope: it added SHADER_PATH by default on the **device construction path** (fixing raw `spy.Device()` → #1177) *and* sessions (#886), touching `slangpy/core/utils.py`, `slangpy/__init__.py`, and `src/slangpy_ext/device/device.cpp`.

**Root cause of the wasted narrow PR — scope-relay error:** The maintainer's actual comment on #886 (kaizhangNV, 2026-09-22 19:25) was: *"please open a PR to fix this problem. When create_device is called, let's add the slangpy module searching path by default. **And this should also fix the #1177.**"* The scope relayed to me by the triager **dropped the "also fix #1177" clause** and instead told me to keep it scoped to `create_slang_session` and explicitly NOT fold in #1177. I implemented to the relayed (narrower) scope, so my PR didn't satisfy the maintainer and was superseded.

**Lesson (for fixers):** Before implementing from a relayed handoff, **read the maintainer's actual GitHub comment(s) on the issue directly** (`gh issue view <n> --comments` / API) — a relayed scope can be incomplete or contradict the source. My own CLAUDE.md truthfulness rule ("read the actual source; verify") applies to the *requirements*, not just the code. Had I re-fetched #886's latest comments at implement time, I'd have seen the #1177 requirement and built the broader fix.

**Also:** two `nv-slang-bot` sessions ended up on the same issue family (#1183 vs my #1182). No collision signal reached me at implement time (#1183 landed ~a day later), but it reinforces checking for parallel bot PRs on the same issue before/while implementing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790193131048-slangpy-886-1177-read-the-maintainer-s-actual-gith.md`_
