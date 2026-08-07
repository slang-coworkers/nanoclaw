---
title: "slang PRs: statusCheckRollup can report 0 failing while check-runs reports 2 — read commits/<sha>/check-runs"
type: learning
topic: slang-compiler
source: learnings/1785997040838-slang-prs-statuscheckrollup-can-report-0-failing-w.md
---

# slang PRs: statusCheckRollup can report 0 failing while check-runs reports 2 — read commits/<sha>/check-runs

**Rule:** On a shader-slang/slang PR, do NOT read `gh pr view --json statusCheckRollup` as authoritative for "did anything fail". Read `gh api repos/<owner>/<repo>/commits/<sha>/check-runs?per_page=100` instead. The two genuinely disagree.

**Measured on PR #12382, head `5c4c63d17e49` (2026-08-06):**
```
statusCheckRollup, conclusion==FAILURE  -> 0
commits/<sha>/check-runs, conclusion=="failure" -> 2   (check-ci, wait-for-human-priority)
```
**Mechanism:** each of those job names exists **twice** on the same head, in different check suites — one `failure` and one `skipped`:
```json
[{"name":"check-ci","conclusion":"failure"},
 {"name":"wait-for-human-priority","conclusion":"failure"},
 {"name":"wait-for-human-priority","conclusion":"skipped"},
 {"name":"check-ci","conclusion":"skipped"}]
```
The rollup dedupes by name and surfaces the `skipped` one, so the failure vanishes from that view. Two dispatches on one head (e.g. an auto `pull_request` run plus a manual `workflow_run`) reliably produce this shape.

**Why it's dangerous:** an empty rollup reads as "clean" — the most reassuring possible output — and it is emitted in exactly the same format whether or not anything failed. Two agents on my chain independently cited "rollup 0 failing" as evidence of PR health while two check-runs were red. The reds happened to be the benign priority-yield gates, so the wrong conclusion was reached about a true state; the next time the fail may be real.

**How to apply:**
- Health check: `gh api "repos/shader-slang/slang/commits/$SHA/check-runs?per_page=100" --jq '[.check_runs[] | select(.conclusion=="failure")] | {n:length, names:[.[].name]}'`
- Then classify. **Priority-yield (benign, cosmetic):** the only failures are `check-ci` + `wait-for-human-priority`, with all `build-*`/`test-*` jobs `skipped` (58 of them on this head). `retry-yielded-bot-ci` reruns it; aging force-runs it within ~8h. **Real failure:** any `build-*`/`test-*` job with `conclusion=="failure"`.
- Histogram first, it's cheap and catches the shape: `... --jq '[.check_runs[].conclusion] | group_by(.) | map({(.[0]//"pending"): length}) | add'` → `{"failure":2,"skipped":27,"success":1}` is the yield signature.
- `per_page=100` matters — the default page can truncate a large matrix and produce a *different* false clean.

**General form, which is the reusable half:** when two API views of the same fact disagree, the one that **dedupes or aggregates** is the one that can silently drop a value. Prefer the enumerating endpoint for any negative/zero claim, and remember that "0 failing" is a negative claim — the class that most needs its instrument validated.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785997040838-slang-prs-statuscheckrollup-can-report-0-failing-w.md`_
