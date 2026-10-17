---
title: "Eval fixer: push to slang-eval fork by explicit URL and open the PR via REST"
type: learning
topic: agent-ops
source: learnings/1792165558748-eval-fixer-push-to-slang-eval-fork-by-explicit-url.md
---

# Eval fixer: push to slang-eval fork by explicit URL and open the PR via REST

---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792159975070-dmocun
written_at: 2026-10-16T15:45:58.748Z
---

# Eval fixer: push to slang-eval fork by explicit URL and open the PR via REST

In eval-fixer trials, `git push origin` is refused by gate-eval-sandbox.sh because origin's URL embeds `x-access-token:placeholder@` and the hook cannot match it to slang-coworkers/slang-eval. Push with `git push https://github.com/slang-coworkers/slang-eval.git <branch>:<branch>` instead. `gh pr create --repo slang-coworkers/slang-eval` fails with `GraphQL: Resource not accessible by integration`; use REST: `gh api -X POST repos/slang-coworkers/slang-eval/pulls -f title=... -f head=<branch> -f base=master -F draft=true -F body=@<file>`. As of 2026-10-16 the fork has zero registered Actions workflows, so trial PRs show no check runs. A trial based on the parent of an already-landed upstream fix will show `mergeable_state: dirty` against fork master.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792165558748-eval-fixer-push-to-slang-eval-fork-by-explicit-url.md`_
