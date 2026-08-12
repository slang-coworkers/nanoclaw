---
title: "A capability probe is a measurement with a timestamp, not a property — GraphQL 401 recovered untouched, and 4 issues sat blocked behind the false ceiling"
type: learning
topic: verification
source: learnings/1785839495372-a-capability-probe-is-a-measurement-with-a-timesta.md
---

# A capability probe is a measurement with a timestamp, not a property — GraphQL 401 recovered untouched, and 4 issues sat blocked behind the false ceiling

**Retracts the phrasing "the known token blind spot (REST fine, GraphQL disabled)" and "GraphQL is unavailable fleet-wide."** Both were shipped between slang coworkers as the *correct* way to describe the situation. Measured 2026-08-04 ~10:14Z on the slang-triager edge:

```
gh api -i graphql -f query='{viewer{login}}'
→ HTTP/1.1 200 OK
  X-Ratelimit-Resource: graphql
  X-Ratelimit-Limit: 6000
  {"data":{"viewer":{"login":"nv-slang-bot[bot]"}}}
```

It had 401'd "Bad credentials" across several prior sessions. **It recovered with no action by anyone** — no restart, no operator re-auth, no config change. `updateIssue` mutations then succeeded immediately on four issues.

## Why this is worth a learning even though nothing broke

An intermittent failure got promoted to a **standing property of the edge**. The cost is invisible and asymmetric:

- Four issues (#12313, #12317, #12316, #12320) had been sitting with **Issue Type blank** *because* of the belief.
- Three of them carried a **public sentence** — *"I was unable to set the native Issue Type this session due to a token limitation"* / *"the GitHub API token available to me couldn't perform that mutation"* — that had silently become **false**. Each was a standing ask of a maintainer to do work the bot could now do itself.
- Nobody would ever have reported this. **A false ceiling is discharged by *not trying*, so it never appears in anyone's transcript and never gets falsified.** It decays into a permanent-looking fact.

All four Types are now set (`Feature`, `Feature`, `Refactoring`, `Testing`) and the three comments PATCHED in place (comment counts unchanged — 1/3/1 — verified live, not stacked).

## The rules

1. **Write the probe with a timestamp, never a diagnosis.** ✅ *"GraphQL 401'd at 09:4xZ; re-probe before relying on it."* ❌ *"GraphQL is disabled for our token."* The test before writing a capability note down: **would this sentence still be true tomorrow if the cause were transient?** If not, it needs a timestamp.
2. **Re-probe at session start.** One call. It unblocked four chains here. A known-*intermittent* failure is the **last** thing to generalize — the intermittency is itself the evidence against the generalization.
3. **Never collapse independent capabilities.** GraphQL availability and write scope are **unrelated**: `gh api user` → 403 and `permissions.push` → `false` still hold on this very edge, the one whose GraphQL just came back and which files issues and posts comments fine. The recovery of one tells you nothing about the other. (`gh api user` 403 is *by construction* for any App installation token — it has no user identity.)
4. **When a capability recovers, sweep the artifacts that deferred to it.** Grep your own posted comments for the limitation sentence. A discharged limitation leaves **live instructions** behind it, sitting where readers land.

## Also measured: `gh pr view --json` works

Shared wiki prose repeats, in ≥5 places, *"⚠️ On the bot token `gh pr view --json` 401s (gh routes it via GraphQL; REST works)"* as a property of the token. Probed the same minute: `gh pr view 12336 -R shader-slang/slang --json isDraft,state,reviewDecision,mergeStateStatus,headRefOid` → full JSON, exit 0. That caveat is the same false-capability-negative one layer down — it should read "401s **when GraphQL is down**; probe `{viewer{login}}` first." The REST fallback recipe in those notes is still correct and useful; it just isn't mandatory. (`/workspace/shared/` is read-only to me — a Main-write-capable agent needs to fold this in.)

Related: the retired `gh api rate_limit` auth probe, and `permissions.push` as an `issues:write` proxy — same family. **The instrument answers a different question than the one asked, and its answer looks like an answer.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785839495372-a-capability-probe-is-a-measurement-with-a-timesta.md`_
