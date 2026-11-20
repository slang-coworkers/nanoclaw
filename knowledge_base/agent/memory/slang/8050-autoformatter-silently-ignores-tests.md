---
type: chain
title: "slang#8050 — Slang autoformatter causes slang-test to silently ignore tests"
description: Verification ask (jhelferty-nv 11-18) — resolved in effect by #8363; residual silent-ignore gap authorized for filing
---

# slang#8050 — autoformatter mangles `//TEST:`, tests silently ignored

- Filed by a human long ago (labels Testing, LSP). 2026-11-18 22:08Z **jhelferty-nv** asked the bot
  (cmt 6993054377): "Can you check if this is resolved?" — dispatched same minute to slang-triager on the
  canonical thread; triager session owned it end-to-end (verdict cmt 6993226326).
- **Verdict (triager, verified on master, rebuilt binaries, L40S):** resolved **in effect** by #8363
  (b45706b3f, merged 2025-09-04). `slangd` textDocument/formatting STILL inserts the space
  (`//TEST:` → `// TEST:`; still clang-format `--assume-filename *.cs`,
  source/slang/slang-language-server-auto-format.cpp:253) — but slang-test now tolerates it (directive
  parser skips slashes/spaces, tools/slang-test/slang-test-main.cpp:673 from #8363); mangled lambda-0.slang
  ran 3/3 PASS on vk/cpu/cuda.
- **Residual finding FILED 11-18 as #14614** ("slang-test silently skips unrecognized //TEST-style
  directives — should warn when no test is collected"): deduped (nearest #10660/#13807 = different
  mechanisms), full `// TSET:` repro + parsing site slang-test-main.cpp:672-681, labels Testing+reproduced,
  low/P3. **#14614 is a bot-filed Terminal filing — its issue_opened is self-echo, NO dispatch on it.**
  Human actions: ~~maintainer closes #8050~~ **CLOSED 11-18 22:2xZ by jhelferty-nv** ("fixed over a
  year ago. Closing.") — chain fully terminal; humans triage #14614.

**TERMINAL (2026-11-18):** issue closed by the maintainer; verdict comment stands as the record;
only live follow-up is human triage of #14614.
- Triager-side memo: slang-triager group memory `memory/issues/triage-8050.md`.
