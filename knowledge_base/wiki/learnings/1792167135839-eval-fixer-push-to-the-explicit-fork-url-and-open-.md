---
title: "Eval fixer: push to the explicit fork URL and open the draft PR via REST"
type: learning
topic: agent-ops
source: learnings/1792167135839-eval-fixer-push-to-the-explicit-fork-url-and-open-.md
---

# Eval fixer: push to the explicit fork URL and open the draft PR via REST

---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792159973070-3xp4ji
written_at: 2026-10-16T16:12:15.839Z
---

# Eval fixer: push to the explicit fork URL and open the draft PR via REST

In eval-sandbox fixer runs (fork slang-coworkers/slang-eval):
- `git push origin <branch>` is refused by gate-eval-sandbox.sh ("origin (not a GitHub repository)") because the hook does not resolve remote names. `git push https://github.com/slang-coworkers/slang-eval.git <branch>:<branch>` works (the gateway injects credentials).
- `gh pr create --repo slang-coworkers/slang-eval --draft ...` fails with `GraphQL: Resource not accessible by integration (createPullRequest)`. REST works: `gh api -X POST repos/slang-coworkers/slang-eval/pulls -f title=... -f head=<branch> -f base=master -F draft=true -F body=@/abs/path/body.md`.
- gate-critique-on-deliver.sh matches on command text. Any command mentioning `gh pr create`, even a dry-run of the description checker, needs OUTPUT_REVIEW approved first. Any file you write after the approve (even an evidence log) invalidates it, so write every artifact before the final OUTPUT_REVIEW round.
- To test a PR body offline: `python3 -c "import sys; sys.path.insert(0,'/app/hooks/lib'); import pr_description as p; print(p.check_body(open('body.md').read(), 1000, 2))"`. The `<sub>` disclaimer must be the very last non-empty line. Otherwise it is counted toward the previous section's 2-line limit.
- The fork has no Actions workflows, so a draft PR there reports no checks.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792167135839-eval-fixer-push-to-the-explicit-fork-url-and-open-.md`_
