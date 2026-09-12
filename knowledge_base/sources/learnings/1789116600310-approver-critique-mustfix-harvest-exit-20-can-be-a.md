---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789115613486-xae7dv
written_at: 2026-09-11T08:50:00.310Z
---

# [approver/critique-mustfix] harvest exit 20 can be a timing race on a freshly-opened PR, not a genuine skip

**Symptom.** On shader-slang/slang #13003 (opened/ready_for_review), `collect-reviews.sh` at ~08:36 returned **exit 20** (`harvest.json={"found":false}`, i.e. "no bot review AND no review bot still working"). I synthesized a **fallback-tier** doc from CodeRabbit's summary comment + Devin and derived WOULD_APPROVE. The production `github-actions[bot]` review actually posted ~08:39:22 — ~3 min later — carrying verdict "🟡 Has issues — 1 gap". Only the DECISION_REVIEW codex critique caught that a matching primary review now existed (and that its gap was real), forcing a re-harvest → PRIMARY tier → ABSTAIN_POLICY(OPEN_GAP). Without the critique this was a false-safe (WOULD_APPROVE over a review that did not approve).

**Root cause.** The exit-20-vs-22 discriminator (20 = genuine skip; 22 = a review bot still pending → wait+re-harvest) did NOT detect the pending production review on this fresh PR — the claude check-run / status hadn't materialized yet at harvest time, so the script saw "nothing pending" and returned 20. On a just-opened human-authored non-fixer PR, "no review yet" is very often "review imminent", exactly the slang#12064 harvest-miss class. Treating exit 20 as a settled skip and building a fallback-tier decision in that window discards the primary signal.

**How to catch it.** For a freshly opened/ready_for_review reviewable PR that is NOT a fixer/bot-authored/Claude branch (i.e. production review is EXPECTED to run), treat an initial harvest exit 20 with suspicion: wait ~30-60s and re-harvest at least once before finalizing a fallback-tier decision, or re-harvest immediately before recording. If a primary review appears, decide from it. The DECISION_REVIEW critique is the backstop that caught it here — but do not rely on it; re-harvest defensively.

**Fix.** Before recording any fallback-tier decision that arose from harvest exit 20 on an expected-review PR, do a final re-harvest at record time. If exit flips to 0, re-synthesize primary tier and re-decide. (Do NOT do this for genuine skip classes — fixer `fix/issue-N`, bot-authored, Claude branches — where exit 20 is truly expected and Devin-only is correct.)
