---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786404060220-gczhue
written_at: 2026-08-10T23:45:05.888Z
---

# Devin false-all-clear regressed: verify the fix is IN the script, not in your notes

A fix I recorded as applied on 2026-08-05 was **gone from the live script** on 2026-08-10, and the failure it prevented shipped again. Worth internalizing as a general rule, not a Devin trivium.

**The failure.** `slang-pr-review-runner/scripts/devin-fetch.sh` returned `(none reported)` for Bugs/Flags/Informational at **exit 0** on shader-slang/slang#12465 — reading exactly like a clean Devin pass. It wasn't. The done-check alternation accepted `/Checks\s*\d+\s*\/\s*\d+/`, which matches **GitHub's right-rail CI counter** ("Checks 49/49"), present on every PR page regardless of findings. Discriminator: `gh pr checks 12465 | wc -l` = **49**, exactly. So the predicate reduced to `heading && true`, the findings sat behind an unclicked `View results` control, and the harvest scraped empty.

After repair the SAME PR yielded **1 Bug + 2 Flags + 2 Informational**, one of which no other reviewer raised. The empty result was 100% instrument failure.

**Rules.**
1. **A memory saying "fixed" is a claim about the past, not live state.** Before trusting a scripted guard, grep the script for the pattern. Mine had reverted (mtime 5 days *after* the recorded fix) — a skill re-install plausibly reverted it, and the notes gave no signal.
2. **Every done-check pattern must be specific to the artifact carrying the property.** Never accept one that also matches ambient page furniture (CI rails, nav chrome). If a predicate can be satisfied without the thing you're measuring existing, it measures nothing.
3. **"Panel never rendered" and "genuinely no findings" must not be byte-identical.** Require a *positive* zero — `No bugs` / `N Bugs` actually present — never the extractor's `(none reported)` default. I added that as a third guard; the two existing ones (`Generating…`, byte-floor) both pass happily on an unexpanded panel, so neither could ever catch this.
4. **Treat a broken instrument as `_skipped: <reason>_`, never as a clean reviewer**, and never count it toward `reviewers_complete`. Nothing-reported by a broken tool is not nothing-to-report.
5. **Prove the fix in both directions on the saved artifact.** Replay: OLD `done=True` (rail only) → NEW harvest guard `False` → exit 3. Plus controls that must PASS: synthetic `3 Bugs`, and synthetic `No bugs` (a genuine clean must not be rejected). A one-directional check would have let me ship a guard that rejects everything.

**Editing hazard.** `DONE_EXPR` is a single-quoted shell string. An apostrophe in a JS comment (`Devin's`) closes it and backticks then execute — symptom `line 107: findings: command not found`. Keep those eval blocks apostrophe/backtick-free and `bash -n` after every edit.

Related: a `0`/empty is the dangerous value precisely because it's also what success looks like.
