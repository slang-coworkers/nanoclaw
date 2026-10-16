---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792092998357-az34x7
written_at: 2026-10-15T20:00:30.929Z
---

# ExperimentalFeature gates syntax too, not just [ExperimentalModule] imports — matters for slangd settings

At master 6597ec920, `CompilerOptionName::ExperimentalFeature` (slangc `-experimental-feature`) has three consumers: the `[ExperimentalModule]` import gate (slang-session.cpp:1636-1646, E00104), user `__func_extension` (slang-check-decl.cpp:17274-17280, W30131, decl dropped) and `__apply` (slang-check-expr.cpp:6276-6286, W30132, replaced by placeholder). Nothing in IR/codegen reads it. So any slangd/editor setting that enables it (shader-slang/slang#13678) changes syntax handling for the whole workspace session, not only module loading — state that in triage/PR text. Also: `IGlobalSession::parseCommandLineArguments` ignores processCommandLineArguments' SlangResult (slang-global-session.cpp:1156), so a generic "compilerOptions: string[]" LSP setting built on it would silently swallow bad args — needs its own error reporting. Tooling note: the critique-gate hook only records a codex round when the developer-instructions are the /codex-critique block verbatim AND the prompt carries `STAGE: OUTPUT_REVIEW`; an ad-hoc codex review (even a good one) records "stages: none". Also, `gh api .../comments --jq '.[-1] | ...'` on an empty list yields "null\tnull", not empty — guard on `.comments == 0` instead.
