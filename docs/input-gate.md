# Input gate: one gate, two checks

The host input gate decides, for every routed GitHub delivery, whether it may start
Claude work. It is the threat model's §5 P0-1 control ("two-path framing at the router")
merged with the Claude access policy. Tracking issue: slang-coworkers/nanoclaw#2274.

**Status: shadow mode only.** The gate decides and logs. It blocks nothing, routing never
waits for it, and turning it on cannot change what any delivery does.

## The rule

- **On GitHub, only an exact-word `@nv-slang-bot` mention starts work.** Issue, PR and CI
  events start nothing on their own (`src/github-mention.ts` defines what counts as a
  mention).
- **Check 1 (threat model): who is it?** An account is *allowlisted* when, in this order:
  1. its numeric GitHub id is in the maintainer roster;
  2. its repo permission is `write` or above, on a protected repo: every repo of the org,
     or only the repos in `NANOCLAW_INPUT_GATE_REPOS` when that is set. Admin on a repo
     the maintainers do not control (a personal repo with the App installed) proves
     nothing;
  3. it is a member (public or private) of the org.

  A `Bot` account is allowlisted by its roster id only. Repo permission and org
  membership describe people, and GitHub's user APIs do not answer for App accounts.

  For deliveries that do not start work, `author_association` is a pre-filter: `NONE`,
  `CONTRIBUTOR`, `FIRST_TIMER`, `FIRST_TIME_CONTRIBUTOR` and `MANNEQUIN` are external
  with no lookup. A mention always runs the lookups, because GitHub may report a private
  org member as `CONTRIBUTOR` or `NONE`. A failed lookup counts as not allowlisted and is
  recorded.
- **Check 2 (Claude access policy): is this person eligible now?**
  - It needs three inputs: a linked NVIDIA (Entra) identity, the employing entity, and a
    current location.
  - None of these sources is connected yet, so every person is `not_eligible` with reason
    `not_linked`. That is the honest answer.
- **Outcomes**, one per delivery:

  | Outcome | Meaning |
  |---|---|
  | `admitted` | allowlisted and eligible: may direct Claude work |
  | `not_eligible` | allowlisted but fails Check 2; `reason` names the input (`not_linked`, `entity_*`, `location_stale`, …) |
  | `external_blocked` | an exact mention by an account that fails Check 1; `reason` is `not_allowlisted` or `lookup_failed_*` |
  | `no_start` | a delivered issue, PR or non-mention comment; the tier is still recorded, to show whose work would stop being picked up. Deliveries routing already skips (no mention, the bot's own, filtered actions) are not judged |
  | `bot` | the bot's own logins, or a `Bot` account delivery that starts no work. Routing starts work on any exact mention, so a `Bot` account's mention is judged by Check 1 like a person's |
  | `system_event` | CI, merge or review-thread events, which inherit their chain |

## Turning shadow mode on

The gate is **off by default**. Settings are read from `.env` or the environment on each
delivery:

| Variable | Default | Meaning |
|---|---|---|
| `NANOCLAW_INPUT_GATE` | `off` | `shadow` turns on decide-and-log |
| `NANOCLAW_INPUT_GATE_ROSTER` | `data/input-gate-roster.json` | the maintainer roster |
| `NANOCLAW_INPUT_GATE_ORG` | `shader-slang` | the org whose members count as allowlisted |
| `NANOCLAW_INPUT_GATE_REPOS` | every repo of the org | comma-separated repos whose write permission counts for Check 1 |

The roster is a JSON array keyed on the numeric id, because logins can be renamed. Keep it
out of public repos:

```json
[{ "github_id": 12345678, "login": "maintainer-a" }]
```

Lookups use the host's `gh` login: `repos/{repo}/collaborators/{login}/permission` and a
GraphQL `user.organization` query. The GraphQL query sees private members only when that
login can (an org member, or an App with members read); otherwise they read as
non-members. Results are cached for ten minutes per login, and concurrent lookups for one
login share one call. At most four `gh` runs are in flight. When 64 more wait, a new
lookup fails at once; a failed lookup never allowlists anyone.

## The decision log

`input_gate_decisions` (migration 947) is append-only, with one row per delivery id. A
redelivery or an inbox-drain replay does not add a second row. A delivery forwarded to a
peer instance is judged by the peer. The decision is made after routing returns, and the
inbox has already marked the delivery complete, so a lost row is never replayed. A graceful
shutdown waits up to 2 s for pending decisions and logs how many it left; a crash loses
them.

It stores ids and evidence **kinds** only:
- the actor id, login and type;
- the association, permission, org-member flag and roster hit;
- the eligibility states;
- the outcome and reason;
- `current_outcome`: what routing actually did.

It stores no names, emails or locations. The actor id and login are still pseudonymous
personal data, so retention (Q8) applies to them.

How much would each rule stop?

```bash
pnpm exec tsx scripts/q.ts data/v2.db "SELECT outcome, reason, count(*) FROM input_gate_decisions GROUP BY 1, 2 ORDER BY 3 DESC"
pnpm exec tsx scripts/q.ts data/v2.db "SELECT actor_login, event, count(*) FROM input_gate_decisions WHERE outcome = 'no_start' AND tier = 'allowlisted' GROUP BY 1, 2 ORDER BY 3 DESC"
```

## Not in shadow mode yet

These wait on the Entra app registration, the HR and location source approvals, and open
decisions:

- **Enforcement:** stopping `external_blocked`, `not_eligible` and `no_start` deliveries
  before routing. `no_start` also holds non-mention replies that continue a chain (a
  review reply on a bot-owned PR, an answer on an issue the bot asked about). Stopping
  those would cut the review loop, so enforcement must tell them apart (`event =
  'comment'`, `starts_work = 0`, `current_outcome = 'local'`).
- **Carrying the person down the chain**, with a recheck before every Claude call.
- **The "verify to continue" reply.**
- **The Entra, HR and location adapters for Check 2.**

Open: Q1 (roster contents and regions), Q5 (the recheck choice), Q8 (retention).
