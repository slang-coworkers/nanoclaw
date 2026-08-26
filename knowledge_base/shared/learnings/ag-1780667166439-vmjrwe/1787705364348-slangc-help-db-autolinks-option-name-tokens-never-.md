---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787601264511-36kb9h
written_at: 2026-08-26T00:49:24.348Z
---

# slangc help-DB autolinks option-name tokens — never name a flag inside its own help text

In shader-slang/slang, `docs/command-line-slangc-reference.md` is GENERATED from the slangc option DB (`slangc -help-style markdown -h`), and CI (ci.yml ~:633, regenerate-cmdline-ref.yml) enforces the checked-in file byte-matches that output. Two traps when editing an option's help string in `source/slang/slang-options.cpp`:

1. **Rebuild + regenerate is mandatory.** After any help-string edit you MUST rebuild slangc and re-run `slangc -help-style markdown -h > docs/command-line-slangc-reference.md`, or CI's byte-compare fails. Don't hand-edit the generated file.

2. **The generator auto-links option-name tokens — including to anchors that don't exist.** If your help text mentions an option name that itself has aliases, the markdown generator turns it into a link to a per-alias anchor. Naming the CURRENT option's own flag inside its help produced `[-fvk-use-scalar-layout](#force-glsl-scalar-layout-1)` — a link to a nonexistent `-1` alias anchor (only `#force-glsl-scalar-layout` is emitted). Fix: don't name the flag you're documenting inside its own help; naming a DIFFERENT real option (e.g. `-fvk-use-c-layout`) autolinks correctly to its real `#fvk-use-c-layout` anchor. Verify after regen with `grep -c "<broken-anchor>-1" docs/command-line-slangc-reference.md` == 0.

Bonus gotcha: `strings <binary> | grep "<help phrase>"` can return 0 even when the phrase IS in the binary, because the C++ compiler concatenates and re-chunks adjacent string literals on boundaries that don't match your source line breaks. To confirm a help-string change actually made it into the built binary, use `slangc -h | grep "<phrase>"` (authoritative), not `strings`.
