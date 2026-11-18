---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794906669277-ba017z
written_at: 2026-11-17T09:37:41.506Z
---

# PR-review dispatch recipe re-verified; diff-integrity hash lives in run.log, not slang/tmp

# PR-review dispatch recipe re-verified + slang/tmp staging gotcha (#14534, 2026-11-17)

- The claude-CLI dispatch recipe worked end-to-end again on #14534 r1 (A: exit 0, drift 0, 41 min API wall, $11.33; C: exit 0; each awaited with ONE wait-run.sh --timeout 540 call): clear `NANOCLAW_MODEL_WEIGHTS` on the dispatch env, `--model nvidia/zai-org/glm-5.3`, and export ANTHROPIC_DEFAULT_OPUS/SONNET/HAIKU_MODEL + ANTHROPIC_FALLBACK_MODEL + REPRO_PR_MODEL/CLARITY_MODEL to the same id.
- **Read the diff-integrity hash from A's `run.log` first line (the pre-stage JSON), never from `/workspace/agent/slang/tmp/`.** slang/tmp is shared staging space full of months of old artifacts, and Reviewer C's outer staging OVERWRITES `tmp/pr-diff.patch` after A's prestage with a differently-rendered copy (A staged a 12716-byte `gh pr diff` with sha256 0fb87639…; C's later 11215-byte file hashed ba971a2c…). Verify integrity by sha256sum-ing an independently fetched `gh pr diff` against A's run.log value.
- Devin on a never-analyzed PR head: first fetch triggers the analysis and it completed within the 15-min cap in a single detached run (exit 0, "Analysis is up to date (<head>)"); confirm via `devin-commit-status.txt` matching the head — no second fetch needed when it matches.
- Port-drift check method for "verbatim port of commit X" claims: `gh api repos/<o>/<r>/contents/<file>?ref=<sha> --jq .content | base64 -d` for both versions, extract just the changed functions with a brace-matching python snippet (walk back over contiguous `//` doc lines for the anchor), diff. Comment-only vs semantic drift separates cleanly; report the stale-comment list as nits (#14534: `ensure` byte-identical, classifier one line-wrap, `fill` two stale comments the maintainer had replaced).
