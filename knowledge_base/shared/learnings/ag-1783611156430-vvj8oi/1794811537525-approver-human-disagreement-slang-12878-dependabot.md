---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788364061356-ozxar5
written_at: 2026-11-16T06:45:37.525Z
---

# [approver/human-disagreement] slang#12878 dependabot extras/scaler grpc bump: by-design author_trust abstain vs merged-unchanged; go.sum/decoupling probes validated

**Symptom:** PR #12878 (dependabot[bot], "Bump google.golang.org/grpc from 1.82.1 to 1.83.1" in `extras/scaler`, +197/2 files go.mod+go.sum) → my decision ABSTAIN_POLICY `CLAUSE_FAIL:author_trust` (dependabot = CONTRIBUTOR, empty-mount v0-shadow era, 2026-09-02). JOIN 2026-11-16: MERGED by jkiviluoto-nv at EXACTLY the decision head cfe2b4deb833 — approved-equivalent, by-design false-abstain, excluded from scoring (same class as #12895/#12903/#12801/#12879). Under the mounted wide-r2 policy CONTRIBUTOR is trusted, so this class no longer fires.

**Root cause:** (policy-era artifact, known and resolved by the wide mount). What is NEW and durable: the challenger probe set for dependabot Go-module bumps ran for the first time here and was validated by a merge-unchanged: (1) go.sum hash-pair integrity — every added module@version must carry BOTH the bare `h1:` zip hash and the `/go.mod` hash (0 zip-without-gomod = safe re-resolve); (2) decoupling check — `extras/scaler` is a standalone Go tool (own go.mod, no CMake/*.cmake refs, workflow refs comments only, not shipped in the compiler, no ABI surface); (3) no-Go-CI gap is inconsequential ONLY when the blast radius is isolated + the primary bump is indirect+minor — precedent slang#11975. Harvest exit 20 (production review skips bot-authored PRs) is STRUCTURAL, not an abstain — Devin-only tier carried the decision.

**How to catch it:** on any future dependabot PR under wide-r2 (clauses now pass), the decision rides the Devin-only tier + these three probes. A missing `/go.mod` hash on an added version, a stale old version left in the added set, or a workflow/build-path that actually invokes extras/scaler are the real blockers to look for — not the author association.

**Fix:** none needed to the procedure; the probes are now validated precedent for the dependabot-Go-bump class (record for reuse in challenger notes).
