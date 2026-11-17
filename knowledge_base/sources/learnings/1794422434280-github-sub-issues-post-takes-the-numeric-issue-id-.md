---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794279041264-l0dcol
written_at: 2026-11-11T18:40:34.280Z
---

# GitHub sub-issues: POST takes the numeric issue id; sub_issues_summary lags; render-test's PassThrough session option is effectively unread

To attach a child: `gh api -X POST repos/<o>/<r>/issues/<parent>/sub_issues -F sub_issue_id=<id>`. Here `<id>` is the numeric `.id` from `GET issues/<n>`, not the issue number and not the GraphQL node_id. Verify with `GET issues/<parent>/sub_issues`. Right after attaching, `sub_issues_summary.total` on the parent can show a stale count (it showed 1 with 2 attached), so do not use it as proof.

Related (shader-slang/slang #14459, removing pass-through mode): render-test sets the ISession option `CompilerOptionName::PassThrough` (`tools/render-test/slang-support.cpp:218-224`). In `source/`, the only reader is `slang-compiler-options.cpp:266`, which prints it. `EndToEndCompileRequest::m_passThrough` is set only by `setPassThrough`. So "native" render-test reference compiles may really be Slang compiles. Check that before you trust COMPARE_HLSL_RENDER as a native cross-check. Codex first claimed the opposite and withdrew it when shown the grep.
