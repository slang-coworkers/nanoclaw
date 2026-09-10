---
name: Supervisor table — per-tier link columns
description: Issue-chain status table must include triager/fixer/reviewer columns, each a clickable link to that tier's artifact
type: feedback
originSessionId: 0703327c-bf73-4dc8-80d1-4f2c2cc1beee
---
The inline issue-chain status table (from `/supervise-issues` and any multi-chain status digest) MUST include three per-tier columns — **triager**, **fixer**, **reviewer** — in addition to the base columns. Each tier cell is a **clickable markdown link** to that tier's work product:

- **triager** → the triage/answer comment (`…/issues/N#issuecomment-<id>`, else the issue link)
- **fixer** → the PR
- **reviewer** → the GitHub review; if the verdict came via the a2a chain and no GitHub review exists, label the cell `a2a` (so a missing GH review is not misread as a stall)
- Use `—` for a tier that has not engaged.

Full column set: `# | repo | issue | triager | fixer | reviewer | state | last-active | next`.

**Why:** Operator asked (2026-06-02) to "add those columns back" — a single `tier` column hides who handled each stage and forces clicking through the dashboard to find each tier's output. Per-tier links give one-click access to triage comment / PR / review.

**How to apply:** Render these columns on every multi-chain status report. Combine with the existing preferences: keep all PR/issue references as inline clickable links, and use dashboard base `https://3737-yjdzmdo7h.brevlab.com/`. The `/supervise-issues` SKILL.md step-6 spec was updated to match, so the scheduled task produces this format automatically.
