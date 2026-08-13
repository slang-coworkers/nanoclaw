---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786530015358-4zflwj
written_at: 2026-08-12T11:15:25.328Z
---

# [approver/challenger-miss] Devin-in-subagent: read devin-page.txt for the Bugs/Flags tally, not the subagent's devin-flags.md

**Symptom.** On PR #12492 (shader-slang/slang, Devin-only tier) I drafted WOULD_APPROVE. The
DECISION_REVIEW critique (codex, round 1 = must-fix) caught that my synthesized review-doc reported
"0 flags" while Devin's raw page (`review/devin-page.txt:948`) recorded **1 Flag** — Devin's middle
severity tier, above "Informational": *"Ref accessor bodies without a materializable address now
become hard errors"* (`slang-lower-to-ir.cpp:8869-8893`). My challenger had evaluated an incomplete
finding set; the recovered Flag was an OPEN_GAP that flipped the decision to ABSTAIN_POLICY.

**Root cause.** Two compounding:
1. **Extractor miss (my pr-12450 failure mode, verbatim):** an empty/partial DERIVED artifact is a
   claim about the EXTRACTOR, not the source. The subagent's `devin-flags.md` had a "## Flags:
   (none reported)" section even though the raw capture it wrote alongside (`devin-page.txt`) listed
   the Flag. Devin's UI keeps the Flag panel collapsed by default, so a scrape that only reads
   expanded panels silently drops it.
2. **Delegation hid the miss.** Running Devin in a background subagent (correct, for context
   hygiene — it keeps ~20% browser churn out of the main context) means only the subagent's SHORT
   reply re-enters my session. I trusted its summary *count* instead of its *raw* capture. The
   delegation that saved context also moved the extractor error out of my sight.

**How to catch it.** On the Devin-only tier, the Devin finding tally is decision-critical (it's the
sole signal). After the subagent returns, **grep the raw `review/devin-page.txt` myself** for the
`N Bugs` / `N Flag(s)` counters near the "Chat about this PR" / "Info" section, and reconcile them
against the subagent's `devin-flags.md`. A mismatch ⇒ the derived artifact is wrong; recover from
the raw page. Never record a zero-findings Devin result without confirming it against the raw
capture. (Devin has three severity tiers: **Bugs** > **Flags** > **Informational** — a "Flag" is
NOT an informational nit.)

**Also (pr-12459 corollary, applied correctly here):** do NOT inherit the "Flag" severity marker.
Devin listed 0 Bugs, so the Flag is a behavior-change *concern*, not a verified defect ⇒ evaluate
it from source. It landed as OPEN_GAP (source-compat narrowing: previously-compiling non-l-value
`ref` bodies now hard-error, against a "pr: non-breaking" label; "already-broken only" was inferred
from the PR body, not verified; blast radius untested) — an ABSTAIN, not a BLOCK.

**Fix.** Add a reconciliation step to the /slang-pr-approve synthesis on the Devin-only tier:
before writing the embedded `_approver_result` counts, read `devin-page.txt`'s own tally and assert
it equals what `devin-flags.md` extracted; on mismatch, recover findings from the raw page.
