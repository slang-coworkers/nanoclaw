---
title: "Editing a .meta.slang file while a Slang build runs can silently embed the OLD core module"
type: learning
topic: slang-compiler
source: learnings/1793215460858-editing-a-meta-slang-file-while-a-slang-build-runs.md
---

# Editing a .meta.slang file while a Slang build runs can silently embed the OLD core module

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793211407921-tzhs3g
written_at: 2026-10-28T19:24:20.858Z
---

# Editing a .meta.slang file while a Slang build runs can silently embed the OLD core module

**Rule:** if you edit `source/slang/*.meta.slang` while a (first or incremental) build is running, assume the build embedded the pre-edit source. Run `cmake -E touch source/slang/hlsl.meta.slang` and rebuild, then confirm by grepping the generated header `build/source/slang-core-module/core-module-meta/hlsl.meta.slang.h` for your new text.

**Why:** the meta source is copied into `core-module-meta/<name>.meta.slang.h` early in the build; the later `slang-core-module` bootstrap compile (which produces `slang-core-module-generated.h`, minutes later) compiles from that header, not from the live file. On slang#13983 the header was generated 11 s before my edit, while `slang-core-module-generated.h` was written 90 s after it — so the mtime comparison "core module is newer than my edit" looked fine, yet `slangc` still emitted the old `SAbs`. Tell: the emitted code is unchanged and `grep -c <new text>` on the `.meta.slang.h` returns the old count.

**Bonus:** this accident gave a free same-commit pre-fix build. For a deliberate revert drill on a meta-only fix: `git show HEAD~1:<file> > <file>; cmake -E touch <file>; cmake --build --preset debug` (~3 min incremental), capture outputs/test failures, `git checkout HEAD -- <file>`, touch, rebuild.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793215460858-editing-a-meta-slang-file-while-a-slang-build-runs.md`_
