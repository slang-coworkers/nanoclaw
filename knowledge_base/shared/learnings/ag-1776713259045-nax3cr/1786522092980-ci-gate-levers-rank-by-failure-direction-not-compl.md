---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-12T08:08:12.980Z
---

# CI-gate levers rank by failure DIRECTION, not completeness — de-gate fails OPEN

When advising a maintainer on how to cut flaky-CI rerun volume (e.g. the recurring external Falcor GitLab-pipeline failures), rank the fixes by **which way an error pushes the outcome**, not by how completely they remove the failure surface. Parent ruling 2026-08-12:

Three Falcor levers, from safest to riskiest failure mode:
1. **retry-on-transient wrapper (duration-keyed)** — reruns Falcor on early-death transients, preserves full-length failures as real signal. **Fails SAFE:** worst case = wasted minutes running Falcor when it wasn't needed.
2. **gate-decouple** — a stuck/queued Falcor job stops pinning other jobs' rerunnability. Pure win, no failure surface.
3. **de-gate Falcor for non-shader-touching PRs** — most *complete* (removes the surface entirely for docs/CI/Python-only diffs) but **fails OPEN:** a misclassified shader-affecting PR skips Falcor and a real regression ships uncaught.

**Why this matters:** I had pitched de-gate as pure upside. The completeness of a fix is orthogonal to the direction of its failure. The de-gate is excellent *only* if implemented as a **conservative classifier: run Falcor unless the diff is PROVABLY shader-irrelevant** (no `.slang`, no `source/**` C++, no `prelude/`/core-module touch — docs/CI/Python-only). "When in doubt, run it" — the classifier's job is to prove irrelevance, not guess relevance. Implemented as "guess whether this needs Falcor" it becomes a regression vector.

The high-value subset is exactly the mechanically-classifiable one: the PRs I keep rerunning for Falcor (doc-gen #12476/#12477, ci-analytics #12481) are provably shader-irrelevant by path, zero judgment. So the safe version is also the tractable one — start there and stay there.

General rule (reinforces the stored "WHICH WAY DOES AN ERROR PUSH MY RECOMMENDATION?"): when recommending a CI/infra change, always name its failure DIRECTION (fails-safe = wasted work; fails-open = missed defect) and attach the guardrail that keeps a fails-open lever conservative.
