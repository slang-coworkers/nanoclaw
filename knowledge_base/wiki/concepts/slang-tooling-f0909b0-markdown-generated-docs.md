---
title: "Slang markdown & generated docs: prettier is unenforced, generators own byte-exactness"
type: concept
group: slang-tooling
tags: [markdown, prettier, generated-docs, ci, slangc-help, byte-exact, docs]
source_count: 20
---

## TL;DR

Two facts govern every Slang docs/markdown edit, and getting either backwards turns a green
PR red or balloons a minimal diff into a rejected reformat.

- **Prettier is NOT enforced on `docs/**` markdown in CI; it IS enforced on the six
  top-level `*.md` files.** Until #12600 (2026-09-01) the markdown dispatch lacked
  `run_all ||`, so CI's bare `--check-only` never ran prettier. Since then it does, but the
  unquoted `git ls-files $@` expands `*.md` to the repo-root files only (`AGENTS`, `CLAUDE`,
  `CODE_OF_CONDUCT`, `CONTRIBUTING`, `README`, `REVIEW`), which pass prettier@3.3.3. An edit
  to one of those must stay prettier-clean; `docs/**` still carries hundreds of
  nonconformant files with `check-formatting` green.
- **Therefore: never run `prettier --write` / `formatting.sh --md` on an existing `docs/*.md`.**
  It reflows hundreds of pre-existing lines (Setext→ATX headings, `*`→`-` bullets, table
  padding, blank-line-after-heading) that master never conformed to — a huge unrelated diff
  reviewers reject. Prove your edit is *formatting-neutral* by diffing
  `prettier(HEAD:file)` vs `prettier(working file)`; only your added lines should differ.
- **Version drift makes the raw diff-line count unreliable.** CI pins `prettier@3.3.3`; local
  3.9.x installs reformat differently. Install 3.3.3 into `/tmp`, put it first on `PATH`, and
  trust the line-local delta, not the count. Where a generated README fails 3.3.3 even on
  master, make a minimal padded edit rather than reformatting the file.
- **A `docs/generated/tests` bundle's `_prompt.md` can contradict its own tests** ("do not
  test X", "compute-only") or restate the old claim. Fix the prompt when you touch the bundle,
  or regeneration (`mark-fresh`) reverts the retarget; lint catches neither.
- **PR CI never runs `docs/generated/tests` (nightly only).** A behaviour-changing PR runs it on
  head and base and diffs FAILED; fix by regeneration or a linked `expected-failures.txt` entry.
  A bare directory prefix (no `-test-dir`) runs ZERO of these tests; pass the files.
- **A nightly "No diagnostics found on line N" can be an intentional diagnostic removal.** Read
  the causing PR's own `tests/` diff before calling it a lost warning; the fixture may be stale.
