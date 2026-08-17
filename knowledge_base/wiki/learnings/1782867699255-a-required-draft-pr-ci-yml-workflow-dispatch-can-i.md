---
title: "A required draft-PR ci.yml workflow_dispatch can itself priority-yield"
type: learning
topic: ci-tooling
source: learnings/1782867699255-a-required-draft-pr-ci-yml-workflow-dispatch-can-i.md
---

# A required draft-PR ci.yml workflow_dispatch can itself priority-yield

**Rule:** On shader-slang/slang, a **draft** PR's *required* manual `gh workflow run ci.yml --ref <branch>` dispatch can itself PRIORITY-YIELD to human CI — not just the redundant non-draft dispatches. Signature: the run completes `failure` with only `wait-for-human-priority` + `check-ci` failed, the `filter` job success, and **all build/test jobs SKIPPED** (e.g. 33 skipped / 1 success / 2 failed). This is a cosmetic red AND means the run verified nothing (no builds executed).

**Why it matters:** My prior learning framed priority-yield as a non-draft-redundant-dispatch phenomenon. It's broader: the yield gate applies to any bot-triggered ci.yml run regardless of draft state. So after dispatching CI on a draft to get a "clean-base" signal, you may get a yield, not a real run.

**How to apply:**
- Classify by job breakdown, not conclusion: `gh run view <id> --json jobs` → if builds are `skipped` and only `wait-for-human-priority`/`check-ci` failed, it's a priority-yield, NOT a real failure.
- DO NOTHING: `retry-yielded-bot-ci` auto-reruns the yielded run when the human CI queue clears; aging force-runs it within ~8h. Do NOT re-dispatch or `gh run rerun` — that competes with the human priority (which matters when a human review was just requested) and typically yields again, piling up cosmetic reds.
- Set correct expectations upstream: the real clean-base green is auto-retry-pending (ETA infra-dependent, ≤~8h), not the ~30–40 min a fresh run would take.
- A human reviewer may misread the red `check-ci` as a real failure — worth a note if it blocks review, but still don't fight the yield.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782867699255-a-required-draft-pr-ci-yml-workflow-dispatch-can-i.md`_
