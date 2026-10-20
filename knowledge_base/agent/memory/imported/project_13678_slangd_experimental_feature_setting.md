---
type: project
name: project_13678_slangd_experimental_feature_setting
description: "slang#13678 (fukalous, assoc NONE, 10-15 19:31Z): slangd ignores -experimental-feature and has no LSP setting for it, so `import slang.numerics` can't be enabled in editors. The slang-side half of slang-vscode-extension#78 (and closed slang-vs-extension#42). Routed to slang-triager on the canonical thread, reusing the #78 evidence."
---

# slang#13678: slangd has no way to enable experimental standard modules

**10-15 19:31Z, `issue_opened`.** Live read about 19:40Z: open, human author **fukalous** (`author_association: NONE`,
first filing on slang), no assignee, labels or milestone, 0 comments, `updated_at` = `created_at`. Only my webhook
session `sess-1792092683043-imv2h0` was on `gh-issue-shader-slang/slang-13678`. Dedup: `gh search` found no other
slangd experimental-feature issue and no open PR. Main checked the code claims at master `6597ec9202`:
`LanguageServerStartupOptions::parse()` matches only `-vs` and `-periodic-diagnostic-update`, the global session sets
only `enableGLSL`, and `slang-language-server.cpp` doesn't mention "experimental" anywhere.

**This is the issue the #78 chain was waiting for.** On slang-vscode-extension#78, fukalous showed the flag path
doesn't exist (19:19Z), and the #78 reporter, HildarTheDorf, said they'd file the slangd issue (19:22Z). fukalous
filed it instead, so a second filing by HildarTheDorf would be a duplicate. Earlier, Main told the triager not to file
our own slang issue but to triage the reporter's when it arrived, reusing the #78 evidence: the triager memo
`prod-groups/slang-triager/memory/issues/slang-vscode-extension-78.md`, the session gate at slang-session.cpp:1636-1646,
the #42 prototype in `wt-vsext42`, and `scratch-vsext-42`. See also `memory/domain/slangd-workspace-configuration.md`
and `triage-13216.md`; the #13216 tracker doesn't cover this.

**Disposition:** dispatched `slang-triager` on the canonical thread for a normal slang triage: repro, dedup against
#13216 and #13192, fix layer and a fixer brief, plus one 5-bullet comment on #13678. No fixer until the triage report
is in. Any post on #78 (the v3 draft, or a link back) is still gated on the operator, because that repo is unlisted.
The R6 4-day defer (#13596) is not applied: it's still a proposal and routing hasn't changed.

**10-15 19:58Z, TRIAGED.** I checked the live comment, labels and Type. slang-triager posted
[6201079293](https://github.com/shader-slang/slang/issues/13678#issuecomment-6201079293) (bot, 2459 chars,
codex-approved on round 2). It links vscode-ext#78, #13216 and #13192, adds labels `reproduced` and `LSP`, and sets
Type=Feature. Verdict: feature gap / medium / P2, not a duplicate. Root cause: `Workspace::createWorkspaceVersion`
(slang-workspace-version.cpp:549-561) adds only `LanguageVersion`, so the gate at slang-session.cpp:1636-1646 always
fires (I spot-checked both). Side effect: the same option also gates `__func_extension` and `__apply`. Recommended fix
is **A**, a `workspace/configuration` bool (for example `slang.enableExperimentalFeatures`) that works the way
`predefinedLanguageVersion` does. B (a general compiler-options list) is a maintainer design call. C (a startup flag) is
complementary only. D (`initializationOptions`) is #13216 item 3. E (always on) is rejected. The memo and fixer brief
are in `prod-groups/slang-triager/memory/issues/triage-13678.md`, and the repro driver is in `scratch-vsext-42/ws78`.

**Held; no fixer.** The setting's name and shape are the maintainers' call, and the issue is unassigned. Operator
decisions: whether to dispatch a fixer now with a draft PR under the A name, and whether to add the triager's proposed
"(tracked in shader-slang/slang#13678)" pointer to the #78 v3 draft (that needs a fresh OUTPUT_REVIEW and changes the
sha). Re-check task `rechase-13678-maintainer-cbf8` runs 10-20 16:00Z. Keep `wt-vsext42` and `scratch-vsext-42` until
then.

**10-16 ~08:00Z, after the reboot: #13678 is gone from GitHub (HTTP 404, not 410 "deleted").** Also 404: our triage
comment 6201079293, `users/fukalous` (both the API and the web page, with and without auth), and fukalous's #78 comment
6200365871. The control checks all came back fine: #13677, #13679, the #78 issue and HildarTheDorf's 6200415295
comment return 200. So this isn't a credential problem. The pattern (the account plus every issue and comment it made
returns 404) fits GitHub hiding a suspended or flagged account. #78 now shows 2 comments but only HildarTheDorf's is
visible. The triage content survives only in `prod-groups/slang-triager/memory/issues/triage-13678.md` and in the
memo I sent to the dashboard.
Consequence: the #78 v3 draft dropped the slangd-side analysis because "fukalous already said it" and "the reporter is
filing it", and neither is visible any more. I rewrote `rechase-13678-maintainer-cbf8` (10-20 16:00Z) with a decision
table: the issue reappears / someone re-files it / neither, in which case ask the operator whether the triager should
file it. Operator notice: unrelated to the GPU; this chain made no GPU-free conclusion (LSP only).
Side finding: `gh api users/<x>` returns OneCLI `app_not_connected` 401 even for octocat, while repo endpoints work.
The users endpoint isn't in the GitHub app's scope, so use unauthenticated `curl https://github.com/<login>` to check
whether an account exists.

**10-19 16:45Z: the design moved to Discord, and the reporter will implement it themselves.** Maintainer jkwak-work
(MEMBER) commented on #78 (cmt 6272327623) linking Discord msg 1560389108772241494 (#general, 10-15 20:29Z). In it,
HildarTheDorf offers to add slangd compile-options support and asks generic-vs-single-flag. In the message's Discord
thread (10-16), tessfactor prefers a generic config file that slangd finds relative to the sources, possibly the
package-manager JSON (sirspate's prototype uses JSON); HildarTheDorf compared it to clangd's `compile_commands.json` /
`compile_flags.txt`. No decision yet. Consequences: the bot files no slangd issue and dispatches no fixer (that would
collide with a contributor's own work on an open design). The triager's option A (`slang.enableExperimentalFeatures`
setting) is one candidate, not the direction. v4's "expose the new option as a `slang.*` setting" bullet presumes a
design, so the triager is reassessing v4. `rechase-13678-maintainer-cbf8` (10-20 16:00Z) was rewritten to match.

**10-19 17:06Z: v4 retired, v5 drafted; waiting on the operator.** The triager's v5
(`prod-groups/slang-triager/.gh-comments/draft-vscode-ext-78-reply.md`, sha256 `87afd90f…9abdc9ac`, 2019 chars, codex
round-2 APPROVE) takes no side on the slangd design. It reports only the extension's packaging gap:
`build-package.sh:48-53` never copies `slang-standard-module-<ver>/`, and v2.0.10 bundles v2026.8, while numerics
first shipped in v2026.17.1. I checked these claims myself. The E00001→E00104 repro is the triager's and I didn't
re-run it. I sent the post-or-hold decision to the dashboard (msg 13, thread `gh-issue-…-vscode-extension-78`).
The default is hold. `rechase-13678-maintainer-cbf8` (10-20 16:00Z) checks for the operator's answer.
