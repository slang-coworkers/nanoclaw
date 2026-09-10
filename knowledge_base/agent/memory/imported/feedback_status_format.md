---
name: Status updates inline as markdown table
description: How the operator wants issue-chain / status updates delivered in the dashboard
type: feedback
originSessionId: bf56f147-5db5-4819-84b1-fe7a698a8fad
---
The operator (dashboard-admin) wants the issue-chain status **inline as a markdown table** in the chat, on **every update** — not only as an attached file — so it's always up-to-date in the conversation view.

**Why:** they read status in the dashboard conversation view; a file attachment forces an extra click and doesn't show at a glance. Asked explicitly 2026-06-01, reaffirmed 2026-06-02.

**Canonical table shape (confirmed working 2026-06-02):** columns `# | Title | Orch | Triage | Fixer | Reviewer | GitHub | Live status`. Each tier cell is a clickable deep-link to that tier's session conversation:
`https://3737-yjdzmdo7h.brevlab.com/#/cw/<coworker-folder>/s/<sessionId>`
(folders: `orchestrator`, `slang-triager`, `slang-fixer`, `slang-reviewer`, `slang-maintainer`, `nanoclaw`, `slangpy-triager`/`slangpy-fixer`/`slangpy-reviewer`). The **#** cell links to the GitHub issue; GitHub cell links the PR/comment. These links DO resolve — operator confirmed.

**Build the tier→session map** with `ncl sessions list --limit 2000 | grep gh-issue-`, taking the latest session per (thread, agent-group). Map agent-group id → tier:
orch=ag-1778288632732-akb54b, slang-triager=ag-1779277874733-8x1dw6, slang-fixer=ag-1779277891574-i5m2gg, slang-reviewer=ag-1779277917960-se4t3c, slang-maintainer=ag-1778503666357-kngngs, nanoclaw=ag-1778406248180-mk92ow, slangpy-triager=ag-1779277933814-se6fsb, slangpy-fixer=ag-1779277952203-xeyp4i, slangpy-reviewer=ag-1779277966260-oag7x6.

**How to apply:** whenever chain state changes, post the updated full table inline as markdown (primary surface) AND keep `reports/issue-chain-tracker.md` in sync (attach for durability). Don't substitute a condensed table — the operator wants the tier-link columns present every time.

**SCHEDULED/CRON DELIVERY (operator-confirmed 2026-06-04):** a scheduled/cron session has NO default reply target, so a bare `send_message`/`send_file` fails with "multiple destinations — specify to" and the report is silently dropped (board left on disk, never delivered — observed bug). The supervisor MUST deliver to the dashboard with an explicit **`to="orchestrator"`** — the orchestrator group's own **channel** destination (→ `mg-1778288632740-rc9cak`, the first row of `ncl destinations list --agent-group <orch>`). This is the dashboard the operator reads. NOTE: the "never message your own group name (a2a loop)" rule does NOT apply here — `orchestrator` is registered as a *channel* destination (the dashboard), distinct from the *agent* destination `self`. Use `to="orchestrator"` for any cron/scheduled delivery to the operator; prefer an inline `<message to="orchestrator">` block over send_file.

**UPDATE 2026-06-02 — "inline, not markdown" clarified:** the operator's "not markdown" meant **don't attach the markdown FILE — render the full table INLINE in chat**. It does NOT mean plain text. The scheduled `/supervise-issues` task (task-1780318935740-9h7kmd) must **post the full tier-link markdown table inline** (lead: "Current full table (<HH:MM> IST):"), same columns/clickable links as on-demand, and **must not attach the `.md` file**. Tracker file stays synced on disk for reference but is not attached. (I briefly mis-set it to plain text; corrected.)
