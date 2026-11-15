# Session privilege

Every session is either **open** or **closed**, and keeps that privilege for its whole life.

- An **open** session runs open-weights models only.
- A **closed** session may run closed models (Claude, GPT). Only a person on the approved list reaches one.

A session never mixes the two. A message goes to the session of its sender's privilege on its thread, and routing creates that session when it does not exist. One GitHub issue can so hold an open and a closed session of the same coworker side by side. This follows the closed-model policy in [input-gate.md](input-gate.md) and the open-weights default in [model-policy.md](model-policy.md).

## Turning it on

| Setting                           | Meaning                                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NANOCLAW_SESSION_PRIVILEGE`      | `off` (default) or `enforce`. With `off`, every message asks for an open session, every session is open, and spawn ignores the privilege, so the install behaves as before. |
| `NANOCLAW_CLOSED_MODEL_CHECK2`    | `off` (default), `require` or `only`. Whether Check 2 also decides who gets a closed session. See "Check 2 on the closed path".                                             |
| `NANOCLAW_INPUT_GATE_ELIGIBILITY` | Path to the evidence file of the input gate. Default `data/input-gate-eligibility.json`.                                                                                    |
| `NANOCLAW_CLOSED_MODEL_APPROVED`  | Path to the approved list. Default `data/closed-model-approved.json`.                                                                                                       |

The approved list is a JSON array of namespaced user ids: `slack:U012AB3CD`, `discord:80351110224678912`, and `github:<numeric id>` for a GitHub account. A GitHub entry uses the numeric id, because a login can be renamed or reused. The operator keeps this file. It stands in for the closed-model eligibility check (Check 2 of the input gate) until that check has its identity sources. A missing or unreadable file is an empty list, so nobody gets a closed session by accident.

Before `enforce`, move every group to open weights (`scripts/open-weights-plan.ts`). An open session of a group that still names a closed model, or that runs the Claude provider, does not start.

## Who asks for which privilege

| Path                                                                       | Privilege                                                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A chat message (Slack, Discord, dashboard)                                 | `closed` when the sender is on the list, otherwise `open`.                                      |
| A GitHub issue, a PR that becomes ready, a review, a mention               | The account in `payload.sender`: `closed` when its numeric id is on the list, otherwise `open`. |
| A GitHub event from a bot or app (CI, review bots, this install's own bot) | None. The event follows the session that already exists.                                        |
| A GitHub state event (merged, closed, CI failed, review thread resolved)   | None, for the same reason. A merge does not wake a second session.                              |
| A delegation from one coworker to another                                  | The privilege of the sending session.                                                           |
| A scheduled task, a system session                                         | `open`.                                                                                         |

The privilege belongs to the account that triggered the event, not to the author of the words it carries. Consider an outsider who opens an issue, and an approved maintainer who then adds the `bot-ok` label. The label event hands the issue to the bot, and the maintainer is the sender, so the issue goes to a closed session. The maintainer has chosen to direct the coworker. Closed-model access follows who directs the model, as in the input gate, and the newcomer rules decide whose issues the bot may read at all.

When a PR is owned by a session of one privilege and a comment arrives from a sender of the other, the comment goes to a session of the sender's privilege on the same thread, created if needed. It never reaches the owner session.

## Check 2 on the closed path

`NANOCLAW_CLOSED_MODEL_CHECK2` lets the input gate's Check 2 decide who gets a closed session. Check 2 needs a verified identity, a verified employing entity, and a location that was checked within 24 hours. The operator's evidence file holds this data until the real sources exist (see `docs/input-gate.md`).

- `off`: the approved list decides alone, and the evidence file is not read.
- `require`: a person gets a closed session only when they are on the approved list and Check 2 finds them eligible.
- `only`: Check 2 decides alone, and the approved list is not read.

A value that the install does not know counts as `require`.

The evidence file names a person by their namespaced id, for example `github:1234` or `slack:U012AB3CD`. A person who is not in the file, or whose id has an odd shape, is not eligible. Consider an approved maintainer whose location was last checked 30 hours ago. Their next message asks for an open session, and the closed session no longer receives their messages. The closed session does not stop, because a session keeps its privilege for its whole life. When the operator records a fresh location, the next message of the maintainer asks for a closed session again. The decision reads the file at each message, so an edit takes effect at once.

## What a session may write into

An **open** session never writes into a **closed** one: a person who is not approved would direct a closed model through the open session. A closed session may write into an open one, because the open session only reads the closed model's output, as the public thread already does. A reply or a `target_session_id` that names a closed session from an open one is refused, and the sender is told. A fresh delegation is not refused, because it gets a session of the sender's privilege.

The same rule holds for cross-session context. The echo fan-out copies each message into the hot sibling sessions of the same conversation, and backfill seeds a waking session from its siblings. Both skip a closed target when the words come from an open session, so an unapproved person's message never lands in a closed session as ambient context.

## The OneCLI agent

With `enforce`, a closed session uses its own OneCLI agent, `<group id>-closed`, and an open session keeps the group's agent. The container cannot change its agent identity, so the gateway can hold the two to different rules. Spawn creates the closed agent on first use and, on every closed spawn, gives it the secrets the group's agent holds, so closed sessions keep the tool secrets the operator granted to the group. On a gateway built on OneCLI 1.43 or older (such as onecli-cost), the closed agent gets exactly the secret list and mode of the group's agent, so a secret the operator revokes from the group is also revoked for closed sessions. On a newer gateway, spawn only adds grants. An approval request from the closed agent routes to the group.

This split is the base of the credential boundary. Both agents hold the same inference key, so the model rule below is what stops an open container from calling a closed model.

## The model rule

With `enforce`, spawn makes sure the gateway holds three block rules for each open agent. The first is `open-models-only (<group id>)`. It applies to every POST, PUT and PATCH to the inference host. The inference host is the host of `ANTHROPIC_BASE_URL`, `OPENCODE_BASE_URL` and `CODEX_BASE_URL`. The gateway reads the `model` field of the JSON body. It refuses the request unless the model matches an open-weights family from `NANOCLAW_OPEN_WEIGHTS_PREFIXES` or the built-in list. A prefix in that setting must not contain `*`.

The rule fails closed. A body with no model, a body that is not JSON, and a body over 32 MiB are all refused. A body of unknown length, such as a chunked body, is refused too, so a client must send a `Content-Length`. A body that repeats the key `model`, in any case, is refused, because another JSON parser could read the other copy.

The second rule is `open-models-only (<group id>) routes`. It refuses the routes `/model/*` and `/llm/*` for every method, where the URL picks the model and a decoy `model` in the body could name an open one. The third rule is `open-models-only (<group id>) query`. It refuses a request of any method whose `model` query parameter names no open model. A WebSocket handshake is a GET that carries its model there. A request with no `model` parameter is not affected. The closed agent has none of these rules.

The gateway matches each rule against every view of the path that the inference server might route: the path as sent, decoded once, and decoded until it stops changing. Each view has its empty and `.` segments dropped and its `..` resolved. A rule holds when any view meets it. So `/%6Dodel/info`, `//model/info` and `/model/%252e%252e/invoke` all meet the rule for `/model/*`. The server routes the first two to `/model/info`, and we do not know how many times it decodes.

The rule needs OneCLI `onecli-cost:v5` or later. The patch and build steps are in `scripts/onecli-cost-capture/README.md`. An older gateway refuses the rule, and the spawn fails with a message that names the gateway version. A gateway without the policy API also fails the spawn. An open session never starts without the boundary.

Spawn writes the rules through the policy API, one agent at a time for the whole project. It reads the live rules back after the publish, and the spawn fails if they differ. It puts the open-models-only rules before every other custom rule, because the gateway applies the first rule that matches. A publish makes the whole project draft live, so a draft that someone left in the OneCLI console goes live with it.

The gateway applies a published rule to the requests of a container that is already running. A drill on lego measured 70 ms from the publish to the first refused request, and 60 ms to the first allowed request after a removal. Spawn checks the rules again every five minutes at most, and repairs them when an operator edits or deletes them. The check runs at spawn, so a rule that an operator deletes stays missing until the next spawn. Anyone who can manage the OneCLI policies can also remove the rule, so the rule holds against the container and not against the operator.

With a body rule loaded, the gateway reads every POST, PUT and PATCH body up to 32 MiB into memory before it forwards the request. This holds for all agents of the project, because the rule list is shared.

## Turning it off again

With `NANOCLAW_SESSION_PRIVILEGE` unset, nothing changes on an install that never enforced it. On an install that did, the closed sessions stay in the database with their privilege. New messages go to open sessions, and an open session still cannot write into a closed one, so a closed session stays closed until it ends.

## What spawn does

With `enforce`, spawn resolves the group's models for the session's privilege (`rowForPrivilege`):

- an open session runs under `weights=open`, so spawn refuses it on any closed model, as for a `weights=open` group today;
- a closed session runs without the rule, so the group's own models and the install defaults apply. A group set to `weights=open` for its open sessions can still run closed models for approved people.

## The management API

The model rule holds only when a session cannot reach the OneCLI management API. The API lists every agent with its access token, and it writes the rules. A session that reaches it can take the token of a closed agent, or delete the rules.

Bind the API to the loopback address of the host, and point `ONECLI_URL` at that address, for example `http://127.0.0.1:10256`. Do not publish it on `0.0.0.0` or on the docker bridge. The proxy port stays reachable, because sessions need it. The script `scripts/check-onecli-api-unreachable.sh` starts a throwaway container on the session network and tries to reach the API from there. It must print `UNREACHABLE` before you turn `enforce` on. Another service on the bridge, such as a database or a web server, is a similar risk, and `CHECK_PORTS` lets the script test it. The script `scripts/onecli-gateway-swap.sh` does the change: `swap <image>` backs up the compose file and `.env`, puts the image live, binds the API to loopback, and restarts the services. `rollback <stamp>` undoes it.

## Not covered yet

- **Traffic the model rule does not see.** The rules cover the hosts of the three base URLs. A request that names its model where no rule reads it is outside them, and so is another host that accepts the same inference key. A container that calls another host with its own key is outside the rules too. A WebSocket frame after the handshake is not read.
- **Real Check 2 sources.** The location check on the closed path reads the operator's evidence file. The Entra, HR and location adapters replace the file when their approvals land.
- **A parked PR that is released** (`releaseParkedReviewable`) and the learning delivery to approver sessions look up sessions without a privilege.
- **`mention-sticky` engagement** counts a session of either privilege as "active", so a thread an approved person started keeps listening for everyone.
