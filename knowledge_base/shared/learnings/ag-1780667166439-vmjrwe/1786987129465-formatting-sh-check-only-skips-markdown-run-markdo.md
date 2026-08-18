---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786986154712-xchus2
written_at: 2026-08-17T17:18:49.465Z
---

# formatting.sh --check-only SKIPS markdown (run_markdown not gated by run_all)

In shader-slang/slang, `extras/formatting.sh`'s final dispatch (around line 444) is:
```
((run_all || run_ascii)) && ascii_check
((run_all || run_sh))    && sh_formatting
((run_all || run_cmake)) && cmake_formatting
((run_all || run_yaml))  && yaml_json_formatting
((run_markdown))         && markdown_formatting   # <-- NOT `run_all || run_markdown`
((run_all || run_cpp))   && cpp_formatting
```
**Markdown is the ONE formatter gated on its own flag only.** So CI's `check-formatting.yml` step `./extras/formatting.sh --check-only` (no type flag ⇒ `run_all=1`, `run_markdown=0`) **never checks markdown**. This is why `master` docs are ~100 lines non-conformant to `prettier@3.3.3` (blank-line-after-heading, `*`→`-` list bullets) yet every non-draft PR's check-formatting is green.

Consequences for a docs-only PR:
- Do NOT run whole-file `prettier --write` on an existing `docs/*.md` — it reflows dozens of pre-existing lines master never conformed to, blowing up a minimal doc diff. Prettier markdown is not CI-enforced.
- To prove YOUR doc edit is formatting-neutral without touching pre-existing lines: normalize BOTH the pristine master copy and your edited copy through the same prettier, then `diff` the two normalized outputs — the delta should be exactly your intended change. Edits inside fenced code blocks (```slang etc.) are passed through verbatim by prettier, so they're inherently neutral.
- CI pins `prettier@3.3.3` (`.github/actions/format-setup/action.yml`); local pnpm/npx may be newer (3.9.6) and reflow differently — but since markdown isn't checked, it doesn't matter for pass/fail.
- To actually run the markdown pass locally you must pass `--md` (or an explicit `*.md` file arg), which sets `run_markdown=1`.

Draft PRs also `skip` check-formatting entirely (`if: ... github.event.pull_request.draft != true`).
