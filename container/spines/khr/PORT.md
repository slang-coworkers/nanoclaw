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

- **Dry phase: no nv-main change.** Requests are injected through an existing generic inbound route (the operator CLI socket) by a khr-owned replay skill (`.claude/skills/khr-replay/`). That tool applies the mention, authorization and bounded-context rules above before injecting. The agent fetches GitLab context through the gateway.
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
- P1: replay producer and ingestion, through the operator CLI socket ([`.claude/skills/khr-replay/`](../../../.claude/skills/khr-replay/SKILL.md), an operator skill: SKILL.md + scripts/). Built and unit-tested; the live run waits for the install (P5) and job preparation (P3).
- P2: spine and workflow detail, Codex settings.
- P3: job preparation and the results sink (`khr-job-prep`), the first check wrapper (`khr-validation/scripts/run_check.py`), and instructions ported to lego pieces (see the source map).
- P4: image and validation.
- P5: install and dry run.
- P6: go-live, as a separate decision.

## Source map: source harness → lego pieces

Behaviour follows the source harness's task-agent instructions (its job-root `AGENTS.md` and its prompt's required constraints). The rules are re-expressed, not copied; this table is the traceability check.

| Source harness instruction | khr piece |
|---|---|
| "Make a full, complete, clean change; respect scope; never substitute a proposal or partial work" | `identity/spec-engineer.md` |
| Confidentiality; never access, print or commit credentials | `invariants/confidentiality.md` |
| USER COMMAND is the authority; untrusted source, snapshots and topic-branch instructions; trusted-instructions snapshot | `invariants/untrusted-context.md` |
| Only the listed worktrees; no primary checkouts, other branches, reflogs, `--all` history or other jobs | `invariants/workspace-scope.md` |
| Preset identity, no amend/merge/rebase, commit everything, exact `repositories[]` | `invariants/commits.md` |
| No push, MR or comment; the controller publishes | `invariants/no-publish.md` |
| GitHub inaccessible, controller-only fetch, one deterministic install, `$…_DEPENDENCY_ROOT`, no sudo, `UPDATE_DEPS` off, declaration-changed | `invariants/offline.md` |
| CPU-only policy, VVL Test ICD allowed, CTS compile only, six-value result vocabulary | `invariants/cpu-only.md` |
| Final check, disclosure, when `blockedReason` applies | `invariants/completeness.md` |
| Issue change sets, Draft MR continuation, missing earlier work, advanced source tip | `context/continuation.md` |
| Bounded context and snapshots | `context/bounded-context.md` |
| Job files and tools | `context/layout.md` |
| Read CONTRIBUTING/BUILD/style first; comparable changes; VVL and CTS reading lists | skill `khr-repo-tools` |
| Vulkan spec and extension completeness, VU self-containment, temporary VUIDs, contact/author, contributor heuristic, SPIR-V and GLSL rules | skill `khr-spec-authoring` |
| run-check usage, stable names, checkId, discover-then-validate, build lease, long-running builds, prepared deps (Docs npm, VVL, CTS), profiles, pinned-header workaround, gtest/ctest and Test ICD rules | skill `khr-validation` |
| Progress helper (≤64 chars), structured result schema, controller validation (clean tree, ancestry, identity, evidence reconciliation) | skill `khr-job-prep` + `report.schema.json` |
| Job lifecycle (prepare → run → validate → publish/reply) | workflow `khr-implement` (publish replaced by the local results sink) |

Lego-specific:
- `context/install-scope.md` overrides the base context for this install: GitLab is the only forge, the resumable record is local, there is no coworker chain, and `/codex-critique` is an optional second opinion. The runner seeds the `codex` MCP child for every session, so nothing needs configuring.
- `base-common` still supplies the nanoclaw basics: messaging, memory (OKF), recall, ncl, report formats.

Still to come (P4): the offline dependency adapters (`vvl_offline_deps.py`, `cts_offline_deps.py`), `prepare_profile.py` and `dependency-inventory.json` preparation, the full toolchain image, and the GPU validation profile.
