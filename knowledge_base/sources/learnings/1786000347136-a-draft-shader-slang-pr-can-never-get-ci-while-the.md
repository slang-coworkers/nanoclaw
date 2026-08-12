# A draft shader-slang PR can never get CI while the branch is active — every push disqualifies the prior yielded run, so responding to review resets the retry clock

"CI keeps yielding" on a **draft** shader-slang/slang PR is not a transient queue state. It is structurally unreachable while the branch is active. Three facts, all verified at source:

1. **A draft PR has no `pull_request` CI at all.** `.github/workflows/ci.yml:15` gates the `filter` job on `github.event_name != 'pull_request' || github.event.pull_request.draft != true` (repeated at `:681`), and every build/test job `needs: filter`. So all `pull_request` runs on a draft branch are `completed/skipped`. **Those skips are expected — never read them as evidence of coverage or of a problem.**
2. The bot therefore dispatches CI via `workflow_dispatch`, and only those runs can yield — which is why a failing run shows exactly `wait-for-human-priority: failure` + `check-ci: failure` with everything else skipped, reason `::error::priority-gate-yielded: higher-priority CI is active; ci-retry-yielded-bot will rerun this bot CI when quiet`. Benign.
3. **The retry never fires while the branch is active.** `extras/ci/retry-yielded-bot-ci.py:107-119` — `has_newer_run_for_branch(run, runs)` returns `True` when another run on the same `head_branch` has a higher `run_number`, and such candidates are skipped. **Every push simultaneously creates a new yielded dispatch and permanently disqualifies the prior one.**

**The counter-intuitive consequence:** *responding to review is what keeps resetting the retry clock.* A fixer iterating attentively on feedback structurally guarantees CI never retries. Measured on #12382 (2026-08-06): four dispatches in 61 minutes, all yielded, each disqualifying its predecessor. It clears only when the branch goes quiet for a full retry window, or the draft flips ready (releases the gate in ~30s).

**How to apply:**
- **Don't hand "nudge CI" to the fixer as an action item.** It isn't theirs to force. Route it to the operator/maintainer as a draft-flip-or-quiet-window decision.
- **A local build of the head is load-bearing, not redundant**, on any active draft — it may be the only build/test evidence that exists. State its scope honestly: one configuration (e.g. Linux/GCC-12/Release) is a smoke test, not the Windows/MSVC + macOS/Clang + GPU matrix. Byte-verify the binary contains the change first.
- **Distinguish the two skip populations when reporting.** `pull_request` skips = draft by construction. `workflow_dispatch` skips alongside two priority-gate failures = yielded. A bare "30/30 skipped, 1 failure" conflates them and reads as an unexplained red.
- Discriminator for the benign case: count non-skipped jobs in the failing run. Three (`filter: success`, `wait-for-human-priority: failure`, `check-ci: failure`) ⇒ priority yield, not a code failure. Confirm with `gh run view <id> --log-failed | grep priority-gate-yielded`.
- Timestamp every CI reading — a reading against a SHA expires even though the source at that SHA does not.
