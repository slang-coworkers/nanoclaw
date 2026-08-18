---
title: "[approver/clause-gap] dependabot Go-module bump in extras/scaler — Devin-only tier, no-Go-CI caveat clears on isolated blast radius"
type: learning
topic: review-approval
source: learnings/1784301449667-approver-clause-gap-dependabot-go-module-bump-in-e.md
---

# [approver/clause-gap] dependabot Go-module bump in extras/scaler — Devin-only tier, no-Go-CI caveat clears on isolated blast radius

**Class:** dependabot dependency-bump PR touching a **standalone Go module** in the repo (`extras/scaler/go.mod` + `go.sum`), not the C++ compiler. First seen: shader-slang/slang#11975 (golang.org/x/crypto 0.48.0→0.52.0 + transitive x/net/x/sys/x/text/x/sync), decided WOULD_APPROVE (CLEAN).

**Symptom / setup.** dependabot[bot] authored → `harvest-reviews.py` returns **exit 20** (no bot review AND no review bot working: production claude-code-action skips bot-authored PRs). This is the legitimate Devin-only fallback tier — NOT an abstain. Author association resolves to CONTRIBUTOR (trusted under v0-shadow-relaxed), same-repo head, `go.mod`/`go.sum` are NOT in the relaxed protected set (only `.github/**`, `**/slang-tag-version.h`), 28 lines / 2 files → all 6 clauses pass.

**Root cause of the one real judgment call.** There is **no `go build` / `go test` / `actions/setup-go` anywhere in `.github/workflows/*`** — grep it to confirm. So the green C++ CI matrix at head is **orthogonal** to the bump; no CI job compiles the Go module against the new deps. This is exactly the [approver/human-disagreement] "CI static 0-bugs is weak without a build that exercised the change" pattern — a candidate OPEN_GAP.

**How to catch it / decide.** For an **indirect, minor-version** golang.org/x/* bump in a module that is (verify each): not referenced by any `CMakeLists.txt`/`*.cmake`, not linked into the compiler, not shipped, no public/ABI surface, and whose only workflow mentions are **comments** (`# See extras/scaler.`) — the no-CI-build caveat CLEARS under the conservative-lean severity bar: trigger (transitive breaking change surfacing in the tool's build) is very low-probability for an indirect minor bump, and blast radius is confined to an internal ops tool discoverable/fixable in isolation on its next build.

**Verify the bump yourself (don't just trust Devin) — the go.sum integrity check:** every bumped module must carry BOTH a `h1:` (zip) hash and a `/go.mod` hash at its new version on the `+` lines, with the old-version pairs cleanly removed on `-` lines. Missing/orphaned entries = inconsistent module graph = ABSTAIN/BLOCK. All 5 modules here checked out.

**Fix / rule.** dependabot Go-module bump in a decoupled tool → Devin-only tier is correct; run the go.sum hash-pair check + the decoupling check (CMake/link/ship/ABI + workflow-is-only-comments); if all clean and the bump is indirect+minor, the no-Go-CI gap is inconsequential → WOULD_APPROVE. If the module WERE built/tested by CI, or the bump were a **direct** dep / **major** version, re-weigh the gap upward (ABSTAIN_POLICY:OPEN_GAP) since a break would then be reachable/consequential.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784301449667-approver-clause-gap-dependabot-go-module-bump-in-e.md`_
