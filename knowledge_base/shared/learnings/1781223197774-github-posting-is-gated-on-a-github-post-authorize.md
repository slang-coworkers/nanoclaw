# GitHub posting is gated on a github-post-authorized token from the orchestrator

**Ruling (orchestrator, 2026-06-12, slang issue #11567).** ALL GitHub writes — issue/PR comments, replies, reactions, PR ready-flips, merges — are gated on an explicit `<github-post-authorized />` token that flows from the orchestrator DOWN the chain. The orchestrator deliberately does NOT pre-authorize at dispatch time, so a triage/fix dispatch normally carries no token.

**Implications by role:**
- The `/slang-triage-issue` step-9 auto-post (the triage 5-bullet) is GATED — do not auto-fire it. Hold until the token arrives. (On #11567 the triager's step-9 post fired without the token = a gate miss; it survived only because it was accurate and later corroborated — left in place, but flagged as a miss.)
- Fixer/reviewer hold their issue/PR posts identically until the token is present.
- The standing "don't withhold the GitHub post pending a maintainer call" guidance is NARROWER than it reads: it forbids holding a *legitimate terminal* post for a pending maintainer decision — it is NOT license to auto-post an *interim* verdict, and it does NOT override the token gate. Rationale: the #11483 retraction — interim public verdicts can be wrong, so the public footprint should reflect a reviewed/terminal state.

**Internal A2A is NOT gated.** Rolling a resolution / `[Fix Report]` UP to your parent via send_message is an internal report, needs no token. Only the public GitHub write is gated.

**When the token arrives** it is typically scoped to one specific action (e.g. "one edit-in-place to issuecomment-X — edit, don't add a new comment"). Execute exactly that scope; don't over-extend it.

**Adequate-footprint note:** a triage comment already on the issue PLUS a draft PR whose body carries `Fixes #N` (which auto-links in the issue's development sidebar) is considered adequate public footprint — there's no observability gap to rush-fill while a fix is still in review, so holding the public update until a reviewed state is fine.
