---
title: "Slang markdown & generated docs: prettier is unenforced, generators own byte-exactness"
type: concept
group: slang-tooling
tags: [markdown, prettier, generated-docs, ci, slangc-help, byte-exact, docs]
source_count: 8
---

## TL;DR

Two facts govern every Slang docs/markdown edit, and getting either backwards turns a green
PR red or balloons a minimal diff into a rejected reformat.

- **Prettier is NOT enforced on markdown in CI.** `extras/formatting.sh`'s final dispatch
  gates every other type on `run_all || run_<type>` but markdown on `((run_markdown))`
  alone. CI runs bare `--check-only` (`run_all=1`, `run_markdown=0`), so prettier never runs
  on markdown. `master` itself carries ~100–250 lines of prettier-nonconformant markdown and
  `check-formatting` is green.
- **Therefore: never run `prettier --write` / `formatting.sh --md` on an existing `docs/*.md`.**
  It reflows hundreds of pre-existing lines (Setext→ATX headings, `*`→`-` bullets, table
  padding, blank-line-after-heading) that master never conformed to — a huge unrelated diff
  reviewers reject. Prove your edit is *formatting-neutral* by diffing
  `prettier(HEAD:file)` vs `prettier(working file)`; only your added lines should differ.
- **Version drift makes the raw diff-line count unreliable.** CI pins `prettier@3.3.3`; local
  installs (3.9.6, or even 3.3.3 via a different install path) reformat differently. The
  line-local delta comparison is the robust signal, not the count.
- **Generated docs have a generator, not a formatter, as their source of truth.**
  `docs/command-line-slangc-reference.md` is produced by `slangc -help-style markdown -h` and
  CI (`check-cmdline-ref`) does a **byte-exact diff** against the committed file. The
  generator emits every line with a trailing space. Running prettier over it strips those and
  rewrites tables → `check-cmdline-ref` red. Regenerate from your own build after any merge or
  help-string edit; never hand-edit it.
- **Don't overclaim "byte-identical" for generated docs.** The generator adds trailing
  whitespace/escaping the source C++ literal lacks. Say "matches in content, modulo generator
  formatting"; CI enforces *generator-output consistency*, not source==doc byte equality.
- **The help-DB auto-links option-name tokens.** Naming a flag inside its own help text
  produces a link to a nonexistent per-alias anchor. Name a *different* real option, or none.

## Markdown is the one unenforced formatter

`extras/formatting.sh`'s final dispatch block is asymmetric — markdown is the sole formatter
gated on its own flag rather than on `run_all`:

```
((run_all || run_ascii)) && ascii_check
((run_all || run_sh))    && sh_formatting
((run_all || run_cmake)) && cmake_formatting
((run_all || run_yaml))  && yaml_json_formatting
((run_markdown))         && markdown_formatting     # <-- NOT run_all || run_markdown
((run_all || run_cpp))   && cpp_formatting
```

`run_markdown` is set only by `--md` or an explicit `*.md` path arg. CI's
`check-formatting.yml` runs bare `./extras/formatting.sh --check-only` (whole-tree,
`run_all=1`, `run_markdown=0`), so **prettier never runs on markdown in CI**. This is
independently measured multiple times: ~100 lines of blank-line/bullet nonconformance on
master with every non-draft PR green
[dispatch-line analysis](../learnings/1786987129465-formatting-sh-check-only-skips-markdown-run-markdo.md);
237/413 `docs/generated/**` `.md` files failing `prettier --check` on master under the
pinned `prettier@3.3.3` while `check-formatting` stays green
[docs/generated not format-gated](../learnings/1786614164763-slang-formatting-sh-does-not-check-markdown-in-ci-.md).
(Draft PRs also skip `check-formatting` entirely via `if: ... draft != true`.) The single
missing `run_all ||` guard is itself a real one-line fix — see the approver page for how that
fix reddens the very check it activates.

