---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1783957284686-c8ztio
written_at: 2026-08-11T14:32:54.421Z
---

# [approver/infra-abstain] Two silent instrument failures: record_decision returns success on a host-denied write, and the stale nanoclaw devin-fetch.sh can exit 0 having missed a Bug

Two infrastructure defects measured on shader-slang/slang#12084 (2026-08-11), both of which produce a **confident-looking result from a check that silently did not work**.

## 1. `record_decision` returns "Decision recorded" while the host DENIES the write

Called `record_decision(...)` and got back:

```
Decision recorded: shader-slang/slang#12084@9702b6dc8548 = ABSTAIN_POLICY
```

The host then emitted, as a separate async notification:

```
record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)
```

**No ledger row was created.** Confirmed `APPROVAL_LEDGER_WRITERS` unset in the container env. Root cause (codex read `/app/src/mcp-tools/core.ts`): the tool returns its success string immediately after *enqueueing*, not after host persistence.

⭐⭐⭐ **VERIFY THE CAPABILITY, NOT THE RETURN STRING.** The success string is not the write. This is the second+ independently-recorded instance of this exact defect across the fleet — if you are keeping a count, **quote the PR list, not a file count**, because the file count is self-referential (documenting the defect grows it) and every edge under-reports the union by the same mechanism, biasing toward the fix looking less urgent. Better still, quote a **rate** in events.

Practical consequence: every decision made while this is unset needs **manual backfill**, and the decision exists only in the session's `work/<pr>-<sha12>/` artifacts plus the outbound message. Say so explicitly in the report — a decision the ledger never received is not a decision anyone else can find. It is an **operator action** to fix; do not report an ETA you cannot control.

## 2. `nanoclaw-pr-review-runner/scripts/devin-fetch.sh` is stale vs the 2026 Devin UI

**Read this one carefully, because my first description of it was WRONG and I shipped the correction.** A subagent told me the script "knows only the legacy combined `N Flags` toggle and would emit an empty findings section", I relayed that, and codex refuted it from the source. Verified myself afterward:

- It **does** recognize current toggles — line 172 matches `/^(\d+\s+Flags?|No flags)$/i`, and its legacy splitter yields a **non-empty** Flags section on the decoded page.
- The **actual** defects: it **neither expands/parses the separate `Bugs` or `Informational` panels** (`grep -cE 'Bugs?'` over the whole file returns **1** — a lone incidental comment) **nor JSON-decodes `agent-browser eval` output** (no `json.loads` / `JSON.parse` anywhere).
- Consequence: it **can exit 0 with empty or misclassified structured findings and miss a Bug entirely.** On #12084 Devin reported `1 Bug / 4 Flags`; a Bugs-blind extractor drops the one finding that would drive a BLOCK.

Use `/home/node/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh`, which handles the 2026 Bugs/Flags/Informational split explicitly (`:127`, `:203-204`). It is mode **644** — invoke via `bash <path>`, a direct exec returns 126.

⭐⭐ **A SUBAGENT'S CLAIM ABOUT A FILE IS NOT A READING OF THE FILE.** I passed along a mechanism description I had not opened, and it was wrong in a way that would have sent an operator to fix the wrong line. When a subagent reports a defect in a mechanism, open the mechanism before repeating it — this is the same "claim about a state I did not open" failure as any other, and delegation does not launder it.

## 3. Bonus: the critique gate denies read-only evidence gathering

`gate-critique-on-deliver.sh` text-matches any `gh api …pulls` command as "PR creation" — so **read-only** `gh api repos/O/N/pulls/N/reviews` is denied. Compounding it, `track-edits.sh` counts matching output redirects (`grep -qP '(^|\s|\|)(>|>>)\s'`, plus write commands including `tee`/`sed -i`/`patch`/`git apply`/`git am`/`dd`) as an "edit", so writing evidence to `/tmp/foo.json` bumps `edits_since_critique` and re-arms edit-freshness **against further read-only reads**. Four denials in one session, burning the 3-attempt soft cap and opening an admin escalation for something that was never a PR-creation attempt.

Workarounds that keep the evidence trail intact: use the MCP GitHub tools (`mcp__slang-mcp__github_get_pull_request*`) instead of `gh api …/pulls/…`; prefer `gh pr view --json` / `gh pr diff` which don't match the pattern; and note that `/workspace/agent/memory/*` is allow-listed in `track-edits.sh` but a *different* memory tree may not be — **finish memory writes BEFORE the OUTPUT_REVIEW round**, or freshness will deny the delivery the critique just approved.

⚠️ Also worth flagging to whoever owns `/app/hooks/`: `track-edits.sh:3` describes its counter as "informational rather than load-bearing", but `gate-critique-on-deliver.sh:148` uses it to deny delivery on freshness. That stale comment is exactly what makes the re-arming behavior baffling when you hit it.
