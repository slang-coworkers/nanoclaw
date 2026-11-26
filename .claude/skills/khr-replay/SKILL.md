---
name: khr-replay
description: Replay past GitLab bot requests into a khr nanoclaw install for a dry run. Build a read-only corpus of requests (through the install's credential gateway), list what would be injected, then inject jobs over the operator CLI socket. Use when testing or validating the khr port against historical requests; never writes to GitLab.
---

# khr-replay

This operator skill runs on the **install host**, not inside an agent. It needs no GitLab webhook support in core, and it never writes to GitLab.

| Script | Role |
|---|---|
| `scripts/mention.py` | Mention parser: full account name, ignores code, fences and quotes, the request is the text after the mention, `{model=…}` aliases |
| `scripts/gitlab_read.py` | GitLab client that can only read: GET to `/api/v4` on one host, no redirects, no credentials |
| `scripts/corpus.py` | Builds the replay corpus: discovery, author gate, bounded context, snapshot up to the trigger note, and the source harness's outcome |
| `scripts/inject.py` | Stages job inputs and sends one routed line per job over the install's CLI socket |

## Steps

1. **Build the corpus** on the install host. GitLab is reached only through the install's credential gateway, which holds a read-only token (`read_api`, `read_repository`). The output is confidential: write it outside the checkout.
   ```bash
   HTTPS_PROXY=<gateway proxy URL> SSL_CERT_FILE=<gateway CA> \
   python3 -I .claude/skills/khr-replay/scripts/corpus.py --gitlab-url https://<host> --account <bot> \
     --project <id-or-path> --before <ISO-8601 UTC> --allow-user <name> \
     [--reply-marker <prefix>] --out <outside the checkout>/corpus.jsonl
   ```
2. **List what would be injected.** Without `--send`, nothing is written or sent:
   ```bash
   python3 -I .claude/skills/khr-replay/scripts/inject.py --corpus <...>/corpus.jsonl --install-root <install> \
     --channel-type dashboard --platform-id dashboard:khrbotnv
   ```
3. **Inject.** Add `--send`. Use `--only <job>` or `--limit N` to go one job at a time, and `--force` to re-stage a job.
4. **Read the results.** Each job writes `groups/<folder>/jobs/<job>/outcome.json` and `result/` (bundle, patch, `reply.md`). The agent also replies in the dashboard thread.

## How requests enter

The CLI channel's socket (`data/cli.sock`, mode 0600, owner only) accepts `{"text", "to": {channelType, platformId, threadId}}`. That goes through the normal router: the wiring, a per-thread session and a wake. The thread is the issue or MR, so follow-ups share a session in their original order. The dashboard chat is `strict`, so the operator identity `cli:local` must be a **member** of the agent group (`ncl members add --user cli:local --group <id>`).

## Safety

- **Read-only by construction.** The client has no write method. The gateway's GitLab token is read-only, and the gateway also blocks write methods and `git-receive-pack`.
- **The corpus is confidential.** `corpus.py` refuses an output path inside the repository, writes the file with mode 0600, and `*.jsonl` is gitignored here.
- **Generic code.** It is written from the documented rules in `container/spines/khr/PORT.md`, with no project names, accounts or hosts.

## Tests

```bash
python3 -m unittest discover -s .claude/skills/khr-replay/tests -t .claude/skills/khr-replay/tests
```
