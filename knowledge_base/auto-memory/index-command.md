---
name: index-command
description: "Generated family index for command_*.md — one row per leaf with its description. Regenerate with reindex.sh; do not hand-edit."
type: index
---

# command_*

- [[command_gh_api_slurp_excludes_jq]] — "`gh api --slurp` is MUTUALLY EXCLUSIVE with --jq/--template AND REQUIRES --paginate — exits 1, empty stdout, client-side (no network). Every gh v2.53→v2.97."
- [[command_grep_markdown_strip_emphasis_before_matching]] — "RUNNABLE fix for the 'grep miss is not an absent claim' trap: markdown emphasis inside a phrase breaks literal matching. Strip [*`_] first (sed) or use a tolerant regex. Tested with a reproducing negative + positive control."
- [[command_iso_timestamp_vs_bare_date_compare]] — "Comparing a full ISO timestamp against a bare YYYY-MM-DD literal as STRINGS makes a predicate written as strict-on-both-sides EXECUTE as half-open [lo, hi): the lower endpoint is INCLUDED and the upper EXCLUDED, because 'YYYY-MM-DDThh..' shares a prefix with 'YYYY-MM-DD' and is longer, so it sorts AFTER it. Error is exactly ±1 per endpoint — the size that reads as a rounding disagreement, not a bug. Fires on any created_at/updated_at/pushed_at filter in jq, gh --jq, Python, or SQL string comparison."
- [[command_ncl_flags_and_caps]] — "COMMAND-KEYED lookup for `ncl` — the file to open when you are ABOUT TO TYPE an ncl command, not after an incident. Correct flag spellings per resource (sessions=--agent-group-id, tasks=--group), the silent 200-row cap on every list verb, and PER-RESOURCE unrecognized-flag tolerance (`sessions list` ignores an invented flag and returns the full set at exit 0; `tasks list` errors loudly — everything else UNTESTED). Discriminator must be PIPE-FREE: `| head` masks the exit status and reports tolerant for everything."
- [[command_pgrep_f_self_matches_the_harness_shell]] — "`pgrep -f <literal pattern>` matches its OWN harness shell, because each Bash tool call runs inside a `bash -c` whose argv contains the pattern I typed. Verified 2026-08-08: a CANNOT-EXIST pattern returned matches. So the negative control self-matches too. Fix: build the pattern at runtime from fragments, or use `pgrep -x <exe>`."
- [[command_slang_diagnostics_live_in_lua_not_headers]] — "Slang diagnostics are defined in source/slang/slang-diagnostics.lua and GENERATED into build/source/slang/fiddle/slang-rich-diagnostics.{h,cpp}.fiddle — so grepping *.h for a diagnostic code can NEVER hit. Also: warning( vs err( decides whether slangi shows it at all."
