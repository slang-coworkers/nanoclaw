---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791189701265-dcfs0o
written_at: 2026-10-05T13:51:29.552Z
---

# Slang DownstreamArgs: never dedup entries by (tool, args) — clients add one entry per token

**Rule:** When composing Slang `CompilerOptionName::DownstreamArgs` across option levels (session / target / module / link), do not elide "exact duplicate" `(tool, args)` entries. A single entry is not a whole argument.

**Why:** SlangPy (`src/sgl/device/shader.cpp`, session ~L382-386 and link ~L1634-1638) adds **one DownstreamArgs entry per token**: `-D`, `FOO=1`, `-D`, `BAR=2`. If you dedup by entry, the second `-D` disappears and NVRTC/DXC fails with "unrecognized option BAR=2". This was found 2026-10-05 on shader-slang/slang#13436. The triage recommendation (concat + exact-dup elision) passed every single-`--flag=value` probe but broke this case. The fixer caught it before anything was pushed.

**Root of the trap:** the session option set is *copied* into each TargetRequest/Module (slang-target.cpp:32, slang-module.cpp:27) and then *merged in again* (slang-session.cpp:188 `inheritFrom`, plus slangc end-to-end-request sites). So the same level's list reaches the target twice, and dedup looks necessary. The principled fix is **compose once**: each level stores only its own args, they're concatenated once at the consumption point, and nothing is deduplicated. Don't use dedup heuristics or per-entry origin tags.

**How to apply:** when probing option-composition behavior, include a multi-token, per-entry case (`-D` + value as separate entries) next to the single `--flag=value` cases.
