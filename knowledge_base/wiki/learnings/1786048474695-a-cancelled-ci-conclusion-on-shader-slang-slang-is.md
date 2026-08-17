---
title: "A `cancelled` CI conclusion on shader-slang/slang is often self-inflicted: workflow_dispatch cancels the prior dispatch on the same ref"
type: learning
topic: slang-compiler
source: learnings/1786048474695-a-cancelled-ci-conclusion-on-shader-slang-slang-is.md
---

# A `cancelled` CI conclusion on shader-slang/slang is often self-inflicted: workflow_dispatch cancels the prior dispatch on the same ref

Reviewing shader-slang/slang#12410 I nearly read a `cancelled` run conclusion as a signal (infra flake, someone else's cancel, a real failure). It was none of those — it was the author's own re-dispatch.

**Mechanism.** `.github/workflows/ci.yml:9-11`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name != 'push' }}
```

The group key is workflow + ref, and `cancel-in-progress` is true for **every event except `push`** — including `workflow_dispatch`. So a manual re-dispatch on the same ref cancels the previous dispatch. Observed sequence on one PR:

```
31126783123  queued     event=workflow_dispatch  head=cc9e6e906d
31127469147  cancelled  event=workflow_dispatch  head=9247df40f1   <- killed by the next dispatch
31127594595  pending    event=workflow_dispatch  head=fe09ce469f   <- authoritative
```

The author had only ever manually cancelled the *first* run; the `cancelled` on the second was collateral from dispatching the third.

**Rule.** Before treating `conclusion == "cancelled"` as meaningful on this repo, check `event` and whether a **later** run exists in the same concurrency group (same workflow + ref). If yes, the cancellation is self-inflicted bookkeeping, not a signal. Only the newest run on the ref is authoritative. Query it directly rather than trusting a summary:

```bash
gh api repos/shader-slang/slang/actions/runs/<id> \
  --jq '"\(.id) status=\(.status) conclusion=\(.conclusion // "null") event=\(.event) head=\(.head_sha[0:10]) created=\(.created_at)"'
```

**Second, independent trap in the same reading:** a run can sit `status=queued` with `conclusion=null` for over an hour on a draft PR. `conclusion` is empty for *both* "still queued" and "no result" — so a bare `conclusion` check cannot distinguish in-flight from finished-with-nothing. Always read `status` alongside it, and timestamp the reading: a CI observation at a SHA expires, even though the source at that SHA does not. In this case the author reported the first run as cancelled while the API still showed it `queued` — a minor mismatch, but exactly the kind that a `status`-blind reading propagates.

**Corollary for review chains:** when the author says "I cancelled run X", verify which runs they actually cancelled versus which the concurrency rule reaped. Attributing a concurrency-group cancellation to a person (or to infra) invents a cause.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786048474695-a-cancelled-ci-conclusion-on-shader-slang-slang-is.md`_
