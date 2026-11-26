# khr port log

Porting a mention-driven GitLab agent harness for Khronos spec and tooling work onto nanoclaw. This file holds only generic design. Install-specific values (projects, accounts, hosts, ports) live in the install's local configuration, never in this repo.

## Decisions

- **Isolation.** A separate nanoclaw install with its own credential gateway, approvers, transcripts, dashboard and data directory. It may share a machine with another install.
- **Provider.** Codex only, mapped 1:1 to the source harness's `codex exec`. The install's gateway holds no Anthropic secret.
- **Model endpoint.** The Codex default `inference-api.nvidia.com`.
- **Ingestion.** Shaped like the GitHub webhook path (write-ahead inbox, direct session delivery, tokenless host), not a channel adapter.
- **Credentials.** Only the gateway holds the GitLab token. The host holds none.
- **Writes.** Validation runs with zero writes to GitLab or anywhere else:
  - a read-only token (`read_api`, `read_repository`);
  - gateway block rules on write methods and `git-receive-pack`;
  - no publish path (results go to a local sink);
  - egress lockdown on its own network.
- **Internet.** None for agents; no DeepWiki or web tools. The host does the pinned dependency prefetch.
- **GPU.** CPU parity first, then an opt-in GPU validation profile.

## Bounded-context rules, kept exactly

| Rule | Value |
|---|---|
| Request | the text after the mention, plus the lines after it; text before the mention is context |
| Mention match | full account name, word boundary before it; followed by whitespace, `,`, `:` or end of line; ignored inside inline code, fenced code and `>` quotes |
| Accepted sources | issue notes and MR discussion notes only; never issue descriptions or system notes |
| Authorization | the re-fetched source note's numeric author id; never the to-do actor or a username; bots and the bot account itself are always rejected |
| Reference context cap | 20,000 characters |
| Labels | at most 50 |
| Inline MR note | file and line position plus one matching diff hunk of at most 4,000 characters |
| Discussion snapshot | all threads and notes with id ≤ the trigger note, full bodies, labelled untrusted, uncapped, in a file |
| Immutability | an edited or deleted command is superseded at execution time, never re-run; each new comment is a new job |
| History | no replay of notes before the activation boundary in live mode; replay mode instead runs only a selected window |
| Status line | at most 64 characters, updated at most once a minute |
| Model override | an optional leading `{model=…}` block from a fixed alias set; an invalid block rejects the job with a reply |

## Ownership constraint

`src/**`, `container/agent-runner/**`, `scripts/**`, `.github/**` and `docs/**` belong to nv-main. So:

- **Dry phase: no nv-main change.** Requests are injected through an existing generic inbound route (the operator chat route) by a khr-owned replay tool. That tool applies the mention, authorization and bounded-context rules above before injecting. The agent fetches GitLab context through the gateway.
- **Live phase: one generic nv-main pull request.** GitLab webhook support next to the GitHub path: secret check, `webhook_inbox` trust `gitlab`, note-event parsing, mention gate. Nothing Khronos-specific. It needs a separate owner decision.
- A path-guard list for this branch (`.github/nv-path-guard/nv-khr.txt`) is also nv-main-owned. It is proposed as part of that same nv-main pull request.

## Parity checklist (dry run, zero writes)

- [ ] Intake:
  - [ ] mention mid-line and with `,`/`:` after it;
  - [ ] ignored in code, fences and quotes;
  - [ ] empty command rejected;
  - [ ] valid and invalid `{model=…}`;
  - [ ] issue description ignored;
  - [ ] system notes, bots and self ignored;
  - [ ] numeric-id authorization;
  - [ ] duplicate delivery queued once;
  - [ ] edited command superseded.
- [ ] Context:
  - [ ] 20k cap, 50 labels;
  - [ ] inline position + 4k hunk;
  - [ ] snapshot ≤ trigger note;
  - [ ] untrusted labelling.
- [ ] Coordination:
  - [ ] issue change set across repositories;
  - [ ] issue follow-up reuses it;
  - [ ] MR follow-up continues only an owned MR;
  - [ ] human-owned, closed or retargeted MR fails explicitly;
  - [ ] FIFO per lane;
  - [ ] parallel lanes.
- [ ] Execution:
  - [ ] multi-repo worktrees;
  - [ ] trusted `AGENTS.md` from the base;
  - [ ] commit identity;
  - [ ] clean tree;
  - [ ] ancestry;
  - [ ] structured report;
  - [ ] timeout;
  - [ ] per-command model.
- [ ] Validation:
  - [ ] every repository baseline passes in the image;
  - [ ] evidence per check;
  - [ ] six-value result vocabulary;
  - [ ] build lease;
  - [ ] offline dependencies;
  - [ ] pinned-header workaround;
  - [ ] link check.
- [ ] Publication, simulated into the local sink:
  - [ ] topic-branch naming;
  - [ ] fast-forward only;
  - [ ] Draft title normalization;
  - [ ] partial success;
  - [ ] reply text;
  - [ ] status phases;
  - [ ] marker dedup.
- [ ] Operations:
  - [ ] restart mid-job;
  - [ ] retention;
  - [ ] cost cap;
  - [ ] **zero non-GET GitLab requests in the gateway audit**.
- [ ] Comparison with the source harness, per replayed job:
  - [ ] same repositories changed;
  - [ ] same test outcomes;
  - [ ] diff similarity;
  - [ ] reply quality;
  - [ ] cost and time.

## Phases

- P0: scaffold (this commit) and the install plan.
- P1: replay producer and ingestion, through the operator CLI socket ([`khr/replay/`](../../../khr/replay/README.md)). Built and unit-tested; the live run waits for the install (P5) and job preparation (P3).
- P2: spine and workflow detail, Codex settings.
- P3: job preparation and the results sink.
- P4: image and validation.
- P5: install and dry run.
- P6: go-live, as a separate decision.