The practical consequence is the same across every docs-editing atom: **scope your format
check to your delta, do not reflow the file.** Running whole-file prettier on
`docs/shader-execution-reordering.md`, `docs/cuda-target.md`, `README.md`, `REVIEW.md`,
`docs/user-guide/03-convenience-features.md`, etc. balloons a 3–7 line content change into a
100–300 line reformat
[scope to your delta](../learnings/1787178316113-slang-docs-markdown-is-pre-existing-prettier-nonco.md),
[verified on master ba1f1aecb5](../learnings/1787601974871-slang-docs-markdown-is-not-prettier-conformant-und.md),
[~83 whole-file changes on user-guide, #12938](../learnings/1788849134395-slang-docs-user-guide-markdown-is-pre-existingly-n.md).
There is no `.prettierrc`/`.prettierignore`/markdown `.editorconfig` in the repo, so the
whole-file reflow is unavoidable if you invoke prettier globally. The robust check is a
line-local delta comparison:

```bash
git show HEAD:docs/foo.md > /tmp/m.md
diff <(npx prettier@3.3.3 /tmp/m.md) <(npx prettier@3.3.3 docs/foo.md)   # only your added lines
```

If the only diff is your added lines, your edit is formatting-neutral: CI treats master's
churn identically before and after your change, so a green-on-master check stays green. Keep
your *authored* lines prettier-clean on their own (blank line before/after a paragraph,
hard-wrap to match neighbors) so you add zero new deltas, and note the reasoning in the PR
body so the reviewer isn't surprised there's no formatting commit. Edits inside fenced code
blocks (```slang etc.) are passed through verbatim by prettier and are inherently neutral
[fenced blocks pass through](../learnings/1786987129465-formatting-sh-check-only-skips-markdown-run-markdo.md).
The **version-drift caveat** is why the count is untrustworthy: local prettier 3.9.6 and CI's
`prettier@3.3.3` (pinned in `.github/actions/format-setup/action.yml`) disagree on how much
of an old doc to rewrite, so the raw diff-line count is not a pass/fail signal — the
line-local comparison is
[version drift](../learnings/1787178316113-slang-docs-markdown-is-pre-existing-prettier-nonco.md).
Note also that `formatting.sh --md -- FILE` won't help locally: it gates on *every* tool
being present (clang-format/gersemi/shfmt too) and exits early listing missing tools even for
a markdown-only invocation
[gates on all tools](../learnings/1788849134395-slang-docs-user-guide-markdown-is-pre-existingly-n.md).

## Generated docs: the generator owns byte-exactness, not the formatter

`docs/command-line-slangc-reference.md` is generated from the slangc option DB
(`slangc -help-style markdown -h`), and CI enforces two *conflicting* contracts — but only
one actually runs. `check-cmdline-ref` (ci.yml) does a **byte-exact `diff`** of the generator
output against the committed file, and the generator emits **every line with a trailing
space**; separately `check-formatting.yml` runs `formatting.sh --check-only` with no type
flag, which (per above) never reaches markdown. So the committed generated doc is
prettier-*dirty* and survives only because markdown is unreachable in the whole-tree run
[the two conflicting contracts](../learnings/1786409326017-a-generated-doc-checked-byte-exact-by-ci-must-not-.md).
The trap is the "helpful" instinct to format the docs you touched: running `formatting.sh
--md` (or passing the generated `.md` explicitly) strips the trailing spaces and rewrites the
tables, making the file diverge from generator output → `check-cmdline-ref` red. The
generalization is that a file with a *generator* as its source of truth has an owner that is
not the formatter — before running any formatter over a tree, ask which files are
generator-owned.

For merges, a clean textual `git merge` is **not** proof of correctness: the contract is
"byte-identical to what the newly-built `slangc` emits", not "plausible text". Regenerate
from your own build after merging (`slangc -help-style markdown -h > ... 2>&1`, the `2>&1`
matching CI) and require an empty `git diff`
[regenerate after merge](../learnings/1786409326017-a-generated-doc-checked-byte-exact-by-ci-must-not-.md).
The same rebuild-and-regenerate discipline applies after any help-string edit in
`source/slang/slang-options.cpp`: you MUST rebuild slangc and re-run the generator, or CI's
byte-compare fails
[rebuild + regenerate mandatory](../learnings/1787705364348-slangc-help-db-autolinks-option-name-tokens-never-.md).

Two subtler pitfalls attach to this generated doc. First, **"byte-identical" is a falsifiable
overclaim.** On slang#12673 the claim that the generated Markdown was "byte-identical to the
source help-string" was literally false — the generator appends a trailing space the C++
string literal lacks — and it took three extra OUTPUT_REVIEW rounds to purge the phrase from
every artifact (including one copy inside an embedded JSON `notes` field, and a re-armed
freshness gate from a post-approve cosmetic fix)
[byte-identical is falsifiable](../learnings/1787337743213-approver-critique-mustfix-byte-identical-is-a-fals.md).
The CI-aligned phrasing is: "the generated doc text matches the source help-string in content
(modulo generator formatting); `check-cmdline-ref` enforces generator-output consistency."
Prefer claims that match what CI actually checks over stronger claims that merely sound
rigorous, and write the qualified wording in the first synthesis pass. Second, **the
generator auto-links option-name tokens** — including to anchors that don't exist. Naming the
*current* option's own flag inside its help text produced
`[-fvk-use-scalar-layout](#force-glsl-scalar-layout-1)`, a link to a nonexistent `-1` alias
anchor; naming a *different* real option autolinks correctly. Verify after regen with
`grep -c "<broken-anchor>-1" ... == 0`
[help-DB autolinks](../learnings/1787705364348-slangc-help-db-autolinks-option-name-tokens-never-.md).
That atom also warns that `strings <binary> | grep "<phrase>"` can return 0 even when a
help-string change *is* in the binary (the C++ compiler re-chunks adjacent string literals);
confirm with `slangc -h | grep "<phrase>"`, which is authoritative.

**Source learnings (8):**
- [A generated doc checked byte-exact by CI must NOT be run through prettier — and CI's formatting.sh never reaches markdown](../learnings/1786409326017-a-generated-doc-checked-byte-exact-by-ci-must-not-.md) — Two conflicting contracts on `command-line-slangc-reference.md`; the trailing-space generator output; regenerate from your own build after a merge (empty diff = proof).
- [slang formatting.sh does NOT check markdown in CI's run_all path](../learnings/1786614164763-slang-formatting-sh-does-not-check-markdown-in-ci-.md) — The `((run_markdown))` dispatch asymmetry; 237/413 `docs/generated/**` `.md` fail prettier@3.3.3 on master while CI is green; only make authored lines conformant.
- [formatting.sh --check-only SKIPS markdown (run_markdown not gated by run_all)](../learnings/1786987129465-formatting-sh-check-only-skips-markdown-run-markdo.md) — The full dispatch block; normalize-both-and-diff to prove a docs edit is neutral; fenced code blocks pass through verbatim; draft PRs skip check-formatting.
- [Slang docs markdown is pre-existing prettier-nonconformant; scope your format check to your delta](../learnings/1787178316113-slang-docs-markdown-is-pre-existing-prettier-nonco.md) — `prettier(HEAD:path)` vs `prettier(working)` shows only your lines; the version-drift caveat makes raw line counts unreliable; CI-installed tool versions.
- [byte-identical is a falsifiable overclaim for generated docs](../learnings/1787337743213-approver-critique-mustfix-byte-identical-is-a-fals.md) — content-match (true, decision-relevant) vs byte-identical (falsified by generator whitespace/escaping); say "modulo generator formatting"; land cosmetic fixes before the shipping OUTPUT_REVIEW.
- [Slang docs/ markdown is not prettier-conformant under 3.3.3 or 3.9.6 — do not run formatting.sh on doc edits](../learnings/1787601974871-slang-docs-markdown-is-not-prettier-conformant-und.md) — Verified on master ba1f1aecb5; a 3-line change balloons to 100–250; `diff <(prettier EDITED) <(prettier PRISTINE)` is the robust check; C++ (clang-format) IS enforced, markdown is not.
- [slangc help-DB autolinks option-name tokens — never name a flag inside its own help text](../learnings/1787705364348-slangc-help-db-autolinks-option-name-tokens-never-.md) — Rebuild+regenerate mandatory after a help-string edit; naming the current flag links to a nonexistent `-1` anchor; `strings | grep` can false-negative, use `slangc -h | grep`.
- [Slang docs/user-guide markdown is pre-existingly non-prettier-clean — never reflow it for a small edit](../learnings/1788849134395-slang-docs-user-guide-markdown-is-pre-existingly-n.md) — ~83 whole-file changes on `03-convenience-features.md`; verify count identical before/after; `formatting.sh --md -- FILE` still gates on all tools present.
