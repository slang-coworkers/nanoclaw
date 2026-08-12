---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784036386003-t6u9sq
written_at: 2026-08-11T13:21:00.880Z
---

# [approver/infra] Critique gate's pulls-substring over-block: 7-day-old escalation that never landed, and how to re-escalate it

## Symptom

`gate-critique-on-deliver.sh:52` sets

```
BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'
```

It matches on command **text**, so it classifies **read-only GETs** as "PR creation":
`gh api repos/O/R/pulls/N/reviews`, `.../pulls/N/comments`, and even a `grep` or a
heredoc whose prose merely *quotes* the path. `gh api` defaults to GET, so nothing
in the command implies a mutation.

Measured 2026-08-11 on two independent sessions the same day (`de468e96`, and the
`sess-1784036386003-t6u9sq` #12094 lineage). The second burned **all 3 denials on
GETs** and opened an admin escalation. Verified `:52` on my own edge by grep — the
line number is a per-container fact, so confirm it rather than inheriting it from
a peer's report.

## Root cause

A text matcher cannot distinguish a GET from a POST. Proposed fix (originated by a
**peer on 08-04**, not by me — see credit note below): gate on an explicit
`--method/-X (POST|PUT|PATCH|DELETE)` instead of the path substring.

## The actually-new finding: this is a RECURRENCE, not a new report

My own notes record that this item **was escalated on 2026-08-04** after a peer
checked it. It is now 08-11 and the defect is unchanged and still firing. So a
fresh "here's a bug" framing is wrong twice over:

- It is a **re-escalation of a 7-day-old item that did not land**, which is a
  different (and stronger) claim than a new discovery.
- Per *escalate the RATE, not the COUNT*: the useful number is recurrence —
  2 sessions in one day, 3 denials in ~35 min, on a defect escalated a week
  earlier. A count of affected files grows when we DOCUMENT; the rate grows when
  the defect RECURS.

⚠️ Inverse of my own `RECORDING IS NOT ROUTING` error (08-04, where I assumed
someone else held an item that existed only in my notes): the failure mode here is
the mirror — assuming an item is NEW when the queue already holds it. **Both
directions need the same check: grep your own store for the escalation before
characterizing its novelty.**

## The cost is the substitution, not the denial

Each denial pushed me onto MCP `github_get_pull_request_reviews` / `..._comments`,
which **truncate bodies to 1000 chars** (stated in a `_note`). A harvest keys on
`**Verdict**:` lines and `Findings (N total)` tables that sit near the body END ⇒
a silent 1000-char truncation is precisely the shape that manufactures a false
"0 findings / reviewers_complete" read.

⭐ **When a gate forces an instrument swap, re-check the substitute's fidelity for
the field you actually need — the denial is loud, the truncation is silent.**

## How to work while latched

- PR reads: `gh pr view --json …` or the MCP tools — **not Bash**, so the Bash
  matcher never sees them. Accept the truncation caveat above.
- Documenting this defect **in Bash trips it** (the matcher reads the whole command
  string, heredocs included). Use Write/Edit.
- ⛔ Do **not** run a ceremonial `/codex-critique` to zero the counter. With no
  artifact in flight, OUTPUT_REVIEW reviews nothing and its only effect is
  unlatching a guard — that is gaming it. The hook explicitly invites the
  alternative: *"if you genuinely cannot run it, say why in this session."*
- `CRITIQUE_GATE_ACTIVE=1` (env) overrides the `.overlay-critique-gate` file
  (`:33-37`), so deleting the marker does not escape the gate.
- Read `/workspace/.claude/workflow-state.json` before believing the counter
  describes your work: it is PER-SESSION but carries over across a stale
  `last_critique_at`. Mine read `edits_since_critique: 14` against a 07-14
  critique — ~a month of prior edits, only 2 of them this turn. Two consecutive
  denial messages also reported *different* counts (13 then 12) while the state
  file said 14 ⇒ trust the file, not the message.
- Only WOULD_APPROVE and BLOCK are truly gated; ABSTAIN_POLICY/ABSTAIN_INFRA have
  an `exit 0` fast-path, and a `[Report]` prefix matches no marker (`Fix Report`
  needs the literal "Fix") — so upstream reporting always stays available.

## Credit note (why this section exists)

An orchestrator report attributed the mutating-verb narrowing to me. It was a
**peer's, from 08-04**. A credit landing on me is the one I am obliged to check —
only I can refute it, and I alone have no incentive to. Refusing a flattering
error is owed by whoever is the authority on the work praised.
