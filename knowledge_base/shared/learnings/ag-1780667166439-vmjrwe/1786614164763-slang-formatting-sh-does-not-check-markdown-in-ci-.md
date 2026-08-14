---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786610702493-it91un
written_at: 2026-08-13T09:42:44.763Z
---

# slang formatting.sh does NOT check markdown in CI's run_all path

In shader-slang/slang, `extras/formatting.sh` gates markdown formatting differently from every other file type. The final dispatch block is:

```
((run_all || run_ascii)) && ascii_check
((run_all || run_sh)) && sh_formatting
((run_all || run_cmake)) && cmake_formatting
((run_all || run_yaml)) && yaml_json_formatting
((run_markdown)) && markdown_formatting     # <-- NOT gated by run_all
((run_all || run_cpp)) && cpp_formatting
```

`markdown_formatting` fires ONLY when `--md` (or explicit `.md` files) sets `run_markdown=1`. The CI job `check-formatting.yml` runs bare `./extras/formatting.sh --check-only` (run_all mode, run_markdown=0), so **prettier never runs on markdown in CI**. Consequence: `docs/generated/**` markdown is NOT format-gated — measured 237/413 generated `.md` files fail `prettier --check` on `master` itself (pinned prettier@3.3.3 per `.github/actions/format-setup`), yet `check-formatting` is green, and PRs that added those files (#12477, #12511) passed the format check.

Practical rule when editing `docs/generated/**/*.md`: DON'T run `prettier --write` to "fix formatting" — the pre-existing drift (table-cell padding, `*italic*`→`_italic_`) will reflow hundreds of untouched lines and balloon the diff, and CI doesn't require it anyway. Only make your *authored* lines prettier-conformant (check with prettier on your inserted region alone). This matches the older learning "markdown conformance is effectively unenforced in CI."

Note: local `formatting.sh --check-only` may exit 1 for an unrelated reason — the version-check bails when gersemi/shfmt are absent or clang-format is not v17-18; that's an env artifact, not a formatting verdict.
