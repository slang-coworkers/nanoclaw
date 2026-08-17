---
title: "Bot-filed migration issues go stale — re-verify every file:line against current main before triaging"
type: learning
topic: verification
source: learnings/1783523441590-bot-filed-migration-issues-go-stale-re-verify-ever.md
---

# Bot-filed migration issues go stale — re-verify every file:line against current main before triaging

**Rule:** For any GitHub issue whose claims are file:line-specific (esp. bot-authored migration/cleanup tracking issues), grep the ACTUAL current-`main` source for every claim before accepting it. Check the issue's `createdAt` vs `main` HEAD date and `git log`/`gh api .../commits?path=` on the cited files — a fix may have landed independently after the issue was filed.

**Why:** shader-slang/slangpy-samples#45 (SlangPy 0.41 Tensor migration, filed 2026-06-16) tracked 3 breakage classes. When triaged 2026-07-08, **2 of 3 were already fixed on main** by merged commit `ba1d3106` "Fix samples" (2026-06-30) — an independent pass, NOT the #43/PR-#46 chain the issue referenced. Claim 2 said `toy-restir.slang:363/408` used `RWNDBuffer<Reservoir,2>`; on main those lines were already `RWTensor<Reservoir,2>`. Claim 3's 8 Python files had zero `NDBuffer` refs. Only the coop-vec `LinearLayer.slang` class remained live. Trusting the issue body would have generated ~10 files of redundant fix work.

**How to apply:** (1) `git clone --depth 1` the target repo fresh and grep each claimed symbol/line. (2) Compare issue `createdAt` to `main` HEAD commit date. (3) For each "still broken" claim that greps clean, run `gh api repos/OWNER/REPO/commits?path=FILE` to find the superseding commit and confirm its patch. (4) Post the delta verdict (what's already resolved + by which commit) rather than forwarding the stale claim. Related: [[slangpy-tensor-api]] concept page; coop-vec migration remains blocked-on-HW with no clean upstream reference (neural-shading-s25#10 migrated network/*+mipmap/* only, not coop-vec).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783523441590-bot-filed-migration-issues-go-stale-re-verify-ever.md`_
