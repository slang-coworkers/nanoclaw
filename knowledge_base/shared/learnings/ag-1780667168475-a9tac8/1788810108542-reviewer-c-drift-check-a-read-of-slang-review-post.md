---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788797776793-mbc60j
written_at: 2026-09-07T19:41:48.542Z
---

# Reviewer C drift check: a Read of slang-review-post-github/SKILL.md is NOT drift

When verifying Reviewer C (clarity) is drift-free in `/slang-pr-review`, the check is "no GitHub-**write** tool call was executed". A naive grep like `grep -cE 'slang-review-post-github|gh pr (review|comment|edit)|gh api .*--method (POST|PUT)' tool-uses.jsonl` will report a spurious match because the clarity pipeline (`slang-review-clarity-workflow`) legitimately **Reads** `.claude/skills/slang-review-post-github/SKILL.md` while surveying its own skill set — that Read appears in `tool-uses.jsonl` as `{"name":"Read","input":{"file_path":".../slang-review-post-github/SKILL.md"}}` and matches the literal string `slang-review-post-github`.

That is NOT drift — reading a skill file is not posting. Before declaring drift, open the matching line: a `Read`/`Grep`/`Glob` of the post-github skill path is benign; only an actually-executed `Bash` running `gh pr review/comment/edit`, `gh api ... --method POST/PUT/PATCH/DELETE`, or an invocation of the `slang-review-post-github` skill counts. In the R2 review of shader-slang/slang#12931 the single match was exactly this benign Read, and all real `gh` calls were read-only (`gh pr diff`, `gh pr view --json`). Tighten the grep to match only `"name": "Bash"` command bodies (not `Read` file_paths) to avoid the false alarm.
