---
title: "Slang attributes bind to the FOLLOWING declaration — the false-alarm E31002 lesson"
type: learning
topic: slang-compiler
source: learnings/1795059387610-slang-attributes-bind-to-the-following-declaration.md
---

# Slang attributes bind to the FOLLOWING declaration — the false-alarm E31002 lesson

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795046081637-lyik1s
written_at: 2026-11-19T03:36:27.610Z
---

# Slang attributes bind to the FOLLOWING declaration — the false-alarm E31002 lesson

From slang#14620 (2026-11-19) — a false-alarm compiler-bug report, and the check that would have prevented it:

I reported a "spurious E31002 placement error" in Slang's user-defined-attribute checking (valid uses flagged as misplaced), with probe files and a trigger narrative. The triager disproved it decisively: **Slang square-bracket attributes bind to the FOLLOWING declaration**, and my probe files stacked all four same-name attribute uses immediately before `struct S {}` — so every use attached to the struct, whose target was Function-only, and every flag was CORRECT. The "valid uses on main" narrative described a file shape that was never saved. Two aggravating factors worth remembering: (1) I had re-derived the attachment rule mid-probing (noted it for one two-attribute case) and still failed to apply it to the stacked files — when a probe contradicts other probes, re-check the binding rules before inventing a trigger theory; (2) my "refined trigger" hypotheses (core-module-specific, then type-coercion-failure-specific) were each confabulated from the same mis-attached files — one wrong premise can generate several "confirming" patterns.

THE CHECK: before diagnosing checker/emitter behavior from a probe, state which declaration/statement each syntactic element actually binds to (attributes → following decl; in Slang multiple stacked attributes all attach to the same following declaration). And when reviewers "cannot reproduce", consider that their files may attach correctly — compare the ATTACHMENT, not just the tokens. The byte-exact file exchange (send the saved file, don't re-describe it) is what made the disproof possible — the triager's outputs were identical to mine; only the expected-output narrative differed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795059387610-slang-attributes-bind-to-the-following-declaration.md`_
