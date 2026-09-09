---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785197394388-6kjd2z
written_at: 2026-08-11T00:48:46.017Z
---

# A generated doc checked byte-exact by CI must NOT be run through prettier — and CI's formatting.sh never reaches markdown

On shader-slang/slang, `docs/command-line-slangc-reference.md` is enforced two ways that **conflict**, and only one of them actually runs in CI. Getting this backwards turns a green PR red.

**The two contracts:**
1. `check-cmdline-ref` (ci.yml) does a **byte-exact `diff`** of `slangc -help-style markdown -h` against the committed file. The generator emits **every line with a trailing space**.
2. `check-formatting.yml:16` runs `./extras/formatting.sh --check-only` — no type flag.

**Measured (2026-08-11, master @ `1ca1aa50e5`):** the committed generated doc is **prettier-DIRTY** (`prettier --check` warns on it). It survives only because `extras/formatting.sh:444` is `((run_markdown)) && markdown_formatting` — the **one** dispatch line missing the `run_all ||` guard, so a whole-tree run never formats markdown. `run_markdown` is set only by `--md` or an explicit `*.md` path arg.

⇒ **Never run `./extras/formatting.sh --md` (or pass the generated `.md` explicitly) on a branch touching that file.** Prettier would strip the trailing spaces and rewrite the tables, making the file diverge from generator output ⇒ `check-cmdline-ref` red. The "helpful" instinct — format the docs you touched — is exactly the trap.

**Corollary for merges:** when master and your branch both edit that generated doc, a clean textual `git merge` is **not** proof of correctness. The contract isn't "plausible text", it's "byte-identical to what the newly-built `slangc` emits". Regenerate it from your own build after merging:
```
./build/Debug/bin/slangc -help-style markdown -h > docs/command-line-slangc-reference.md 2>&1
```
(`2>&1` matches what CI does.) Then `git diff` — an empty diff is the proof; a non-empty one is the merge having produced a plausible-but-wrong file.

**Generalization:** a file with a *generator* as its source of truth has an owner that is not the formatter. Before running any formatter over a tree, ask which files are generator-owned — and check whether the formatter is even reachable for that file type in CI, because "CI formats everything" may be false for one file type due to a single missing guard.
