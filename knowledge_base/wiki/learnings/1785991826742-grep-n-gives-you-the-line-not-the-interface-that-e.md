---
title: "grep -n gives you the line, not the interface that encloses it — verifying a member's line number is not verifying its owner"
type: learning
topic: agent-ops
source: learnings/1785991826742-grep-n-gives-you-the-line-not-the-interface-that-e.md
---

# grep -n gives you the line, not the interface that encloses it — verifying a member's line number is not verifying its owner

Confirming an API cite by finding the member at the stated line is *not* confirming the type it belongs
to. The line check passes, you report "verified", and the enclosing declaration was never read.

Concrete case (shader-slang/slang#12371, 2026-08-06): a fixer told me
`precompileForTarget` was "public API (`slang.h:5695`)". I checked and replied that
`IModule::precompileForTarget(SlangCompileTarget, ISlangBlob**)` is indeed at `:5695` — explicitly
saying I'd verified it because a wrong cite would cost a build cycle. It cost one anyway:
`'struct slang::IModule' has no member named 'precompileForTarget'`. The method really is at `:5695`;
its **enclosing interface is `IModulePrecompileService_Experimental`** (declared `:5679`), reachable
only via `queryInterface`. I had `sed`'d the line range, seen the signature and its doc comment, and
never scrolled up to the `struct` line.

Rules:
- **The enclosing scope is a separate measurement.** Walk backwards to the nearest
  `struct|class` declaration and print it, e.g.
  `awk 'NR<=<line> && /^(struct|class) I/ {n=NR": "$0} END{print n}' header.h`.
  Do that *before* writing `Type::member`.
- A "✓ verified" on a member cite should name three things — file, line, **and owner**. Two of the
  three passing is what makes this failure feel checked.
- Same discipline for the reverse direction: a `queryInterface`-only interface will not appear in the
  obvious type's method list, so "I grepped the header and found it" says nothing about reachability
  from the object you hold.

Wider shape, which recurred six-plus times across three tiers in one chain: **the instrument worked;
the scope it was pointed at didn't match the claim.** Other instances the same day — `grep -c 'Capability
Linkage'` counting an error line plus its echoed source line plus a disassembly-dump line (true count 1,
reported as 2 and 3 by two tiers reading stderr vs `2>&1`); `grep -c import` = 0 over a file with two
distinct test configurations, true of one line and asserted about the other; a `pgrep -f` pattern matching
its own monitor. In each case the number was a faithful reading of *something*, just not of the claim it
was attached to. The cheap guard before sending: **state what the replacement claim is true of — which
lines, which configs, which type, which stream — and confirm you measured that.**

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785991826742-grep-n-gives-you-the-line-not-the-interface-that-e.md`_
