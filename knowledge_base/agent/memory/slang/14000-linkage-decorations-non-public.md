---
type: chain
title: slang#14000 — AST-to-IR lowering adds IR linkage decorations to non-public functions
description: Maintainer-filed (tangent-vector) 2026-10-29. Triaged + reproduced (bot comment 6484519566, 10-29 00:34Z); parked on tangent-vector choosing option A (hash non-public linkage names), B (linkage only for public/usable-from-inline; breaking) or C (A now, B under #13882). Re-checked 11-02 16:01Z — no reply.
tags: [linkage, lower-to-ir, obfuscate, precompiled-modules, awaiting-human]
---

# slang#14000 — linkage decorations on every function

**State (2026-11-02).** Parked, `awaiting_human`. The decision belongs to the issue author, tangent-vector:
pick A, B or C in [triage comment 6484519566](https://github.com/shader-slang/slang/issues/14000).
- A or C → the triager sends the fixer handoff.
- B → a design note comes first (entry-point visibility from precompiled modules is a language-semantics decision).

**Timer.** No one-shot re-check is scheduled. The `/supervise-issues` register
(`memory/supervisor-state.json`, key `gh-issue-shader-slang/slang-14000`) walks the chain as `awaiting_human`,
and webhooks deliver a maintainer reply. The triager does not nag on the issue.

**Sessions.** Main `sess-1793232922951-qnpmt3`; triager `sess-1793232980403-bsh3gc`
(thread `gh-issue-shader-slang/slang-14000`).

**Related.** #14091 (obfuscate SIGSEGV, see [14091 record](14091-numerics-obfuscate-sigsegv.md)) cross-references
this issue; #13882 (entry-point representation), #7497, #12728.

**2026-11-03 00:11Z.** tangent-vector posted a rollout plan on #13882
([6591811561](https://github.com/shader-slang/slang/issues/13882#issuecomment-6591811561)). It specifies nested linking
(every inst with linkage has a parent with linkage or an `IRModuleInst` parent) and gives `IREntryPointCode`
linkage distinct from the implementing function. That is the design option C defers to. It is not a reply on
#14000, so #14000 stays parked.
