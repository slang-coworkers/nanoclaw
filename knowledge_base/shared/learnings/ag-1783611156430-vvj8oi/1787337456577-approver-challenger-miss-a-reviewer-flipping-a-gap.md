---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787252601504-evr6bh
written_at: 2026-08-21T18:37:36.577Z
---

# [approver/challenger-miss] A reviewer flipping a 🟡 gap to ✅ on byte-identical tests is a softened stance, not new evidence — diff the blobs before letting it move your decision

## Symptom
slang#12649 rev 3: the tasking asked "did this push add the missing behavioral coverage that drove the rev-2 ABSTAIN(OPEN_GAP)?" The production (github-actions[bot]) review flipped its verdict from rev-2's "🟡 Minor — coverage gap at :770" to rev-3's "✅ Clean — no significant issues found", explicitly stating it "reviewed test coverage across ... the compile() integration — no keepable findings." Taken at face value, that reads like the gap was closed. It was not.

## Root cause
The two test files were BYTE-IDENTICAL between rev 2 and rev 3 (verified: `gh api .../contents/<f>?ref=<sha> --jq .sha` returned the same blob sha on both heads). The rev2→rev3 code delta was comment/doc-only: it reconciled a clarity nit and ADDED A COMMENT documenting the coverage limitation ("exercised only indirectly: reaching them needs a loaded NVRTC, which GPU-less CI does not have"). So the reviewer's flip was a change of STANCE about the same unchanged code (deciding GPU-less-CI-inherent coverage is acceptable), not a response to new tests. Peer agreement adds no instrument; a softened verdict on identical artifacts is the reviewer making the exact judgment call the abstain exists to route to a human.

## How to catch it
On any revision that claims to address a prior gap: don't diff the REVIEW PROSE, diff the ARTIFACTS. For a coverage gap, compare the test-file blob shas at the prior head vs the new head (`gh api .../contents/<path>?ref=<sha> --jq .sha`), or diff the two `gh pr diff` outputs. If the tests are byte-identical, no coverage was added — regardless of what the review verdict now says. A reviewer verdict moving in your preferred direction on unchanged code is the single most seductive false signal (it feels like corroboration); treat "verdict improved" as a claim to audit against the diff, exactly like a challenger correction.

## Fix
Re-derive the gap's reachability from source each revision rather than re-firing the prior row: here deepwiki confirmed `__cuda_sm_version` accepts an arbitrary SemanticVersion (8.1) fed straight into the untested resolution integration, so the gap was REAL (a live snap-up path), not future-proofing — which STRENGTHENED the abstain. The rule cuts both ways: the same blob-diff that refuses a fake "coverage added" would also let you CLEAR a prior abstain if the tests genuinely changed. The decision follows the artifacts, not the prose. (Companion to the earlier [approver/challenger-miss] note on no-op-equivalent E2E tests and the [approver/clause-gap] note on commit-gating harvested reviews.)
