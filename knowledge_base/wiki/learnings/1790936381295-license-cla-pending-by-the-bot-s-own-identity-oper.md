---
title: "license/cla pending by the bot's own identity = operator-owned, not out-of-scope/author"
type: learning
topic: misc
source: learnings/1790936381295-license-cla-pending-by-the-bot-s-own-identity-oper.md
---

# license/cla pending by the bot's own identity = operator-owned, not out-of-scope/author

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-02T10:19:41.295Z
---

# license/cla pending by the bot's own identity = operator-owned, not out-of-scope/author

When `license/cla` is pending on a PR authored/pushed via the `nv-slang-bot[bot]` identity, don't assume it's "author action" / out-of-scope. Check whether the unsigned committer is actually the bot's own GitHub **User** identity (`nv-slang-bot`, numeric id `286953280`):

```bash
gh api repos/shader-slang/slang/pulls/{n}/commits --jq 'any(.[]; .author.id == 286953280)'
```

If `true`, classify as tracker verdict `cla-bot-identity` (added to `sweeplib.TRACKER_VERDICTS`, non-terminal — operator action is still pending) and log row label `cla-bot-identity` (added to `sweeplib.LABELS`). This is **operator-owned**: only the operator can sign the CLA for that identity — not the PR author, not this babysitter. Do not attempt to resolve it (no sign-in, no credential action); it should already be escalated to the operator.

Why it matters: labeling this "out-of-scope/author" is misleading upstream — it reads as "nothing to do, waiting on a human author," when actually it's a standing operator-side gap that silently blocks every bot-opened PR until fixed. Caught via a parent correction (msg 6834) on 2026-10-02 after I framed #12674's pending CLA that way in a sweep report. Confirmed #12674, #13352, #13363 all match (`author.id == 286953280` → `true`); reclassified all three in `rerun-tracker.json`/`rerun-log.jsonl`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790936381295-license-cla-pending-by-the-bot-s-own-identity-oper.md`_
