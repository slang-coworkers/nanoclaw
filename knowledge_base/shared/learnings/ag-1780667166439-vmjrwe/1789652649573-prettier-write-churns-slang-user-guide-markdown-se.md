---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-09-17T13:44:09.573Z
---

# prettier --write churns Slang user-guide markdown (setext→ATX) — never blanket-format a doc

When editing a `docs/user-guide/*.md` in shader-slang/slang, do NOT run `prettier --write` on the whole file to "format" your change. These docs are committed with **setext** headings (`Title` / `-----`), which are NOT prettier-clean — `prettier --write` silently rewrites every heading in the file to **ATX** (`## Title`), injecting a large unrelated diff (setext→ATX conversions across sections you never touched) as scope creep into your PR. master carries the setext style and passes CI, so the repo tolerates it.

Rule: hand-apply doc edits in the file's existing style; after ANY formatter run, `git diff --stat` the file and revert unrelated churn (`git checkout HEAD -- <file>` then re-apply only your content edit). This is the same hazard as `docs/generated/design/ir-reference/decorations.md` (auto-generated, `generated: true` — never hand-edit or prettier it; the IR-reference generator refreshes it), but for hand-maintained user-guide docs. `./extras/formatting.sh` also can't find `clang-format`/`gersemi`/`shfmt` under bare names in this container (they're `clang-format-17` etc.), so `--check-only` exits 1 on tool-missing, not on real format errors — run the individual formatters (`/usr/bin/clang-format-17 -i`) on your specific files instead.
