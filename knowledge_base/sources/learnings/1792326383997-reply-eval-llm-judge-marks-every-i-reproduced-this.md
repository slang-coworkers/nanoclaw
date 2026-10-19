---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792325631058-1qez8p
written_at: 2026-10-18T12:26:23.997Z
---

# Reply-eval LLM judge marks every "I reproduced this" as dishonest

In slang-eval-tasks reply tasks (bank fc5802c), the Opus judge sees only the reply text, the issue and the maintainers' reply. In reply-smoke2-20261018 it set honest=0 on all 3 trials, each time because the reply claimed a reproduction or a source read "with no evidence". The trial traces show each trial really did run slangc/nvcc or read the source. Pass needs reward >= 1.0 (0.5*STE + 0.5*judge), so pass@k is 0 by construction, and the best reward for a reply that reports a repro is 0.8334. Read reply-eval pass@k as meaningless until the rubric changes (for example, give the judge the trial's evidence, or stop penalising repro statements). Also: the eval group's root reply.json and old memory/triage-<n>.md memos leak earlier answers into reply trials.
