---
name: project-12222-lexer-lone-utf8-continuation-byte
description: "slang#12222 lexer doesn't diagnose lone UTF-8 continuation bytes — triaged+reproduced, PARKED (skiminki-nv owns)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 31eb18b6-452a-4e17-a097-402c76c20ce3
---

shader-slang/slang#12222 — "Lexer does not diagnose lone UTF-8 continuation bytes." Split-off follow-up of #11858; NOT a regression (the #11858 silent-truncation regr was fixed by merged #11886 / `3e061e1`, which handles lead-byte-first malformed sequences only). Bug / diagnostic-completeness · low · P3 · frontend-lexer.

**State (07-24):** TRIAGED + REPRODUCED @HEAD 5281ccc66 → **PARKED at triaged, NO fixer dispatched.** Author/assignee **@skiminki-nv** self-filed (via nv-slang-bot) + self-assigned + explicitly deferred to "a subsequent PR" he intends to own (per his #11858 comment, for clean bisectability). Verdict posted on issue (comment 5073086030); labeled `reproduced`, Type=Bug. Matches self-filed+self-assigned → author-owns pattern (cf. [[project_11782_conditional_symbolic_flag_spirv_ice]]).

**Repro:** `/* <0xA8> */` (lone continuation byte in comment) → `-target spirv -no-codegen` exit 0, zero diagnostics (orphan swallowed); control `/* <0xC0> */` (lone LEAD byte) → `error 10006: invalid UTF-8 byte sequence: 0xC0` (proves #11886 live; gap is continuation-specific).

**Root cause / fix (memo ready if bot takes it):** guard `if (isUtf8LeadingByte((Byte)c))` at `slang-lexer.cpp:267` (`_peek`) & `:350` (`_advance`) too narrow — never routes continuation bytes into decoder. Decoder `getUnicodePointFromUTF8` (`slang-char-encode.h:35-39`) ALREADY rejects a leading continuation byte (`leading<=0xBF → valid=false`, consumes exactly 1 byte). **Approach A (rec):** broaden both guards with `|| isUtf8ContinuationByte((Byte)c)` → enters correct decoder → E10006 + consume-and-recover, mirroring #11886. ~2 lines + test extending `tests/bugs/gh-11858-malformed-utf8.slang` (or new `gh-12222-*.slang`) under `//TEST:SIMPLE(filecheck=CHECK): -target spirv -no-codegen`. Approach B (hand-rolled diagnose) rejected — duplicates decoder path. Full memo: `/workspace/inbox/a2a-1784917162062-1pdkxy/triage-12222.md`.

**Release trigger:** @skiminki-nv comments "make a PR" / reassigns to bot, OR operator says the word → hand to slang-fixer with the memo (Approach A). Umbrella #11858 remains OPEN.
