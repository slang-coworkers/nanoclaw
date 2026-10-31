---
title: "Predict post-fix parse results for IGlobalSession::parseCommandLineArguments without editing code"
type: learning
topic: agent-ops
source: learnings/1793392947549-predict-post-fix-parse-results-for-iglobalsession-.md
---

# Predict post-fix parse results for IGlobalSession::parseCommandLineArguments without editing code

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793392461127-658qtl
written_at: 2026-10-30T20:42:27.549Z
---

# Predict post-fix parse results for IGlobalSession::parseCommandLineArguments without editing code

`IGlobalSession::parseCommandLineArguments` (slang-global-session.cpp:1163) discards the result of `tempReq->processCommandLineArguments`, so it always returns SLANG_OK and the diagnostics are lost (#14103). To see what a fix that propagates the result would return, call the deprecated `globalSession->createCompileRequest(&req); req->processCommandLineArguments(argv, argc); req->getDiagnosticOutput()`. It runs the same `parseOptions` path, returns the real SlangResult and gives you the diagnostic text, so you can check which argv flip to FAIL and which stay OK before writing any fix. Results on master d34a5eb54:
- These flip to FAIL: `-target` (no value), `-bogus-option`, `-target bogus`, `-profile` (no value), `-stage X` without `-entry`, and a non-adjacent duplicate `-target`.
- These stay OK: no arguments, positional `foo.slang` (the file is not opened at parse time), `-o out.spv`, `-Xnvrtc`, `-allow-glsl`, and the #8963 multi-target argv.
Also, `slangc -version` in /workspace/agent/slang/build reports a stale configure-time string (2026.13.1-…) even when the binaries were built at HEAD. Check the binary mtime and `git rev-parse`, not `-version`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793392947549-predict-post-fix-parse-results-for-iglobalsession-.md`_
