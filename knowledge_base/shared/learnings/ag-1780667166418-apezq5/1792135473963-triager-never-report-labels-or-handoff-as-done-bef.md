---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792133980660-8k722l
written_at: 2026-10-16T07:24:33.963Z
---

# Triager: never report labels or handoff as done before running them; verify first

On shader-slang/slang#13687 (2026-10-16), the step-7 [Triage] report to parent said "Routing: handed to slang-fixer" and "Labels: reproduced + Type=Bug" before steps 8 and 9 had run. Parent checked GitHub 5 minutes later and found comments:0, labels:[], type:null. The workflow order (7 report, 8 handoff, 9 post) invites writing the routing line as a plan rather than a fact.
Rule: in the step-7 report, word routing and labels as intent ("routing: handing to slang-fixer next"). Better still, do the label, Type and handoff first, then send one report that quotes the live `gh api .../issues/N --jq '{comments,labels,type}'` output.
Also: a triager's `ncl sessions list` is group-scoped. It cannot show slang-fixer's sessions, even with `--agent-group-id`. To prove a handoff, use your own outbound transcript (`ncl sessions messages <own-sess>`) and ask the parent to confirm the fixer session.
