---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787680030974-lt372z
written_at: 2026-08-25T19:05:44.187Z
---

# [approver/challenger-miss] Verifying a Devin "bug" as false requires opening the exact rule it cites — not adjacent artifacts

**Symptom:** On slang#12378 (adds new diagnostic E55216) Devin flagged one "Bug": "new compiler error added without the documentation update the contribution rules require." I called it "verifiably false" and initially set bugs=0, citing (a) the diagnostics-code catalog under `docs/generated/` being auto-generated "Do not edit by hand", (b) `docs/diagnostics.md` being a system how-to, and (c) the sibling precedent E55213 (#11297) having no doc entry. The DECISION/OUTPUT critique gate forced me to open `CONTRIBUTING.md` — which at **:362-368 ("Documenting New Diagnostics")** states outright: *"When introducing new compiler warnings or errors ... update the relevant documentation in the same PR"* (docs/language-reference, docs/user-guide, docs/design). The PR touches zero `docs/` files. The finding was **supported by policy**, not false.

**Root cause:** I verified against three *adjacent* artifacts but never opened the *exact* document Devin named ("the contribution rules"). Adjacent evidence (a generated catalog; a precedent that itself skipped the rule) says nothing about whether the cited rule exists. This is a LIMIT-class over-claim ("there is no doc requirement") asserted about a file I did not read — the classic "claim about a state I did not open".

**How to catch it:** When a review finding cites a *named rule/doc/policy* ("the contribution rules require X"), the ONLY refutation is opening that exact source and reading the clause. Grepping neighboring files or reasoning from a precedent's absence is not verification — a precedent lacking the artifact may just mean that PR also skipped the rule. Before writing "verifiably false" about a process/policy claim, name the file:line of the rule you read that contradicts it.

**Second lesson (fallback-tier synthesis):** the synthesis step must NOT pre-clear a Devin/CodeRabbit "Bug" to bugs=0 no matter how confident you are it's wrong — the mechanical fallback map is bug⇒REQUEST_CHANGES(bugs=1), and only the Step-3 challenger may reason about it (and it may never upgrade a red finding to approval). Pre-clearing collapses the audit trail.

**Third lesson (ordering):** open CONTRIBUTING.md / the cited policy DURING synthesis+challenger, before recording. I recorded ABSTAIN believing the finding false, then the gate revealed it true (procedure→BLOCK) — but `record_decision` is append-only/first-write-wins, so the ledger row could no longer be corrected. Verify policy claims before the ledger append, not after.

**Distinguish two claims:** "the doc rule applies" (verifiable: yes, any new error) vs "the omission should block the merge" (maintainer judgment). The procedure maps a verified 🔴 to BLOCK regardless; a maintainer (jkwak-work APPROVED at this head) may still not treat it as merge-blocking.
