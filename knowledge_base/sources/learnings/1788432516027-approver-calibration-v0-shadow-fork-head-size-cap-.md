---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788288292138-u6q846
written_at: 2026-09-03T10:48:36.027Z
---

# [approver/calibration] v0-shadow fork-head + size-cap abstain fired on a MEMBER-authored PR that merged unchanged

**Signal class:** ABSTAIN_POLICY (policy reason, excluded from agreement scoring) joined against a `github.pr_merged` outcome where the merged head == the decision commit (zero follow-up commits — the PR shipped exactly as reviewed).

**Instance (for grounding, not the lesson):** slang#12683 "Coalesce line coverage counters per straight-line region", decision commit `a69d2631c48b`. Decided ABSTAIN_POLICY on two v0-shadow clauses: `head_provenance` (fork head `jvepsalainen-nv/slang`) + `tier_eligible` (1216 lines > 400 cap). `author_trust` PASSED (`author_association=MEMBER`). The author (a MEMBER) then merged it unchanged at that same commit, and was the `merged_by` actor.

**Transferable takeaways:**
1. **The `head_provenance` fork-head clause is blunt: it abstains on trusted-MEMBER-owned fork branches identically to external-contributor forks.** When `author_trust` already passes as MEMBER/OWNER and the head is that same member's fork (very common — NVIDIA engineers push feature branches to personal forks of shader-slang/slang), the fork-head abstain is over-conservative rather than protective. This is by-design for the empty-mount v0-shadow policy (a known standing state — do NOT re-escalate the mount per-PR), but it is the dominant reason a legitimately-mergeable MEMBER PR lands as ABSTAIN. Expect it; report it cleanly as policy (not a code concern); a real policy would likely gate on author_trust, not raw head provenance.
2. **`tier_eligible` (400-line cap) will abstain most substantive compiler-pass PRs.** A new IR analysis + tests routinely exceeds 400 lines; the size cap is a coarse "too big to auto-approve, human must look" gate, not a code-quality signal. Pair the two clauses in the report so the human sees it's a size+provenance policy stop, not a defect.
3. **A documented, author-deferred limitation is not a merge-blocker for maintainers.** #12683 shipped with an explicitly-documented "Known gap" (exit analysis can't see invocation-abandoning intrinsics that lower to `GenericAsm`; currently `IgnoreHit`/`AcceptHitAndEndSearch`) that the author flagged "for a maintainer's merge decision." The maintainer merged with it unaddressed. Calibrated posture confirmed: **surface** such author-deferred documented limitations for the human, but do not treat them as an independent BLOCK — the abstain (or a WOULD_APPROVE, had the clauses passed) is the right lane, letting the human accept the tradeoff.
