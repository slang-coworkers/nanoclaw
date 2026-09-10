---
name: feedback_peer_reviewed_is_not_human_reviewed_in_an_agent_fleet
description: "I wrote 'human coverage is intact (peer reviewer re-derived…)' about a file only an automated coworker had checked. Our coworker vocabulary is borrowed from human org charts, so the substitution is invisible."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

slang#9146 / PR #12379 (2026-08-06). CodeRabbit's default `!**/*.map` filter meant the bot never read
`slang-glslang.map` — the file defining the module's exported ABI, i.e. the substance of the PR. Noting
that the gap was covered anyway, I wrote in my own record:

> "Human coverage is intact (peer reviewer re-derived map == producer == consumer == 9 …)"

**False.** `slang-reviewer` is an automated coworker. **No human had verified that file.** The fixer
caught the identical slip in their own draft before posting — they were about to tell the maintainer the
map "did get human review," on the one file no bot read, which would have misrepresented exactly the
assurance under discussion.

⭐⭐⭐ **"Peer-reviewed" and "human-reviewed" are not interchangeable in an agent fleet, and the
substitution is invisible because our whole vocabulary for coworkers is borrowed from human org
charts** — *peer*, *reviewer*, *maintainer*, *shepherd*, *approver*. Every one of those words carries an
implicature of human judgment that no longer holds. Writing "the peer reviewer checked it" and reading
back "a human checked it" is a single step, and nothing in the sentence flags it.

⇒ **When the claim is about *assurance*, name the checker's kind, not its role.** "An automated reviewer
re-derived the export set three ways" / "no human has inspected this file." The distinction only matters
where a reader would act differently — which is exactly where these claims get made: when reporting
coverage to a maintainer deciding whether to trust a change.

⇒ **Specific trap: "a human can see it" is not "a human verified it."** jkwak had the map in his diff
view. That is availability, not verification. I nearly let the first stand for the second.

⚠️ **Second-order note on how it got into my record: I inherited the phrasing from the fixer's report
and repeated it.** They had already corrected it on their side before posting; my copy was written from
their earlier framing and never re-checked. ⇒ **Relayed phrasing carries relayed assumptions — when a
downstream report says "peer reviewed," ask which peer before folding it into your own.** Related:
[[feedback_deference_drifts_to_whoever_corrected_you_last]].

⭐⭐⭐ **WHERE CONTAINMENT ACTUALLY IS — and the fixer's amendment is the load-bearing half.** I concluded
from this chain that error containment sits at the **publication boundary** (5 of the fixer's first 7
errors were caught by the critique gate, not by self-review). True but incomplete: **this phrase escaped
through a RELAY, and relays never cross that boundary.** Coworker-to-coworker text has no gate between
it — the fixer and I exchange prose directly. So the gate caught everything headed for GitHub and caught
*nothing* on the path into my own record.

⇒ **Two mechanisms, not one, and they cover disjoint paths:**
- **Publication boundary (the gate)** — catches what goes out to humans/GitHub. Non-optional for
  symbol/measurement work.
- **"Treat relayed phrasing as unverified by default" (mine to run)** — the *only* thing covering
  agent-to-agent hops. No gate exists there and none is coming.

A conclusion of the form "the gate protects us" is therefore an overstatement of scope: it protects one
edge of the graph. Every internal edge is uninstrumented.

✅ **What the published artifact got right:** the posted PR comment says "independently re-derived three
ways — the map, the producer, and the consumers, all nine, with every difference set empty" and never
claims a human did it. The accurate form is *more* informative than the false one, because it names the
method instead of appealing to the checker's authority.

## Companion from the same review round — a grep pattern that couldn't match the code

The fixer also nearly published "**four of five** entry points are unguarded." Their check was
`grep -cE "if *\(!?m_x\)"`, which structurally cannot match the `== nullptr` spelling the file actually
uses. Verified independently: `m_validate` guards at `:363`, `m_disassembleWithResult` at `:380`,
`m_disassemble` at `:403`, `m_freeDisassembly` at `:391` — all `== nullptr`. **Only `m_link` at `:428`
is unguarded** (`if (!m_link(&request))`). The false claim would have overstated the hazard to a
maintainer by 4×. Ninth instance of the session's one generator — instrument population ≠ claim
population; see [[feedback_state_what_the_residual_is_not_just_its_size]].
