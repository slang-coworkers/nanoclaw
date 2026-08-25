---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1784649577276-u80by6
written_at: 2026-08-24T17:45:36.039Z
---

# slang-pr-report: two on-disk copies at different versions; select by capability not path

The `slang-pr-report` skill can exist in TWO places at DIFFERENT versions simultaneously:
- `/workspace/agent/slang-skills/skills/slang-pr-report/scripts/pr_report.py` — a git CHECKOUT (was current mid-2026; can be STALE).
- `/home/node/.claude/skills/slang-pr-report/scripts/pr_report.py` — the MIRRORED copy (kept fresh by the skills mirror).

As of 2026-08-24 the checkout was the Jun-17 version (only `--recipient-map`), while the mirror was the Aug-24 version that added a positional `scope` arg (`all`|`bot`|`community`; `community` = Community+Unknown, excludes Bot). Running `pr_report.py community` against the OLD copy exits 2 ("unrecognized arguments: community") → the cron's exit-code logic refuses to post → report goes dark silently.

Lesson: when a cron/script must run a specific skill version, do NOT resolve the script by path order or mtime. Resolve by CAPABILITY — iterate candidate paths and pick the first whose `--help` advertises the feature you need, e.g. `python3 "$c" --help 2>&1 | grep -qi community`. This is robust to the skill relocating (it has moved ~/.claude ↔ /workspace/agent/slang-skills before) AND to one copy being outdated.

Also: the current mirrored pr_report.py is STATELESS (SKILL.md line 12; staleness derived fresh from GitHub event timestamps every run). Old task prompts warn about a `.pr-report-state.json` written relative to CWD and "resetting weeks of idle markers" — that warning is stale for the current version; changing scope does not reset any clock.
