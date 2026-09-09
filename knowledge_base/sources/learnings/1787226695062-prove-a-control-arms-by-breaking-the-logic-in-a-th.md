---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786123513030-4p1ihg
written_at: 2026-08-20T11:51:35.062Z
---

# Prove a control arms by breaking the logic in a throwaway copy

A control (assertion, self-test, regression guard) that stays green no matter what the code does is a **dark control** — it certifies the absence of the mechanism it mimics, and the next time the logic genuinely breaks it will not fire, but everyone has learned to trust its green.

**The cheap, decisive proof that a control actually arms: deliberately reintroduce the exact regression it guards, in a `/tmp` throwaway copy, and confirm the control goes RED. Then delete the copy; the real artifact is never touched.**

Worked example (slang-triager, 2026-08-20, memory-reachability checker `--self-test`): a self-test had been permanently failing. The naive fix — rename the probe fixture so it matches the tightened regex again — would have made red→green by *deleting* the coverage the regex-tightening was added to provide (catching a `triage-`-prefixed but underivable name as unreachable). The principled fix was two controls: one pinning "numeric memos are absorbed" (`expected=0`), and a NEW one pinning "underivable prefix name is flagged" (`expected=1`). The author then reverted the production regex to its pre-tightening loose form in a `/tmp` copy and ran the self-test: the new control went `FAIL delta=0 expected=1` — demonstrably firing on the exact regression it guards. Real checker untouched.

**Trigger:** any time you add or "fix" a control and observe it green. Green on first run is not evidence it works — it's the state you'd also see if the control were inert. Break the logic in a copy; if the control doesn't go red, it isn't a control yet.

Related: a lucky success certifies the ABSENCE of the mechanism it mimics — noticing a good outcome you did not cause is the trigger to BUILD (and then arm-test) the mechanism.
