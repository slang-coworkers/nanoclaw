### Report formats

Markdown `- ` bullets with bold field names, never Unicode `•` (it degrades to raw bytes in dashboards). One outcome line — result plus concrete artifacts — ends every multi-step task.

**GitHub 5-bullet** (issue/PR comments, `[Report]`, `[Resolution]`): `**Status:** / **Link:** / **Verdict:** / **Next-action:** / **Blocker:**`.

| Marker | Fields, in order |
|---|---|
| `[Report]` | the 5-bullet; the ungated status channel — roll downstream reports into one, never relay verbatim |
| `[Triage]` | **Classification** (category / severity / component / priority) · **Summary** · **Solution space** (N approaches; recommended) · **Files** (top 3) · **Routing** (handed to fixer / parked for direction) |
| `[Triage handoff]` | `Priority | Component`, then the **solution brief** (≤15 lines): **Hypothesis** · **Suspected files** (file:line) · **Repro command** · **Acceptance criteria** · **Recommended** (name — why); alternatives and risks stay in the attached memo |
| `[Fix Review Request]` | **Mode** (pr / patch) · **PR / Patch** · **Base** · **Tests added** · **Test results** · **Maintainer direction** (comment URLs, or `none — <why>`) · **Fixer self-check** (R1 met · R2 partial (why) · …) |
| `[Review Verdict]` | **Verdict** · **Findings** (bugs, gaps, questions per reviewer) · **Top concern** · **Test gaps** · **Disagreements** · **Sent to** |
| `[Fix Report]` | **Status** (fixed / partial / blocked) · **Changes** (N files, +X / −Y — what) · **Tests** (repro PASS/FAIL; suite result) · **Review** (verdict or N findings — top concern) · **Next** (draft PR url / patch / human action) |
| `[Triage Resolution]` | **Outcome** (fixed / partial / blocked / abandoned) · **Draft PR** · **Review** · **Tests** · **Next human action** |

**PR description** (hook-enforced by `container/hooks/gate-pr-description.sh`): four labeled sections of at most 2 lines each — **Summary**, **Root cause** (`file:line`), **Tests**, **Risk** — then `Fixes #<n>`; under 1,000 characters, no tables; written to a file and passed with `--body-file`. Rationale, alternatives and tables go in the explanation comment.

**Verdict vocabulary** (`[Review Verdict]` → fixer action): `APPROVE` → `[Fix Report]`; `APPROVE_WITH_NITS` → apply the nits without another review round, then `[Fix Report]`; `REQUEST_CHANGES` → apply the edits, re-verify, re-send `[Fix Review Request]` (Decision table, review rounds).
