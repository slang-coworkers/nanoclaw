---
name: feedback_an_unchanged_call_site_can_still_be_the_regression
description: "A byte-identical line can BE the regression when a diff elsewhere changes what flows into it. I nearly filed nanoclaw#1168's headline as pre-existing because registerContainerToken(...) was unchanged; a differential run against the merge-base showed its input had flipped from manifest to inventory."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4261c307-1e02-4a9c-8d81-eb0b70a3ce71
---

# An unchanged call site can still be the regression — diff the INPUT, not the line

On nanoclaw#1168 I found that a group's MCP proxy-token scope collapses when one MCP server's tool
discovery fails. I checked whether it was new by looking at the line that does the scoping:

```
pre-PR  container-runner.ts:503   registerContainerToken(agentGroup.folder, mcpPolicy.externalTools)
head    container-runner.ts:494   registerContainerToken(agentGroup.folder, mcpPolicy.externalTools)
```

Byte-identical. I drafted the finding as **"not a regression — the pre-PR code had the same line"**,
and added a sentence excusing the author on that basis.

**That was wrong.** A different hunk in the same PR changed what `externalTools` *is* for the
default `inherited` state: from the coworker-type manifest to `inventory ?? []`. Differential run
against the merge-base:

```
PRE-PR full-inventory : externalTools=["mcp__slang-mcp__github_get_issue"]
PRE-PR zero-inventory : externalTools=["mcp__slang-mcp__github_get_issue"]   <- stable
HEAD   zero-inventory : externalTools=[]                                     <- collapses
```

The manifest does not move when a server crashes; the inventory does. So the unchanged line went
from "scope from a stable value" to "scope from a value that tracks proxy liveness" — **the PR
caused it, via a hunk 200 lines away.**

**Why:** "is this new?" feels like a question about the *defective line*, so I diffed that line. But
a defect lives in a *composition*, and a composition changes when **either** the consumer **or** any
producer feeding it changes. Diffing the consumer alone answers a narrower question than the one I
asked, and it answers it confidently.

## How to apply

- **The trigger is drafting the words "pre-existing" / "not a regression" / "same as before".** At
  that moment, name the VALUE the defect depends on and diff *its producer*, not the line you found
  it on.
- **Settle it by execution, not by reading:** worktree at head AND at the merge-base, run the same
  probe on both, compare outputs. A `git diff` of the call site cannot show an input change; a
  differential run cannot miss one.
- **Severity depends on this.** "Pre-existing wart the PR happens to touch" and "regression this PR
  introduces" earn different verdicts, and I was about to hand the author the wrong one — in the
  direction that excuses the change. Note the direction: my error made the PR look *better*, which
  is the direction that gets less scrutiny from a reviewer trying to be fair.
- Report the correction explicitly in the review when it happens. On #1168 I wrote the mis-read into
  the finding ("I initially got that wrong — the correction matters for severity") plus a line
  warning the next reviewer that the call-site diff is uninformative here. A silently-fixed draft
  teaches nobody, and the next reader would repeat the same shortcut.

Related: the age-of-the-file-launders-the-age-of-the-addition rule in
[[feedback_mechanism_must_predict_observed_coordinates]] (date the CHANGE, not the file) — same
family, different surface: there the file's age misled, here the line's stability did.
Instance: [[project_nanoclaw_1168_inherited_scope_discovery]].
