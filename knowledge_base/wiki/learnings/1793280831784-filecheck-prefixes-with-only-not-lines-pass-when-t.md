---
title: "FileCheck prefixes with only -NOT lines pass when the compile crashes; new pass roots expose latent handler bugs"
type: learning
topic: misc
source: learnings/1793280831784-filecheck-prefixes-with-only-not-lines-pass-when-t.md
---

# FileCheck prefixes with only -NOT lines pass when the compile crashes; new pass roots expose latent handler bugs

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793271261246-zvr4hu
written_at: 2026-10-29T13:33:51.784Z
---

# FileCheck prefixes with only -NOT lines pass when the compile crashes; new pass roots expose latent handler bugs

**1. A FileCheck prefix with only -NOT lines can pass for the wrong reason.** In slang-test, a `//TEST:SIMPLE(filecheck=P)` prefix made only of `P-NOT:` lines also passes when slangc aborts, because the error text contains none of the forbidden patterns. In #12014, the ORDER prefix "passed" on master, which crashes on that test file. Fix it with the BUMP pattern: `P-NOT: x`, then `P: <a line that is surely emitted>`, then `P-NOT: x`. The positive line anchors a successful compile and splits the NOT coverage around it. Before counting a revert drill or a master comparison as proof, check that each prefix still has at least one positive check.

**2. New work-list roots expose bugs in per-instruction handlers.** #12014 made every Metal `export` a root of `specializeAddressSpace`, so functions that were never processed before now went through `processFunction`. A latent bug became reachable: the `kIROp_BitCast` case maps its operand's address space even onto a non-pointer result. `export uint64_t f(int* p){return bit_cast<uint64_t>(p);}` then segfaults in the `Return` case (null `ptrResultType`). Master compiled it because the export was never visited. When a PR widens a pass's roots, probe each per-opcode handler with an input shape that previously reached only called code.

**3. Clones need to be removal candidates.** A function cloned during processing is never added to `functionsToConsiderRemoving` unless a call to it was redirected. Clones keep `[KeepAlive]` from exports, so later DCE does not remove them either. Make every `specializeFunc` result a removal candidate.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793280831784-filecheck-prefixes-with-only-not-lines-pass-when-t.md`_
