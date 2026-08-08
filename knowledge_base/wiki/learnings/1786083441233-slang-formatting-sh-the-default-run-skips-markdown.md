---
title: "slang formatting.sh: the default run SKIPS markdown — it is the one arm with no run_all fallback"
type: learning
topic: slang-compiler
source: learnings/1786083441233-slang-formatting-sh-the-default-run-skips-markdown.md
---

# slang formatting.sh: the default run SKIPS markdown — it is the one arm with no run_all fallback

## The finding

`./extras/formatting.sh --check-only` with **no selector flag** exits 0 while `--md` on the same tree
**fails**. Both results are correct, and the reason is a one-line asymmetry at `extras/formatting.sh:444`:

```bash
((run_all || run_ascii)) && ascii_check
((run_all || run_sh))    && sh_formatting
((run_all || run_cmake)) && cmake_formatting
((run_all || run_yaml))  && yaml_json_formatting
((run_markdown))         && markdown_formatting      # <-- no `run_all ||`
((run_all || run_cpp))   && cpp_formatting
```

`run_markdown=0` (`:57`), `run_all=1` by default (`:61`), and `--md` sets `run_markdown=1` **and**
`run_all=0` (`:82`).

⇒ **The default run cannot check Markdown, and `--md` cannot check anything else.** The two are mutually
exclusive. A green default therefore says nothing about Markdown, and a red `--md` says nothing about C++.

## Rules

- ⭐ **An exit 0 covers only the arms that actually RAN — enumerate them from the script, not from the
  flag you passed.** I reported the default green as "passes in full"; it excluded an entire file type.
- **Distinguish "tool absent" from "violation found" before reading a non-zero exit.** `--cmake` and
  `--sh` exit 1 when `gersemi`/`shfmt` merely aren't on PATH. Install them
  (`pip install --break-system-packages gersemi==0.21.0`; shfmt v3.10.0 binary to `~/.local/bin`) rather
  than narrowing your claim to the arm you can run — a narrowed claim is weaker *and* invites "did you run
  the required command?"
- **Version gates are half-open, max EXCLUSIVE.** Proof-of-run is exit 0 **plus** the version lines:
  `found clang-format 17.0.6, required [17, 18)` · `found gersemi 0.21.0, required [0.21, 0.22)` ·
  `found prettier 3.9.5, required at least 3` · `found shfmt 3.10.0, required at least 3`. clang-format
  18.x is rejected as "too new".
- **A bare `./extras/formatting.sh` with no action flag prints usage and exits 0** — a vacuous pass. Always
  pass an explicit action (`--check-only` or `--in-place`).

## Why it matters beyond this script

This is a general shape: a dispatch table where one entry is gated differently from its siblings. Reading
any single line looks correct; only comparing the lines reveals the exception. When you rely on "the tool
checked everything", **verify the dispatch covers everything** — the same way a per-file sum validates a
diff total.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786083441233-slang-formatting-sh-the-default-run-skips-markdown.md`_
