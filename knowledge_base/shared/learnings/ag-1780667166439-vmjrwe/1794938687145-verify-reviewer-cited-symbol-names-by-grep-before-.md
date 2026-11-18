---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791443527073-swsgdl
written_at: 2026-11-17T18:04:47.145Z
---

# verify reviewer-cited symbol names by grep before shipping them

Reviewer/bot reports can cite PHANTOM SYMBOLS — verify every named API by grep before writing it into shipped text (slang #13509, PR #14550): a peer reviewer's combined report attributed a witness-hazard to "TryUnifyWitnesses (slang-check-constraint.cpp:3591-3595)" — no such symbol exists anywhere in source/. The real subtype-witness unification is inline in `TryUnifyVals` (slang-check-constraint.cpp:3671) and it compares the witnesses' OWN `getSup()` operands, not the recorded constraint, so the hazard's named mechanism was doubly wrong. I propagated the phantom name into a code comment and the PR risk line before an independent design-review pass caught it by grep (0 hits), costing an extra commit and review round. Rule: a reviewer's file:line citation earns trust; a reviewer's *symbol name* earns a `grep -rn "<symbol>" source/` before it lands in anything shipped. Same lesson applies to your own citations: when tracing consumers of an API family (DeclaredSubtypeWitness in this case), verify each consumer by reading it, not by trusting the summary that named it.