- **README coverage rows often do NOT equal `//META: purpose` verbatim** (15/72 in one bundle);
  a single mismatch is a nit. Script a bundle-wide check before asserting any convention.
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
fix reddens the very check it activates. That fix has since landed (#12600, 2026-09-01:
`((run_all || run_markdown)) && markdown_formatting` at `extras/formatting.sh:444`), so the
paragraph above is history for the top-level files: a logging-stub `prettier` on master
`653bfdeef4` (2026-10-22) received exactly the six repo-root `.md` files from a default
`--check-only`, and all six pass prettier@3.3.3, `CONTRIBUTING.md` included
[correction: CONTRIBUTING.md now passes prettier (#13822)](../learnings/1792607515728-correction-contributing-md-now-passes-prettier-on-.md).
`docs/**` stays unchecked only because the unquoted `git ls-files $@` lets the shell expand
`*.md` against the repo root (427 of 594 tracked `.md` files still fail 3.3.3), so the
delta-scoped advice below still holds for `docs/`.

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
The container's default `prettier` is now 3.9.9, so to check with CI's version install the pin
locally — `cd /tmp && npm install prettier@3.3.3`, put `/tmp/node_modules/.bin` first on `PATH`,
then `extras/formatting.sh --check-only --md -- <files>`. Even under 3.3.3 some generated READMEs
(e.g. `docs/generated/design/target-pipelines/hlsl/README.md`) already fail on master; for those
make a minimal padded edit that matches the surrounding lines instead of a 200-line reformat
[prettier 3.3.3 pin for a stale docs/generated/tests retarget](../learnings/1790673868800-stale-docs-generated-tests-retarget-prettier-3-3-3.md).
Note also that `formatting.sh --md -- FILE` won't help locally: it gates on *every* tool
being present (clang-format/gersemi/shfmt too) and exits early listing missing tools even for
a markdown-only invocation
[gates on all tools](../learnings/1788849134395-slang-docs-user-guide-markdown-is-pre-existingly-n.md).
The specific `docs/user-guide/*.md` churn to watch is **setext→ATX heading conversion**: these
docs are committed with setext headings (`Title` / `-----`) which are NOT prettier-clean, so
`prettier --write` silently rewrites every heading in the file to ATX (`## Title`), injecting a
large unrelated diff across sections you never touched — hand-apply doc edits in the file's
existing style, and after ANY formatter run `git diff --stat` the file and revert unrelated
churn (`git checkout HEAD -- <file>` then re-apply only your content edit). In this container the
formatters aren't on PATH under bare names (`clang-format`/`gersemi`/`shfmt` are `clang-format-17`
etc.), so `./extras/formatting.sh --check-only` exits 1 on *tool-missing*, not on a real format
error — run the individual formatters on your specific files (`/usr/bin/clang-format-17 -i …`)
instead. (Same hazard, different owner, as generator-owned files like
`docs/generated/design/ir-reference/decorations.md` — never hand-edit or prettier those either)
([prettier --write churns Slang user-guide markdown setext→ATX — never blanket-format a doc](../learnings/1789652649573-prettier-write-churns-slang-user-guide-markdown-se.md)).

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

**PR CI never runs `docs/generated/tests`, so a behaviour-changing compiler PR has to run it
itself.** Only `nightly-slang-test.yml` runs these doc-anchored bundles, so a PR can merge green
and turn the nightly red. Two October 2026 cases: a new front-end error E31215 for
`uniform float4 x[]` broke `design/ir-reference/types/array-unsized.slang`, which declares exactly
that shape, and PR #13546's widening of `#if` to int64 broke
`design/pipeline/01-lex-preprocess/if-expression-signed-overflow-wraps.slang`, which pins the old
32-bit wraparound. The check takes about 2 minutes with 16 servers:
`slang-test -test-dir docs/generated/tests -expected-failure-list docs/generated/tests/_meta/expected-failures.txt -use-test-server -server-count 16`,
run on the PR head and on the base, then diff the FAILED lines; append one bundle path to check
just that bundle, where an expected-failure entry reports `failed(expected)`. The `.slang` files
fall under `_meta/regenerate.md`'s hand-edit policy, so the compliant fixes are regenerating the
bundle or adding the path to `_meta/expected-failures.txt` under a `#` comment carrying an issue
link (lint enforces the link); stale tests have also been retargeted directly after intentional
changes (#13454, #13317, #13282, #12464), following the retarget rules below. Whole-tree
`regenerate.py lint` has hundreds of pre-existing errors on master, so compare error counts with
and without your edit (or lint only the bundle) instead of expecting zero. In a fresh worktree
build, INTERPRET/FileCheck tests are silently `ignored` ("FileCheck is not available") unless
`libslang-llvm.so` is in `build/Release/lib`; copy it from an older tree before trusting the run
[new front-end errors break the nightly agentic suite](../learnings/1791528614678-new-front-end-errors-can-break-the-nightly-agentic.md)
[behaviour-changing PRs must run docs/generated/tests](../learnings/1791580515115-compiler-prs-that-change-behavior-must-also-run-do.md)
[semantic changes break nightly tests PR CI never runs](../learnings/1791583400841-slang-semantic-changes-can-break-docs-generated-ni.md).

**Two traps when running or triaging the suite.** First, a bare directory prefix runs
nothing. `slang-test docs/generated/tests/design/name-resolution/` ran ZERO tests from that
tree, and the total silently held only the other prefixes passed. Individual files do run:
`find docs/generated/tests/design/<area> -name '*.slang' -print0 | xargs -0 ./build/Debug/bin/slang-test`
(name-resolution: 245 files → 251 tests). Before citing a bundle as covered, break the count
down per prefix with `grep "^passed test" log | cut -d/ -f1-2 | sort | uniq -c`; a codex
OUTPUT_REVIEW caught a PR explanation that claimed the bundle from a directory run
[directory prefix runs zero docs/generated tests](../learnings/1792762511063-slang-test-does-not-run-docs-generated-tests-when-.md).
Second, a nightly "No diagnostics found on line N" is not automatically a lost warning. On
2026-10-23 `alias-out-in-warning-diagnostic.slang` began failing after #13406 (the Ref
passing-mode split). #13406 changed `tests/diagnostics/aliased-out-inout-parameter.slang` on
purpose: in+inout aliasing is no longer warned, because the `in` parameter is a copy taken
before the call, and ref+ref is no longer warned either. The generated fixture was stale, not
the compiler. Read the causing PR's own test diff first
(`gh api repos/shader-slang/slang/pulls/<N>/files --jq '.[]|select(.filename|test("tests/"))|.patch'`,
then grep for the diagnostic text)
[nightly "No diagnostics found" can be intentional](../learnings/1792744585332-nightly-doc-test-no-diagnostics-found-can-be-an-in.md).
PR #13887 rebuilt that fixture with the no-diagnostic pin described on
[the diagnostics page](misc-f0909b9-slang-diagnostics-warnings-and-test-authoring.md). The
bundle's source section can be stale too, and it no longer lives in this repo: the language
reference moved to shader-slang/spec (`specification/*.md`), so `doc_ref` paths that point at
the removed `docs/language-reference/` are dead. Read a spec claim with
`gh api repos/shader-slang/spec/contents/specification/<file> -H 'Accept: application/vnd.github.raw'`
[language reference moved to shader-slang/spec](../learnings/1792745836053-diagnostic-test-check-not-is-inert-but-passes-lint.md).

The agentic test bundles under `docs/generated/tests/` have the same owner problem one level
up: each bundle is regenerated from its `_prompt.md` checklist, and lines like "Do not test X"
or "compute-only / no DXR" can contradict tests the bundle already has. When a compiler change
makes a bundle's tests stale (nightly 36520729454 → slang#13311 / PR #13312, after #13071's
WGSL `loop` and #13256's empty ray-payload legalization), retarget the tests *and* fix the
prompt, or the next regeneration fights them. The retargeting rule itself (check the
invariant, not the new spelling) is on
[the test-authoring page](slang-tooling-f0909b0-test-authoring-filecheck.md#vacuous-and-confounded-checks)
[stale docs/generated/tests retarget](../learnings/1790673868800-stale-docs-generated-tests-retarget-prettier-3-3-3.md).

Even a prompt with no "do not test" line can restate the old claim, and `regenerate.py lint`
catches neither of the two retarget omissions below. For #13282, `metadata/_prompt.md:165-167`
still said "DebugNoScope is emitted with zero operands", so the approved regeneration path
(re-prompt + `mark-fresh`) would have regenerated the stale test and silently reverted the fix;
the precedents #13150 and #13172 both edited `_prompt.md` alongside the test, so grep the bundle's
`_prompt.md` for the old claim's key terms. The second item is the README coverage row:
`_common.md` asks each row's Claim cell to equal the test's `//META: purpose=` line verbatim, as
`Cnn: <purpose>`, but that rule is neither lint-enforced nor followed bundle-wide. A full scan of
the 72 `ir-reference/metadata` tests (2026-09-30) found 15 rows that differ (4 only by markdown
`\_` escaping, 4 grouped rows with a merged claim, about 7 with an extra trailing clause), so a
single row mismatch is a nit, not a gap. Before asserting any bundle-wide convention, script the
check over the whole bundle (parse each `.slang`'s `//META: purpose=`, find the README row
containing ``[`<file>`]``, strip the `C.., C..: ` prefix) rather than generalizing from a spot
check
[retarget: update `_prompt.md`](../learnings/1790756499500-retargeting-a-docs-generated-agentic-test-also-upd.md)
[correction: README rows often differ from `//META: purpose`](../learnings/1790759833171-correction-docs-generated-tests-readme-rows-often-.md).

## Linking to Slang docs: ReadTheDocs page names follow the source file

When rewriting old Jekyll user-guide links (`shader-slang.com/slang/user-guide/<permalink>.html`)
to ReadTheDocs, use
`https://docs.shader-slang.org/en/latest/external/slang/docs/user-guide/<SOURCE-FILE>.html`.
RTD names each page after its `.md` source file, not the Jekyll permalink, so `targets` becomes
`09-targets`, `modules` becomes `04-modules-and-access-control`, and `compiling` becomes
`08-compiling`. Anchors carry over unchanged (on RTD they are `<section id=…>`, not heading ids).
The core-module reference now lives at `/en/latest/external/core-module-reference/`;
`/external/stdlib-reference/` returns 404 even though shader-slang.github.io#99 introduced it, so
take the website's current `_data/documentation.yaml` as the source of truth rather than a PR that
once added a path. The `a1-02-slangpy` (slangtorch) page moved to `docs/deprecated/`. A tooling
note from the same fix: `./extras/formatting.sh` with no arguments only prints help, so a
markdown check needs `--check-only --md -- README.md` (slang#13567 / PR #13568,
[RTD page names = source file names; stdlib-reference moved](../learnings/1791665643660-slang-docs-links-rtd-page-names-source-file-names-.md)).

**Source learnings (20):**
- [A generated doc checked byte-exact by CI must NOT be run through prettier — and CI's formatting.sh never reaches markdown](../learnings/1786409326017-a-generated-doc-checked-byte-exact-by-ci-must-not-.md) — Two conflicting contracts on `command-line-slangc-reference.md`; the trailing-space generator output; regenerate from your own build after a merge (empty diff = proof).
- [slang formatting.sh does NOT check markdown in CI's run_all path](../learnings/1786614164763-slang-formatting-sh-does-not-check-markdown-in-ci-.md) — The `((run_markdown))` dispatch asymmetry; 237/413 `docs/generated/**` `.md` fail prettier@3.3.3 on master while CI is green; only make authored lines conformant.
- [formatting.sh --check-only SKIPS markdown (run_markdown not gated by run_all)](../learnings/1786987129465-formatting-sh-check-only-skips-markdown-run-markdo.md) — The full dispatch block; normalize-both-and-diff to prove a docs edit is neutral; fenced code blocks pass through verbatim; draft PRs skip check-formatting.
- [Correction: CONTRIBUTING.md now passes prettier on slang master](../learnings/1792607515728-correction-contributing-md-now-passes-prettier-on-.md) — #12600 activated the markdown stage; top-level `.md` files are now prettier-checked in CI and pass; keep edits to them clean (#13822)
- [Slang docs markdown is pre-existing prettier-nonconformant; scope your format check to your delta](../learnings/1787178316113-slang-docs-markdown-is-pre-existing-prettier-nonco.md) — `prettier(HEAD:path)` vs `prettier(working)` shows only your lines; the version-drift caveat makes raw line counts unreliable; CI-installed tool versions.
- [byte-identical is a falsifiable overclaim for generated docs](../learnings/1787337743213-approver-critique-mustfix-byte-identical-is-a-fals.md) — content-match (true, decision-relevant) vs byte-identical (falsified by generator whitespace/escaping); say "modulo generator formatting"; land cosmetic fixes before the shipping OUTPUT_REVIEW.
- [Slang docs/ markdown is not prettier-conformant under 3.3.3 or 3.9.6 — do not run formatting.sh on doc edits](../learnings/1787601974871-slang-docs-markdown-is-not-prettier-conformant-und.md) — Verified on master ba1f1aecb5; a 3-line change balloons to 100–250; `diff <(prettier EDITED) <(prettier PRISTINE)` is the robust check; C++ (clang-format) IS enforced, markdown is not.
- [slangc help-DB autolinks option-name tokens — never name a flag inside its own help text](../learnings/1787705364348-slangc-help-db-autolinks-option-name-tokens-never-.md) — Rebuild+regenerate mandatory after a help-string edit; naming the current flag links to a nonexistent `-1` anchor; `strings | grep` can false-negative, use `slangc -h | grep`.
- [Slang docs/user-guide markdown is pre-existingly non-prettier-clean — never reflow it for a small edit](../learnings/1788849134395-slang-docs-user-guide-markdown-is-pre-existingly-n.md) — ~83 whole-file changes on `03-convenience-features.md`; verify count identical before/after; `formatting.sh --md -- FILE` still gates on all tools present.
- [prettier --write churns Slang user-guide markdown (setext→ATX) — never blanket-format a doc](../learnings/1789652649573-prettier-write-churns-slang-user-guide-markdown-se.md) — setext headings get rewritten to ATX across untouched sections; revert unrelated churn; formatters are `clang-format-17` not on PATH, so `--check-only` exits 1 on tool-missing not real errors.
- [Stale docs/generated/tests retarget: prettier 3.3.3 pin, closing-keyword trap, invariant CHECKs](../learnings/1790673868800-stale-docs-generated-tests-retarget-prettier-3-3-3.md) — install prettier@3.3.3 in /tmp for `--md` checks; fix a bundle's contradictory `_prompt.md` when retargeting its tests.
- [Retargeting a docs/generated agentic test: also update the bundle _prompt.md and keep the README row Claim equal to META purpose, word for word](../learnings/1790756499500-retargeting-a-docs-generated-agentic-test-also-upd.md) — `_prompt.md` restating the old claim makes regeneration revert the fix (#13282; precedents #13150/#13172); its verbatim-row half is corrected by the next atom.
- [New front-end errors can break the nightly agentic suite — run docs/generated/tests too](../learnings/1791528614678-new-front-end-errors-can-break-the-nightly-agentic.md) — E31215 broke `array-unsized.slang`; diff against master; recursion guards key on instantiated `Type*`.
- [Compiler PRs that change behavior must also run docs/generated/tests (nightly-only suite)](../learnings/1791580515115-compiler-prs-that-change-behavior-must-also-run-do.md) — #13546 broke `if-expression-signed-overflow-wraps.slang`; head-vs-base FAILED diff; `libslang-llvm.so` needed for FileCheck.
- [Slang semantic changes can break docs/generated nightly tests that PR CI never runs](../learnings/1791583400841-slang-semantic-changes-can-break-docs-generated-ni.md) — regenerate or linked expected-failures entry; `failed(expected)`; lint has hundreds of pre-existing errors.
- [Slang docs links: RTD page names = source file names; stdlib-reference moved](../learnings/1791665643660-slang-docs-links-rtd-page-names-source-file-names-.md) — permalink → source-file mapping; core-module-reference path; formatting.sh with no args only prints help.
- [Correction: docs/generated/tests README rows often do NOT equal //META purpose verbatim](../learnings/1790759833171-correction-docs-generated-tests-readme-rows-often-.md) — 15/72 rows differ; the `_common.md` rule is unenforced, so a mismatch is a nit; script bundle-wide checks.
- [slang-test does not run docs/generated/tests when given the directory — pass the files](../learnings/1792762511063-slang-test-does-not-run-docs-generated-tests-when-.md) — a directory prefix runs zero tests; xargs the files; per-prefix `uniq -c` count before citing coverage.
- [Nightly doc-test "No diagnostics found" can be an intentional diagnostic removal](../learnings/1792744585332-nightly-doc-test-no-diagnostics-found-can-be-an-in.md) — #13406 dropped in+inout and ref+ref alias warnings on purpose; read the PR's `tests/` diff first.
- [DIAGNOSTIC_TEST: //CHECK-NOT is inert but passes lint (side note: language reference moved to shader-slang/spec)](../learnings/1792745836053-diagnostic-test-check-not-is-inert-but-passes-lint.md) — `doc_ref` paths to `docs/language-reference/` are dead; read the spec via `gh api … application/vnd.github.raw`.
