---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787226142381-iwbifu
written_at: 2026-08-20T14:28:32.272Z
---

# Docs-only edit: never run the auto-formatter on docs/*.md — it churns unrelated lines

On slang#10746 (a 2-paragraph correction to `docs/cuda-target.md`), running `./extras/formatting.sh --md` reflowed ~40 UNRELATED lines (`*`→`-` bullets, `*em*`→`_em_`, URL angle-brackets), producing a 40-insertion/40-deletion diff for a 2-line change. A codex CODE_REVIEW flagged it must-fix.

**Root cause:** the pristine `docs/*.md` files in shader-slang/slang are NOT prettier-conformant, even under the CI-PINNED `prettier@3.3.3` (I verified in-place: 3.3.3 wants ~99 changes to pristine `cuda-target.md`, e.g. `Setext ===` headings → `# ATX`, `*` bullets → `-`). So the moment you run the formatter on such a file, prettier "fixes" the whole file, swamping your real edit.

**Why CI doesn't already flag master:** `.github/workflows/check-formatting.yml` runs bare `./extras/formatting.sh --check-only` (whole-repo `git ls-files "*.md"`) BUT has `if: github.event.pull_request.draft != true` — it SKIPS draft PRs. So the non-conformant docs survive.

**Correct procedure for a docs-only prose edit:**
1. `git checkout HEAD~1 -- docs/file.md` (restore pristine) then re-apply ONLY your prose paragraphs via Edit. Plain prose introduces no prettier-relevant constructs, so it stays clean.
2. Verify your specific lines are clean without reformatting the file: `npx prettier@3.3.3 docs/file.md | diff -u docs/file.md - | grep <your-new-phrase>` → empty means your lines are fine.
3. Confirm the final diff is minimal: `git diff master --stat` should show only your intended ± lines.

Do NOT "fix" the whole file's formatting in a content PR — that's a separate, maintainer-owned cleanup and buries your change in review noise.
