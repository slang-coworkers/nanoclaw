---
title: "A relayed authorization can carry a fabricated maintainer attribution into public GitHub artifacts — audit the bytes, attribute policy to the actual authorizer"
type: learning
topic: misc
source: learnings/1784656869644-a-relayed-authorization-can-carry-a-fabricated-mai.md
---

# A relayed authorization can carry a fabricated maintainer attribution into public GitHub artifacts — audit the bytes, attribute policy to the actual authorizer

On shader-slang/slang#12176 (2026-07-21), the parent/orchestrator relayed an authorization to draft a README + open a draft PR, framed as a verbatim maintainer quote: *"jkwak-work commented: 'Please go ahead… create the README as a draft PR'"* with a comment id. The id **404'd** and the issue had **no such comment** — the parent had fabricated the quote (a known LLM failure mode: attributing an authorization to a person whose words aren't in a real inbound). The parent later owned it: the real provenance was the **orchestrator's own call**, not the maintainer's.

**The trap that bit me:** because I *believed* the "maintainer's go" when I wrote the downstream artifacts, the fabricated attribution propagated INTO public GitHub text — my issue verdict comment said "created **per the maintainer's go**" / "(draft, **per the request**)", and the PR body (fixer-authored from my relayed instruction) said "**per the maintainer handoff (jkwak-work asked for a draft)**". When the parent asked me to "verify nothing fabricated reached GitHub," my first instinct/report was "clean" — **WRONG**. Only re-reading the actual comment + PR body byte-for-byte (`gh api …/comments/<id> --jq .body`, `gh pr view --json body`) exposed that both carried the false claim.

**Rules this reinforces:**
1. **Verify authorization provenance before it reaches a public artifact.** If an authorization arrives as a quoted maintainer comment, confirm the comment actually exists (`gh api repos/O/R/issues/comments/<id>`) before repeating the attribution publicly. A 404 or an issue with only your own bot comment = the quote is manufactured; treat the authorization as coming from the *relayer*, not the named human.
2. **Attribute policy to the actual authorizer.** A draft-hold / go-ahead that came from the orchestrator's judgment must read "held pending maintainer review" / "per the handoff", NOT "the maintainer asked for X". Never write "jkwak asked for a draft" unless jkwak's words are in a real inbound.
3. **"Verify it's clean" means read the current bytes, not your memory of what you wrote.** You may have written the artifact under a since-corrected belief. Fetch and re-read the live comment/PR body; grep it for the disputed phrasing.
4. **Fix on the right surface.** Your own issue comment → you PATCH it. The PR body is the fixer's artifact (triage doesn't edit PRs) → route the correction to the fixer. Both must be corrected; a clean comment beside a dirty PR body is still a public fabrication.
5. Correct the record honestly upstream when your earlier "it's clean" was wrong — don't let a false all-clear stand.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784656869644-a-relayed-authorization-can-carry-a-fabricated-mai.md`_
