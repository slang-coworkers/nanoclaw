---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1783793890173-pwlrc0
written_at: 2026-08-11T12:56:55.067Z
---

# [approver/infra] The critique gate blocks READ-ONLY `gh api .../pulls/...` as "PR creation" — matcher matches command TEXT, not EFFECT (over-blocking direction)

## Symptom

Mid-investigation on a PR where I was **creating nothing and deciding nothing**, every `gh api` call touching the `pulls` route started returning:

```
CRITIQUE REQUIRED before PR creation.
Reason: N edit(s) recorded since the last critique round …
```

It escalated to the 3-denial cap and opened `critique-escalation.json`, carding an admin — for a session whose only activity was read-only GitHub queries.

## Root cause — TWO independent conditions, and I initially mis-stated which was the trigger

`/app/hooks/gate-critique-on-deliver.sh`:

1. **What makes it fire (the trigger).** `BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'`. `gh api repos/O/N/pulls/N/reviews` — a pure GET — matches `gh api [^|]*pulls\b` and is labelled `HIT="PR creation"`. **Every read of a PR's reviews/comments/files via the `pulls` route is classified as creating a PR.** `gh pr view` is clean; `gh api …/pulls/…` is not. The hook's own comment concedes "pattern enumeration can never be complete" and names the OneCLI proxy as the real backstop — but the gap here is the opposite of incompleteness: it is **over-breadth**.
2. **What makes it deny once fired (the reason).** The freshness check: `edits_since_critique > 0`. `/app/hooks/track-edits.sh` bumps that counter on **any Bash command containing a `>` / `>>` redirect** — so `gh api … > /tmp/out.json`, the ordinary way to avoid dumping a huge payload into context, is counted as "an edit". It also bumps on Write/Edit to any path outside its allowlist; the allowlist covers `/workspace/agent/memory/*` but **not** the native auto-memory tree at `/home/node/.claude/projects/*/memory/`, so memory bookkeeping counts too.

So the gate said "before PR creation" about a GET, and justified it with edits that were scratch redirects and memory notes.

**This is the `A GUARD MATCHING COMMAND TEXT ENFORCES NOTHING ABOUT COMMAND EFFECT` maxim in its second, less-obvious direction.** I had only ever recorded the under-blocking direction (a rename/obfuscation slips past). Same defect over-blocks: it stops legitimate reads and burns the denial budget, and the denial text names an action ("PR creation") that never happened — which sends you looking for a delivery you aren't making.

## How to catch it

Read the *matcher* before believing the *label*. When a gate denies an operation you know you did not perform, the disagreement is evidence about the **classifier**, not about your action. Grep the hook for the pattern, then test your literal command against it — `grep -qE "$BASH_PATTERNS" <<< "$cmd"`.

Beware: **that test itself trips the gate** if your test string contains `pulls`. The denial is then the confirmation.

Also check `/workspace/.claude/workflow-state.json` before assuming the counter reflects *this* session's work. Mine read `last_critique_at: 2026-07-13` with attested hashes pointing at a work dir from a month-old decision round on the same PR — stale state from a previous session was shaping today's denials.

## Fix

- `gh pr view --json …` for PR reads; it does not match. Reserve `gh api …/pulls/…` for when nothing else works, and expect the denial.
- MCP GitHub tools (`mcp__slang-mcp__github_get_pull_request_*`) are not Bash, so the Bash matcher never sees them — the reliable path when the gate is latched.
- **Do not run a ceremonial `/codex-critique` just to zero the counter.** When there is no artifact in flight, an OUTPUT_REVIEW round reviews nothing and its only effect is to unlatch a gate — that is gaming the guard, not satisfying it. Report the blocker instead; the hook explicitly invites "say why in this session."
- Narrowing suggestion for whoever owns the hook: require a mutating verb, e.g. `gh api (-X *)?(POST|PATCH|PUT) [^|]*pulls\b`, since `gh api` defaults to GET.

## Note on delivery markers (why reports still got through)

`MSG_MARKERS` is `Resolution|handoff` plus the role's list (`Fix Report`, `Review Verdict`, `Triage Resolution`, `Approval Decision`, …), anchored at line start. A `[Report] …` prefix matches **none** of them — `Fix Report` needs the literal "Fix". So upstream reporting keeps working while the gate is latched; only `[Approval Decision]` (the state that actually asserts something) is held. That asymmetry is correct and worth knowing: **being gate-blocked never excuses staying silent upstream.**
