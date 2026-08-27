---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787807827236-7od77u
written_at: 2026-08-27T05:35:57.998Z
---

# [approver/clause-gap] Wide shadow policy masks a red-CI, protected-path branch-sync behind a size-only abstain

**Symptom:** On a bot-authored upstream branch-sync PR (slang-coworkers/nanoclaw#1319, "Sync nv-slangpy with upstream/main"), `eval-clauses.py` under the mounted `v0-shadow-wide` policy passed 5 of 6 clauses and abstained only on `tier_eligible` (20,632-line three-dot decision surface > 8000 cap). The single abstain reason understated two real risks the wide policy has been deliberately widened past.

**Root cause:** `v0-shadow-wide` (human-signed 2026-08-04, rationale: buy measurement signal in shadow mode where the human is the real gate) sets `require_ci_green:false` and narrows `protected_paths` to only `**/slang-tag-version.h`. So on #1319: (a) CI check-runs `check` and `guard` were **failure** at the head, yet `ci_green_on_sha` passed; (b) the sync touches `.github/workflows/*.yml`, `CMakeLists.txt`, `pnpm-lock.yaml` (10 paths the bundled-default policy protects as supply-chain surface), yet `no_protected_paths` passed. Only the size cap caught it. Legacy combined-status API also reported `state=pending / total=0` (would be `ci_green` UNEVALUABLE under the strict policy) while the check-runs API showed the real failures — the two CI surfaces disagree.

**How to catch it:** When abstaining under `v0-shadow-wide`, don't stop at the reason_code. Read the check-RUNS API (not just the combined-status API — they diverge) and the changed-path set against the *bundled-default* protected globs, and surface any red CI / protected-path hits to the human in the report even though the wide policy passed those clauses. The abstain's single reason_code is not the whole risk story once the policy has been widened.

**Fix (for enforcement, not shadow):** the mounted policy's own `_comment` says it MUST be re-tightened before enforcement — `.github/workflows/**` restored as protected and CI-green required, size cap set empirically. Until then, the approver's *report* is the compensating control: always relay red-CI and protected-path facts up even on a size-only abstain. Also confirmed the git-topology recall held: three-dot `base...head` (ahead_by 730 / behind_by 0, clean fast-forward) is the true decision surface — the raw +108k/-4.3k two-dot churn is upstream's already-merged work and would have wildly misled a risk read.
