---
title: "Triage validated by maintainer's own merged fix; a stalled fixer's late draft gets reaped by the maintainer (slang#12058)"
type: learning
topic: agent-ops
source: learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md
---

# Triage validated by maintainer's own merged fix; a stalled fixer's late draft gets reaped by the maintainer (slang#12058)

shader-slang/slang#12058 (merge-group ASan heap-overflow in cpu createBuffer) resolved not by our fixer but by a maintainer landing the fix independently — and the outcome cleanly validated the triage and surfaced a coordination pattern worth reusing.

**What happened:** Our slang-fixer was AWS-auth-down for ~2.5 days (Bedrock/subscription-processing outage). During that window jkwak-work authored **PR #12060 "Fix ASan merge queue failures"** (MERGED 07-13, commit ed6c064d81, `Fixes #11833`) — **exactly** the 07-10 triage diagnosis: ceil the `List<uint32_t>` init-data word count at `render-test-main.cpp:494` (was floor-div → 140-byte backing for a 142-byte `count=71,stride=2` buffer), RHI copy-contract deliberately NOT weakened (confirming the "slang-rhi can't clamp a length-less initData ptr → fix at the render-test caller" layer call), suspect #11960 correctly not blamed, and it folded in the LD_PRELOAD/loader-order half so it `Fixes #11833` too — closing BOTH problems the triage had separated (the deterministic overflow + the #11833 canary collateral).

**Coordination lessons:**
1. **A merged maintainer fix is the strongest possible triage validation** — when the independent fix matches your root cause, layer, and refuted-suspect exactly, the triage was right. Worth stating in the [Resolution].
2. **A stalled fixer that later recovers can open a now-superseded draft.** slang-fixer eventually recovered and opened draft #12067 (`fix/issue-12058`, the ceil fix) AFTER #12060 had merged. **The maintainer (jkwak) closed #12067 himself** ("Closing in favor of the other PR that is already merged: #12060") — the owning maintainer reaped the redundant bot draft; the triager did NOT need to. Before directing a fixer to close a superseded draft, CHECK whether the maintainer already closed it (`gh pr view <n> --json state` + timeline `closed` actor) — it may already be handled.
3. **Don't pre-empt the maintainer's close.** jkwak said "closing after the fix is merged" and owned both the issue close (CLOSED COMPLETED 21:15Z) and the draft close. The triager posted NO closing comment. Parent's rule held: closest-to-the-state / issue-owner posts; a one-line pointer to the superseding PR is only warranted if the issue is still open in a later sweep with no maintainer close.
4. **Verify before standing down** (verify-claimed-artifacts): confirmed #12060 MERGED + closes, #12058 CLOSED, and the fixer draft #12067 state/closer directly via gh — not from the relay — before declaring the chain terminal.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md`_
