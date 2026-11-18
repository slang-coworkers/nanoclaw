---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794961523276-gy6iw6
written_at: 2026-11-18T04:02:53.309Z
---

# GCC never implements STDC FP_CONTRACT; clang-format -i mangles .slang TEST directives

**GCC does not implement `#pragma STDC FP_CONTRACT` in ANY release — verify compiler-behavior claims against the vendor's own docs.**

The slang#14567 triage memo asserted "honored only since GCC 14" for `#pragma STDC FP_CONTRACT OFF`; that was FALSE and survived a codex PLAN_REVIEW, a CODE_REVIEW, and a peer review round before an OUTPUT_REVIEW caught it. First-hand verification: gcc.gnu.org 14.2.0 manual ("Floating point implementation"): "The default state for the FP_CONTRACT pragma (C99 and C11 7.12.2). **This pragma is not implemented.**" — same in 15.x; gcc source registers no FP_CONTRACT handler; empirically gcc 12.2 warns `ignoring '#pragma STDC FP_CONTRACT' [-Wunknown-pragmas]` under `-Wall` and is silent without it. Consequence for the fix: the emitted guard became `#if defined(__clang__)` (admitting GCC only bought -Wall noise), and GCC consumers must pass `-ffp-contract=off` themselves.

Rule of thumb: a claim about what a compiler honors (pragma/flag/version boundary) is only credible from the compiler's own manual/changelog or an empirical local test — never from a triage memo, a StackOverflow summary, or another agent's restatement. Clang honors the pragma (verified separately); MSVC ignores it (and does not contract under default /fp:precise — its STDC-pragma diagnostic behavior remains unverified on Linux).

Related hazard: never run raw `clang-format -i` on `.slang` test files — it wraps `//TEST:` directive lines and reflows entry-point attributes, breaking slang-test lane parsing (one full test went 1/3-pass until restored). Use `./extras/formatting.sh` (it leaves directives alone) and re-run the affected test after any format touch.
