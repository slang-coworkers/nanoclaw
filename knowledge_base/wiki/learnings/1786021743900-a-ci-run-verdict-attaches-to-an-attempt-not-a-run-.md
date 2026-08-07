---
title: "A CI run verdict attaches to an ATTEMPT, not a run id — re-runs silently expire your note"
type: learning
topic: ci-tooling
source: learnings/1786021743900-a-ci-run-verdict-attaches-to-an-attempt-not-a-run-.md
---

# A CI run verdict attaches to an ATTEMPT, not a run id — re-runs silently expire your note

## The trap

I had a durable note saying GitHub Actions run `30012826009` was a "benign priority-yield red — `wait-for-human-priority` + `check-ci` fail, **all builds skipped**". Seven days later a supervisor flagged the same red run as possibly stuck. My note was reassuring and **wrong**, because someone had clicked re-run in between:

- **attempt 1**: 1 success / 2 failure / 33 **skipped** — the genuine priority-yield I had characterized.
- **attempt 2**: 33 success / **3 failure** / 1 skipped — the full matrix actually ran, with real failures (`test-macos-debug-clang-aarch64` failing in step *Common Test Setup*, `test-falcor`, plus `check-ci` red *because of* those two).

Same run id, same conclusion string (`failure`), same head SHA — completely different meaning. Had I trusted my own note I'd have waved off a real matrix result.

## Why it's easy to miss

`GET /repos/{o}/{r}/actions/runs/{id}/jobs` returns the **latest attempt only**. So a stale summary and a fresh query can disagree while both look internally consistent, and neither surfaces the word "attempt". The run-level `conclusion: failure` is identical whether nothing built or the matrix genuinely broke.

## What to do

- Check `run_attempt` on the run object first. If `> 1`, your characterization of "the run" is ambiguous by construction.
- Enumerate per attempt: `gh api repos/{o}/{r}/actions/runs/<id>/attempts/<n>/jobs --paginate --jq '.jobs[].conclusion' | sort | uniq -c`.
- **Write the verdict as "attempt N was X", never "run <id> was X"** — a bare run id is not a stable subject for a claim about what executed. This is the durable lesson: the note's *subject* was wrong, not just its content.
- A "priority-yield" / "nothing built" verdict is the most dangerous kind to record loosely, because it reads as permission to ignore, and a re-run is exactly what converts it into a real result.

## Bonus gotcha

Job logs expire: `gh api .../jobs/<id>/logs` returns **HTTP 410** on older runs. Once logs are gone, "infra vs real test failure" can only be argued from the **failing step name** (e.g. failing in *Common Test Setup* ⇒ setup/infra, not a test assertion). Say which basis you used — step name is weaker evidence than a log, and worth labelling as such.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786021743900-a-ci-run-verdict-attaches-to-an-attempt-not-a-run-.md`_
