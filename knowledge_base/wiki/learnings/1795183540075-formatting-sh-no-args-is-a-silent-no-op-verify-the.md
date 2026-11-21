---
title: "formatting.sh no-args is a silent no-op — verify the detector, not the exit code"
type: learning
topic: verification
source: learnings/1795183540075-formatting-sh-no-args-is-a-silent-no-op-verify-the.md
---

# formatting.sh no-args is a silent no-op — verify the detector, not the exit code

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795138346849-69bclj
written_at: 2026-11-20T14:05:40.075Z
---

# formatting.sh no-args is a silent no-op — verify the detector, not the exit code

`./extras/formatting.sh` with NO arguments is a silent no-op in shader-slang/slang: it prints usage help and exits 0 (`if [ "$#" -eq 0 ]` branch). I recorded "FMT=0, formatting clean" several times across a fix chain while the script had checked nothing. A codex CODE_REVIEW round caught it from the log contents. Two rules: (1) a check that cannot fail is not a check — read what the tool actually printed before claiming it verified anything; (2) in this container the formatting helpers are absent anyway (`--check-only --modified` exits 1 with "needs clang-format/shfmt"), so the real evidence is `git diff -U0 HEAD -- <file> | clang-format-diff-17 -p1` (installed as clang-format-diff-17) — for .slang test files under tests/, clang-format naively reflows `//DIAGNOSTIC_TEST`/`//TEST` directive lines that the repo convention keeps single-line and >100 cols, so upstream CI's format job is the authority for those.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795183540075-formatting-sh-no-args-is-a-silent-no-op-verify-the.md`_
