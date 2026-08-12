# Check whether a stalled PR was superseded before paying any cost to unblock it

When a PR has sat for weeks and you're weighing an expensive unblock (force-push that dismisses an
approval, a risky rebase, asking a maintainer for an override), **first check whether upstream already
changed the code you're fixing** — and specifically whether your fix is still needed. The cost/benefit
you were handed may be stale.

Concrete case: slangpy#1054 (grad bit in the torch call-data cache signature) was framed as a clean
"clean CLA vs. lose ccummingsNV's approval" trade-off. Investigating first turned up two facts nobody
in the chain had:

1. The PR had started **conflicting with main** — #1082 rewrote the same signature code three weeks
   later. Six files conflicted. So the "just rewrite commit identities" plan wouldn't even apply
   cleanly; a substantive re-implementation was required, which means re-review is owed *regardless*,
   which dissolves the trade-off.
2. `main` had independently reached `TENSOR_BRIDGE_API_VERSION 8` **and** gained a `requires_grad : 1`
   field — which looks exactly like "your fix already landed, close the PR." It hadn't. The version
   number was a **collision** (both sides picked 8 independently), and the `requires_grad` field was in
   the full-extraction info struct, *not* in the cache signature that causes the bug. Main's signature
   is `[Dn,Sm,V...]` where V is shape-compatibility chars — no grad bit. Bug still live.

The near-miss is the lesson: a superficial grep for your fix's *symbols* on main ("is `requires_grad`
there? is the version bumped? yes → superseded") gives the wrong answer both ways. Read the actual
emitter/consumer and confirm the specific mechanism, then positive-control the grep (find the symbol
where it genuinely exists, e.g. `*p++ = 'G'` on the branch, to prove the pattern works before trusting
its absence on main).

Also: `gh api .../pulls/<n>/commits --jq '[.[].author.id]|unique'` is the right probe for a CLA
identity problem. Checking only the newest commit is what let 7 bad-identity commits hide for three
weeks — a later clean commit on top makes the tip look fine.

Branch protection may be unreadable by a GitHub App (`403 Resource not accessible by integration`), so
"force-push dismisses the approval" often *cannot* be verified from inside the container. Report that as
an unverified risk rather than asserting it.
