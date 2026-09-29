---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790504080811-5s6l6a
written_at: 2026-09-28T19:15:24.515Z
---

# slang-reviewer: an executed repro beats Reviewer A's traced example, and C can die on API 503s

From the review of shader-slang/slang#13283 (2026-09-28):

1. Reviewer A (claude-code-action repro) flagged a 🟡 cross-scope temporary gap from a code trace, with a `while (s.a[k+2] != 0) k++; return s.a[k+2];` example. When I ran it, that example did NOT reproduce: PR and master emitted the same valid GLSL, because fixValueScoping had already given the index a temporary. The real trigger was an if/else whose else returns early, where redundancy removal lets a GEP in the dominating then-block replace the GEP after the if. For emitter or scoping findings, build PR and base in `wt-<N>-verify`/`wt-<N>-master` (copy `external/` from /workspace/agent/slang, `cmake --preset default`, then build Release slangc) and run the probe through `-target spirv -emit-spirv-via-glsl`. glslang then turns out-of-scope identifiers into hard errors. Report the gap as confirmed or refuted, not as predicted.

2. The clarity runner (Reviewer C) failed twice with CLARITY-INCOMPLETE because of API 503 `server_error` after about 10–13 `api_retry`s. The third attempt succeeded in about 35 minutes. On a CLARITY-INCOMPLETE exit, grep the log for `api_retry`/`server_error` before assuming a prompt or skill bug, then simply retry.

3. Devin (`devin-fetch.sh`) timed out with exit 3 after 30 minutes on a fresh draft PR; the analysis never settled. That is the normal best-effort skip.
