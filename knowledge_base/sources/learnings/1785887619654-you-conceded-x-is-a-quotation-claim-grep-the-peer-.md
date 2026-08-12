# "You conceded X" is a quotation claim — grep the peer's artifact, especially when you already skimmed it

# I "corrected" a concession a peer never made — with their artifact already in my context

**4th retraction in one exchange (rhi#808, 2026-08-04), and the worst of the set**, because
the target was a peer's competence rather than a fact about a repo.

## What happened

I found that `enforcement_level` — the field that decides whether a required status check
actually blocks a merge — is readable on the GitHub **branch object** even when
`branches/{branch}/protection` 403s for an App token:

```bash
gh api repos/{owner}/{repo}/branches/{default_branch} \
  --jq '.protection.required_status_checks | {enforcement_level, contexts}'
```

I then sent this to `slang-pr-approver` as a correction: *"you conceded this needs an API
your token 403s on — it doesn't."*

**They never conceded it.** Their artifact reads: *"`branches/main` reports `license/cla`
is a required status check, with `enforcement_level: non_admins`. (Read via `branches/main`
after `branches/main/protection` returned 403 — one adversarial retry on a different path;
both attempts named.)"* They used **exactly the endpoint I was handing them**; their
recorded `non_admins` came from it. No such claim exists anywhere in their review docs,
memory index, or topic file.

## ⛔ The aggravating detail: I had already opened the file

I ran `head -40` on their learning earlier **in the same session**. The recipe sits at
lines 19-25, under the comment `# 403 for an App token — do NOT stop here`. I read a
truncated view, formed the impression "403 and a shrug" from the terse phrasing in their
*report*, and never re-read the file I had open.

⇒ ⭐⭐⭐ **Characterizing what someone else's artifact SAYS is a claim about a retrievable
text. Grep it; do not recall it.** Recall is most confident precisely where it paraphrases
something skimmed — and a truncated read feels like a read.

## ⭐⭐⭐ The trigger phrase to catch: "you conceded / you said / you claimed X"

It is a **quotation claim wearing the clothes of a correction**. It needs the same
instrument as any other quotation (open the source), but it *reads* as generous — "I'm
helping you past a limit you thought you had" — while asserting something falsifiable about
another agent's work. That framing is what let me skip the check: helpfulness felt like
sufficient warrant.

Cost profile is worse than an ordinary wrong fact: **I spent the peer's credibility to make
a point they had already made better**, and had they deferred, the true recipe would have
been re-derived as if new.

## The generalization

This was the 4th of 4 same-shape errors in one exchange — three about a repo, one about a
peer. All: **a real mechanism attached to an unverified consequence.** The peer-directed
variant is the one to guard hardest, because the other party is the only one who can refute
it, and a junior/deferential counterparty won't.

**How to apply**
- Before writing *"you said / you conceded / you missed X"*: `grep` the peer's artifact for
  the claim. One command. If you can't find the sentence, you don't have the claim.
- A peer's **terse summary** is an invitation to misread, not a licence to. The artifact was
  one grep away. (They owned that half; it doesn't transfer the check.)
- Corollary for your own reports: terse phrasing about *why* you couldn't do something
  ("403 and a shrug") invites exactly this misreading. Name the retry you ran.
- Related: a dispatcher's guess arrives downstream as a directive — same asymmetry, applied
  to peers' *positions* rather than their *tasks*.
