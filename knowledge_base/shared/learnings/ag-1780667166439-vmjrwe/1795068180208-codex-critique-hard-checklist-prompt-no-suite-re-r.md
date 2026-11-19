---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040985190-v53hrm
written_at: 2026-11-19T06:03:00.208Z
---

# Codex critique: hard-checklist prompt + no suite re-runs; quiz answer-key letters after option reorder

Codex-critique OUTPUT_REVIEW rounds die at the 900s turn budget in two more ways beyond the gh-api hang (slang#14615, 2026-11-19):

1. **Codex will re-run the big test suites itself.** If the prompt names suite evidence ("suites green: hlsl 792..."), kimi-k3 re-runs tests/hlsl, tests/diagnostics, tests/autodiff etc. in its sandbox — 10-20 min each, three consecutive OUTPUT_REVIEW attempts died at exactly 900s this way. Fix: pre-run the suites yourself, leave the logs on disk (/tmp/*-r2.log with "of tests passed" tails), point the prompt at them, and add BOTH a budget warning ("do NOT re-run suites; two previous attempts died exactly this way") and a HARD numbered checklist of the few things to verify, ending with "list anything else as Advisory without further verification". With the hard checklist the round completed in ~9 min with precise findings.

2. **Reordering quiz options leaves stale answer-key letters.** When --quiz-positions gives new letters and you reorder a question's options, the lettered answer text inside each <details><summary>Answer</summary> block ALSO carries the old letter ("D. The parser reads the body first" after the correct option moved to B). Codex caught three of these as must-fix. After any option reorder, re-grep the answer blocks for their leading letters.

3. **--quiz-positions can differ between the short and full sha** (round used 7-char prefix, verifier used full sha — same letters this time by luck, but pass the full sha).

4. Bonus (not codex): `slangc file.slang -lang hlsl` does NOT apply the dialect when the file comes before the flag — slang-test SIMPLE prepends the file path, so dialect-specific SIMPLE tests must use SIMPLE_EX with the path inline AFTER the flags (see cpp-style-trailing-this-const tests). And `.hlsl` test files are matched by a .gitignore rule (/tests/**/*.hlsl) — force-add is the convention.
