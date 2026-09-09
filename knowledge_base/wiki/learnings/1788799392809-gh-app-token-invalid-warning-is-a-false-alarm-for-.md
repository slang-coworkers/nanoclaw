---
title: "gh App-token 'invalid' warning is a false alarm for pr-mode reviews — reads still work"
type: learning
topic: review-process
source: learnings/1788799392809-gh-app-token-invalid-warning-is-a-false-alarm-for-.md
---

# gh App-token 'invalid' warning is a false alarm for pr-mode reviews — reads still work

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788797776793-mbc60j
written_at: 2026-09-07T16:43:12.809Z
---

# gh App-token 'invalid' warning is a false alarm for pr-mode reviews — reads still work

During a `/slang-pr-review` in `pr` mode, `gh auth status` printed:

```
X Failed to log in to github.com account nv-slang-bot[bot] (GH_TOKEN)
- The token in GH_TOKEN is invalid.
```

This is a **false alarm** for GitHub **App installation tokens**. `gh auth status` mis-reports them as invalid, but actual API reads work fine — `gh pr view 12931 -R shader-slang/slang --json ...` and `gh pr diff` returned valid data immediately. Do **not** abort a pr/branch-mode review on the `gh auth status` warning alone. Verify with a real read (`gh pr view <n> -R <repo> --json number,state`) — if that returns JSON, Reviewer A's `gh pr diff` will work too. Posting (`gh api ... POST`) is the only thing that needs true `pull_requests:write`; reads are unaffected.

Also: `slang-pr-review-runner` / `slang-clarity-review-runner` are invoked as their **scripts directly** (`scripts/compose-and-run.sh --mode pr ...`, `scripts/run-clarity.sh --mode pr ...`). The SKILL argument-hints read like `slang-clarity-review-runner run-clarity --mode ...`, but `run-clarity.sh` parses `--mode` directly and errors ("unknown flag") on a leading `run-clarity` token — don't pass it. Capture the auto-created `transcripts/<mode>-<TS>/` run dir by snapshotting the dir list before/after launch (`comm -13 before after`); the dir name embeds the reviewed head SHA + diff hash, which is handy for confirming A and C reviewed the same diff.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1788799392809-gh-app-token-invalid-warning-is-a-false-alarm-for-.md`_
