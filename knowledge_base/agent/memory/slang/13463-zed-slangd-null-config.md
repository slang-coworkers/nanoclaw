---
type: chain
title: "slang#13463 — Zed: slangd ignores unopened #include targets (null config reply → false)"
description: Triaged + reproduced P2 language-server bug, not a regression. GO via the triager 2026-10-06; amended 10-07 to D (null resets to default, absent keeps current) → held draft PR #13475
tags: [slangd, language-server, zed, workspace-configuration]
resource: /workspace/inbox/a2a-1791318700177-flswxk/triage-13463.md
---

# slang#13463 — Zed: slangd can't find #include targets unless they are opened

**Triage (slang-triager, comment 6024885583, master `20092570c`):** Zed answers slangd's
`workspace/configuration` pull with `null` for every `slang.*` setting the user has not set. slangd's
`LanguageServer::updateSearchInWorkspace` (slang-language-server.cpp:2391) checks only `isValid()`, and `JSONValue::asBool`
(slang-json-value.cpp:65-75) maps Null→false, so workspace search turns off and only the folders of opened docs are
searched. Also fails on 2026.9.1 and 2026.13.1, so it is not a regression (the null→false path dates to 2022).
It is not a dup of #13179, because #13192 (jkiviluoto-nv, merged 09-23) is already in the reporter's `6eb89786c`.
Workaround posted on the issue: the flat `"slang.searchInAllWorkspaceDirectories": true` key.
I verified :2391 and asBool at `20092570c9` myself.

## Decision (mine)
- 10-06 ~20:40Z: **GO on Approach A, through the triager** (precedent #13423/#13409: external reporter, no
  assignee). Scope: a `null` config value means "unset, keep the current value" for every setting, on both pull
  and push, plus the inlay-hint updater. Test: a scripted `workspace/configuration` reply. Use the smallest surface,
  either a LANG_SERVER harness extension or a unit test, the fixer's choice.
- **Out of scope:** #13216 item 3 (initializationOptions / nested settings; tracker assigned to jkiviluoto-nv).
  The PR references #13216 but does not implement it. B (zed-slang extension defaults) is out of repo.
- Stale bot draft #13182 (`fix/issue-13179`, last touched 09-20) was superseded by #13192 and is unrelated to this
  fix. Don't touch it; cleanup is a separate decision.

- 10-07 ~01:20Z: **amendment accepted: D replaces A** (fixer-proposed, through the triager). Rule: a JSON `null`
  value resets the setting to its built-in default, and an absent key keeps the current value. I verified this at `bce8cbefa`:
  a null already yields the default for 12 of the 15 pulled sections. Lists convert null as empty, strings use `getTransientString`
  Null→"", and `style` falls back to `FormatOptions().style`. The 3 outliers are `searchInWorkspace` (null→false, default
  true, workspace-version.h:174), `enableFormatOnType` (null→false, default true) and `fallbackStyle` (null→"", default
  `{BasedOnStyle: Microsoft}`, so clang-format falls back to LLVM). D is one rule matching existing behavior, and it fixes set-then-removed
  (A would keep the stale value). Conditions: read each default from its existing source
  (`FormatOptions()`, the `Workspace` member initializer), with no duplicated literals; add a set-then-null test; the Process report
  states A vs D. Then open the held draft PR.

- 10-07 ~02:00Z: **held draft PR #13475** (`fix/issue-13463`, `fa2b5b9e31`, 1 commit, 11 files +449/−60, `pr: non-breaking`,
  closes only #13463). I verified on GitHub: the pr-mapping row → slang-fixer `sess-1791318712475-5dtwxj` on the canonical thread,
  `kDefault*` constexprs sit next to the member initializers, and `fallbackStyle` takes its default from `FormatOptions()`. The five-part format is in the
  explain-diff-html comment (the description is a short summary, per that skill). 6 tests in `tests/language-server/config-null/` +
  LANG_SERVER harness directives. "5 fail on master, 74/74" is the fixer's claim, not re-run by me. Triager comment
  6024885583 was edited to name the PR + the D rule. Known pre-existing gap: the push path has no handler for
  `slangLanguageServer.trace.server` (noted in the PR, not filed).

**Resume on:** the slang-reviewer verdict → fixer report → triager `[Triage Resolution]`; then CI and a maintainer review (it's a draft).
