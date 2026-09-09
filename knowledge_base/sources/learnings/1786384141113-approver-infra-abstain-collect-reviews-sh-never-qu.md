---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375378701-irfh6y
written_at: 2026-08-10T17:49:01.113Z
---

# [approver/infra-abstain] collect-reviews.sh never queries pulls/N/comments — a 🔴 Critical inline finding was invisible on every exit path, and my compensating rule was keyed to the success signal

## Symptom

On slang-rhi#825 R3 I recorded BLOCK on an ABI break and reported that **no head-current bot review
corroborated it** — I had derived it myself and treated CodeRabbit as stale.

CodeRabbit had in fact filed a **🔴 Critical inline comment at `include/slang-rhi.h:3878` at
16:03:48Z, ~80 minutes before my 17:25Z decision**: *"Bump the `ITaskPool` interface IID for this
vtable change"*, naming the same removed methods, the same unchanged GUID at `:3857`, the same
mechanism (*"silent memory corruption instead of a clean failure"*), and the same two remedies I
proposed. The verdict was right; **the statement about my evidence was false, and the strongest
corroboration I had was already public.**

## Root cause — two independent failures that compound

1. **The harvester cannot see the endpoint.** `collect-reviews.sh:63` queries
   `repos/$REPO/issues/$PR/comments` and **never** `repos/$REPO/pulls/$PR/comments`. Inline review
   comments live only on the latter. This is structural: it holds on *every* exit path (0, 10, 20,
   21, 22), not just failures. Verified by grep, not inferred.
2. **My compensating rule was keyed to a success signal.** I already had the rule written down
   ("tally `pulls/N/comments`, not just `reviews[].body`"), with the trigger *"treat `Actionable
   comments posted: N>0` + no body markers as a findings-are-elsewhere flag."* On R3 the harvest
   returned **exit 10 (stale)** and therefore emitted no such string — so the trigger never fired.
   The rule was present, correct, and unreachable on the path that needed it.

## How to catch it

**Unconditional, bound to the decision point rather than to a symptom:**

```bash
# BEFORE recording ANY decision — whatever the harvest exit code was
gh api "repos/$REPO/pulls/$PR/comments" --paginate \
  --jq '.[] | {author: .user.login, path, line, created_at, head: (.body[0:120])}'
```

Three distinct channels carry PR feedback and no single one subsumes the others:
`pulls/N/reviews` (review objects) · `pulls/N/comments` (inline review comments) ·
`issues/N/comments` (plain comments, where maintainer directives arrive). A stale or empty result
from one says nothing about the other two.

## Fix

- Query `pulls/N/comments` before recording, unconditionally. Use `original_commit_id` when checking
  currency — GitHub rewrites inline `commit_id` as the head advances.
- Treat a stale/empty harvest as **one channel returning nothing**, never as silence.
- Ideally patch `collect-reviews.sh` to fetch all three endpoints; until then the manual probe is
  the control.

## Transferable rules

**A check keyed on a success signal cannot fire on the failure path — and the failure path is
exactly where your instrument tells you least.** Bind a check to the decision point ("before I
record"), never to a symptom that only appears when things went well.

**"No corroboration" is an enumeration claim over every channel.** Asserting it from one instrument
is the same error class as asserting an empty set from a single page of a paginated API. If you say
a source is silent, name which sources you actually queried.
