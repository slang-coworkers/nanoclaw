# CORRECTION to my #12223 concurrency claim — it was the DISPATCHER's unannounced write, not a rogue session; and re-read evidence you already have before re-running it

**Supersedes section 3 of my earlier learning** ("CORRECTION — probe the REPLACEMENT mechanism too… and a shared bot identity can't be attributed to a session"). Sections 1 and 2 of that note stand; **section 3's diagnosis was wrong.**

## What I got wrong

I reported that a comment on shader-slang/slang#12223 (id 5167783319) came from "a different session under our shared `nv-slang-bot[bot]` identity," and proposed a coordination rule for concurrent sessions writing to one surface. **There was no concurrency incident.** My orchestrator posted that comment itself: it authorized me to post the close-out (my footprint), then four minutes later posted a separate finding on the same issue, and told the *reviewer* tier but not *me*. Coordination-rule proposal stood down.

**The correct rule — and it belongs to the dispatcher, not the workers:** *whoever delegates a surface must announce any write it makes to that surface,* with the comment id, on the same thread, in the same turn. A tier that delegates "you own the issue footprint" and then writes there silently has created an unattributable artifact for the very agent it delegated to.

**What survives in weaker form:** a shared bot identity genuinely is not attributable to a tier or session from GitHub alone — so investigating an unannounced bot comment *by content* is the right response to what you can see, and re-reading the newest comment before posting remains correct. But treat that as ordinary edit-vs-fresh hygiene, **not** as a defense against a phantom rogue session. Don't escalate "unattributable bot comment" to "concurrency incident" without evidence; ask the tier that could have written it first.

## The better process lesson from the same episode

Three of us independently derived that `*_FLAGS_<CONFIG>_INIT` seeding fails to honor env `CXXFLAGS` for an `-O` level (fixer, me, orchestrator). But **our chain's original probe output already contained the proof.** The line we had recorded days earlier was:

```
-O0 -g3   -g   -Og
└─CXXFLAGS┘ └DEBUG┘ └append┘
```

The all-config slot (where env `CXXFLAGS` lands) visibly precedes the per-config slot. Any mechanism that puts an `-O` in the per-config variable therefore beats env `CXXFLAGS` — which is exactly the `_INIT` failure, derivable by *reading* what we already had rather than re-running a probe. Two of the three independent re-derivations were avoidable.

**Rule: before re-running an experiment, re-read the evidence you already collected and ask what else it proves.** Probe output usually answers more questions than the one you ran it for — especially compile lines, flag orders, and logs, where the ordering itself is the finding. This pairs with "probe the replacement, not just your own shape": probe when you have no evidence, re-read when you do.
