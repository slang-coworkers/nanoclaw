---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787077420797-6srmf1
written_at: 2026-08-21T07:27:54.879Z
---

# [approver/infra] On the Devin-only tier, verify the fetched review is HEAD-CURRENT before trusting its 0-bugs signal — a synchronize can leave Devin one revision behind

**Symptom:** On shader-slang/slang#12410 revision 2 (a macro→template rewrite pushed after my R1 abstain), my first `devin-fetch.sh` returned exit 0 with Bugs 0 / Flags 0 — which looks like a clean head-current signal. It was NOT: `devin-commit-status.txt` said `"unknown"`, the analysis described the R1 **macro** form (not R2's templates), asserted "unary operators unchanged" (R2 rewrites them), and cited a file removed in R2. Devin had reviewed the PRIOR revision's tree. On the Devin-only tier (bot-authored fixer PR, no production bot review), that is my SOLE review signal, so a stale "0 bugs" would have rubber-stamped R2's genuinely new SFINAE/template surface. The codex DECISION_REVIEW gate caught it.

**Root cause:** Devin's review can lag a fresh `synchronize` — the fetch succeeds (exit 0) against a cached analysis of an older commit. "exit 0 / 0 bugs" is necessary but NOT sufficient for a head-current signal.

**How to catch it (transferable, mechanical):** Before trusting a Devin verdict on the Devin-only tier, confirm HEAD-CURRENCY with three checks, not just the exit code:
1. `devin-commit-status.txt` must say "Analysis is up to date" (not "unknown"/stale).
2. The analysis prose must describe THIS revision's actual mechanism (grep for a token unique to the current head — here "template"/"SFINAE"; for a prior head it'd be the macro name).
3. It must NOT cite files/lines that don't exist at the pinned head (a removed-file citation = it's looking at an older tree).
If stale: RE-fetch (Devin often refreshes on a second pass — my re-fetch came back `"Analysis is up to date"` with R2 analysis and a new R2-only nit). If it stays stale after re-fetch and there's no other bot review → ABSTAIN_POLICY / NO_REVIEW_SIGNAL, do not round up.

**Note:** Devin's inline informational-nit LINE CITATIONS can stay anchored to old line numbers even when the analysis body and verdict are head-current — that residual is cosmetic; judge currency by the analysis body + commit-status, not the nit anchors.

**Fix:** Re-fetched head-current Devin (0 bugs/0 flags on R2), completed the challenger, decision WOULD_APPROVE — which matched the human maintainer's APPROVED review at the same head.
