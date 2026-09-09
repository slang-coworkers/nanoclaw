---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786499523694-gcjjz6
written_at: 2026-08-12T02:40:56.767Z
---

# [approver/challenger-calibration] hard-coded identifier in a parameterized tool — verify against the file's own convention

**Symptom (slang#12481 @ 6979ee468aeb, BLOCK, fallback tier).** A CI-analytics
tooling PR (`extras/ci/analytics/ci_health.py`) added a "PR" link column to the
pending-approvals table. Devin surfaced one 🔴; CodeRabbit posted only a minor
JS-test-coverage nit and missed the bug. The 🔴: the new PR-link cells hard-code
`https://github.com/shader-slang/slang/pull/{pr_number}` (JS widget `:1412`,
Python renderer `:1250`) even though the tool is `--repo OWNER/REPO`
parameterized.

**Root cause / why it's a real bug, not a nit.** `pr_number` is sourced from
`repos/{repo}/actions/runs`, so when the dashboard is generated for any other
`--repo`, the hard-coded host yields a link to an unrelated `shader-slang/slang`
PR of the same number. The defect is on the LIVE render path (the JS widget
`PENDING_APPROVALS_JS`, templated at `:1662`, inserted into `body` at `:1672`) —
which even has `var repo` in scope at `:1363` (used for its own API fetch at
`:1364`) yet ignores it in the new link. The Python `render_pending_approvals`
copy carries the same defect but is dead code (defined `:1198`, never called).

**How to catch it (the transferable class).** When a diff introduces a URL /
path / identifier built from a **literal** in a tool that is otherwise
**parameterized** (a `--repo`/`--target`/`--env` arg, a `DEFAULT_*` constant
threaded through `main()`), probe two things: (1) does the surrounding file
build the *same kind of value* parameterized elsewhere? Here the file's own
`fetch_merge_queue_status` at `:444` builds `f"https://github.com/{repo}/pull/
{pr_number}"` — the new code silently diverges from the established convention.
(2) Is the parameter already **in scope** at the new call site? If yes (JS `repo`
var), the literal is unambiguously a bug, not a simplification. A single-repo
assumption baked into a multi-repo tool is a live defect regardless of green CI —
CI ran against the default repo, so it can never exercise the broken branch.

**Also: verify blast radius before finalizing.** Grep whether the flagged
function is actually called. One of the two instances here was dead code; the
BLOCK correctly rested on the live JS instance. A defect in dead code alone would
be a 🟡, not a 🔴 — pin which copy renders.

**Fix.** JS: use the in-scope `repo` var (one line). Python: thread a `repo`
argument in per the `:444` convention, or delete the unused renderer.
