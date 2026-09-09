---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786491343589-dcbfog
written_at: 2026-08-12T13:29:54.634Z
---

# [approver/critique-mustfix] Attributing a behavior change needs an ISOLATING control, and capture exit codes without a pipe

**Context.** slang#12479 (bot-authored, Devin-only tier): adds an unconditional `ensureDecl(enum, ReadyForLookup)` before two `_coerce` sites that read `EnumDecl::tagType`. Challenger substance favored approval; the codex critique gate took 3 rounds, each catching a RIGOR defect in MY derivation (the verdict never moved). Recorded ABSTAIN_POLICY:ESCALATED after the 3-round soft-cap + an operator-prompt timeout.

**The three must-fixes, and the transferable rule each yields:**

1. **Over-claim of a re-entrancy scope.** I wrote "case initializers are the SOLE path that reads a being-checked enum's tagType." Wrong: an enum's *base/inheritance clause* is checked WITHIN the ReadyForLookup transition (`visitEnumDecl` loop, BEFORE the tagType assignment), so `enum E : I<int(E(1))>` also reaches the new ensureDecl→CyclicReference path. RULE: when you claim "X is the only way to reach Y," enumerate every checker that runs before the field you're guarding is assigned — don't reason from the one example the PR's own test happens to cover.

2. **A "control" that isn't isolating proves nothing.** My first empirical discharge compared two ARBITRARY pre-built binaries (a Debug build at one commit + a release binary at another). Codex refuted it: neither binary's source carried the diff under test, so they differed by many unrelated commits. RULE: to attribute a behavior change to a specific diff, build **patched-head vs. the SAME head with ONLY that diff reverted** (`git diff --stat -- <file>` must show exactly the diff), same config. Two arbitrary versions that both lack (or both have) the change tell you nothing.
   - Corollary (build mechanics): the changed logic is usually in the shared lib (`libslang.so`), NOT the thin `slangc` driver. Copying the driver aside gives byte-identical binaries and rc=127 (detached from its .so). Rebuild the lib per variant and run IN-PLACE.

3. **`rc=0` read from the end of a pipe.** I wrote "verified graceful: rc=0" for a rejection case. That `rc` was `head`'s exit (`slangc … 2>&1 | head` → `$?` is head's), not slangc's — which was actually 255. And the patched build surfaced the cyclic-reference as an uncaught `E99997 AbortCompilationException` with a "file an issue" footer (a real diagnostic-quality regression on that one invalid input), not "graceful." RULE: capture a program's exit code WITHOUT a pipe (`cmd >out 2>&1; echo $?`), and never call an error path "graceful" until you've read the full output and the true rc.

**Meta-pattern (the tell).** Every one of the three was a PAST-TENSE CLAIM ABOUT MY OWN WORK ("case-inits are the sole path", "verified with two builds", "verified graceful rc=0") that pre-asserted a check I hadn't actually run correctly. The countermeasure is mechanical, not attentional: build the isolating control; capture rc without a pipe; read the whole diagnostic. The scrutiny I aim at the PR is the scrutiny I owe my own instruments.

**Process note.** 3 critique rounds = soft-cap → escalate to a human, never silently retry. The substance can still be sound (here it was) while the DERIVATION needs 3 passes — that combination is exactly what ABSTAIN_POLICY:ESCALATED is for; it does not round up to approve.
