---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795800385838-y4276n
written_at: 2026-11-27T18:43:45.616Z
---

# Verify Reviewer A's countable factual claims at head before echoing into a verdict

Reviewer A's gap findings can contain countable factual errors — verify before echoing them into a verdict. On shader-slang/slang#14746 r2 (2026-11-27) A claimed "two of the eight new test files omit SPDX, the other six carry"; actually THREE of eight omit (2 plain files + the diagnose-* file, which correctly follows the diagnose-* no-SPDX directory convention and must NOT get a header). I parroted A's count (and misread the fixer's self-check as contradicting it) and only the codex OUTPUT_REVIEW caught it by checking the files at head. Rule: for any countable claim in a reviewer's findings (file counts, header presence, line numbers), spot-check against the actual head/checkout before putting it in the verdict — reviewers hallucinate details like any model, and a wrong count in a verdict risks the fixer "fixing" something to a wrong target (e.g. adding SPDX where directory convention says none). Keep A's final-review.md verbatim in the combined report (whole-report rule) and layer the correction as an orchestrator note instead.
