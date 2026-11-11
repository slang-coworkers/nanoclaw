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
  2. its repo permission is `write` or above;
  3. it is a member (public or private) of the org.

  `author_association` is a pre-filter: `NONE`, `CONTRIBUTOR`, `FIRST_TIMER`,
  `FIRST_TIME_CONTRIBUTOR` and `MANNEQUIN` are external with no lookup. A failed lookup
  counts as not allowlisted and is recorded.
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
  | `no_start` | an issue, PR or non-mention comment; the tier is still recorded, to show whose work would stop being picked up |
  | `bot` | a `Bot` account |
  | `system_event` | CI, merge or review-thread events, which inherit their chain |

## Turning shadow mode on

The gate is **off by default**. Settings are read from `.env` or the environment on each
delivery:

| Variable | Default | Meaning |
|---|---|---|
| `NANOCLAW_INPUT_GATE` | `off` | `shadow` turns on decide-and-log |
| `NANOCLAW_INPUT_GATE_ROSTER` | `data/input-gate-roster.json` | the maintainer roster |
| `NANOCLAW_INPUT_GATE_ORG` | `shader-slang` | the org whose members count as allowlisted |

The roster is a JSON array keyed on the numeric id, because logins can be renamed. Keep it
out of public repos:

```json
[{ "github_id": 12345678, "login": "maintainer-a" }]
```

Lookups use the host's `gh` login: `repos/{repo}/collaborators/{login}/permission` and a
GraphQL `user.organization` query. Results are cached for ten minutes per login.

## The decision log

`input_gate_decisions` (migration 947) is append-only, with one row per delivery id. A
redelivery or an inbox-drain replay does not add a second row. A delivery forwarded to a
peer instance is judged by the peer.

It stores ids and evidence **kinds** only:
- the actor id, login and type;
- the association, permission, org-member flag and roster hit;
- the eligibility states;
- the outcome and reason;
- `current_outcome`: what routing actually did.

It stores no names, emails or locations. Retention is an open decision (Q8).

How much would each rule stop?

```bash
pnpm exec tsx scripts/q.ts data/v2.db "SELECT outcome, reason, count(*) FROM input_gate_decisions GROUP BY 1, 2 ORDER BY 3 DESC"
pnpm exec tsx scripts/q.ts data/v2.db "SELECT actor_login, event, count(*) FROM input_gate_decisions WHERE outcome = 'no_start' AND tier = 'allowlisted' GROUP BY 1, 2 ORDER BY 3 DESC"
```

## Not in shadow mode yet

These wait on the Entra app registration, the HR and location source approvals, and open
decisions:

- **Enforcement:** stopping `external_blocked`, `not_eligible` and `no_start` deliveries
  before routing.
- **Carrying the person down the chain**, with a recheck before every Claude call.
- **The "verify to continue" reply.**
- **The Entra, HR and location adapters for Check 2.**

Open: Q1 (roster contents and regions), Q5 (the recheck choice), Q8 (retention).
