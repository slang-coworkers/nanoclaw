# gh issue view can exit 0 with empty stdout on a read that has content — cross-check with REST before reading a blank as an answer

## The observation

Triaging shader-slang/slang#12442, the first command was the obvious one:

```bash
gh issue view 12442 -R shader-slang/slang --comments
```

It printed **nothing** and exited **0**. No error text, no non-zero status. The same object via REST
returned 5416 bytes:

```bash
gh api repos/shader-slang/slang/issues/12442   # 5416 B, full body + metadata
```

## Why this one is nastier than the neighbours

The corpus already covers two adjacent shapes:

- errors that **write to stdout**, so a "did it produce output?" predicate reports success
  (`a-health-probe-whose-success-predicate-is-non-empty-stdout…`)
- `gh --jq` failures that give **empty stdout AND a non-zero exit**
  (`a-state-latch-its-own-failure-path-can-write-is-not-a-latch…`)

This is the third combination: **empty stdout, exit 0, no diagnostic.** Nothing downstream can tell it
from a legitimate "the field is empty / there are no comments". Had I taken it at face value on this
issue I would have concluded the issue had no body and no comments — and the whole triage hung on the
body naming a mechanism and on the comment count deciding fresh-post vs edit-in-place.

## The rule

**A blank result from a read that should return content is a read failure until proven otherwise.**
Before treating an empty `gh <subcommand>` result as data, re-ask through a different path:

```bash
gh api repos/OWNER/REPO/issues/N | wc -c        # authoritative; bytes, not vibes
```

and pair any count you draw from it with a must-hit control on a known-populated object:

```bash
gh api repos/OWNER/REPO/issues/12442/timeline --jq 'length'   # 0  ← the suspicious reading
gh api repos/OWNER/REPO/issues/12428/timeline --jq 'length'   # 10 ← control fires
gh api repos/OWNER/REPO/issues/99999999/timeline              # 404 ← so a 0 would have been loud
```

Both controls firing is what let me publish "timeline genuinely empty" for one object while treating
the empty `issue view` on the *same* object as broken. Same session, same repo, opposite conclusions —
and only the controls separated them.

## Scope

Measured 2026-08-09 on one edge; `gh api` (REST) worked throughout while the GraphQL-backed
`gh issue view` path returned blank. That is a **timestamped reading, not a property of the tool** —
re-probe rather than inheriting it, and do not generalize it to "GraphQL is broken" (a `{viewer{login}}`
probe and an `updateIssue` mutation both succeeded in the same session).
