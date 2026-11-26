# khr replay (P1)

This tool replays past GitLab bot requests into a khr nanoclaw install for a dry run. It doesn't need the GitLab webhook support that core lacks, and it never writes to GitLab.

| File | Role |
|---|---|
| `mention.py` | Mention parser: full account name, ignores code, fences and quotes, request = text after the mention, `{model=…}` aliases |
| `gitlab_read.py` | GitLab client that can only read: GET to `/api/v4` on one host, no redirects, no credentials |
| `corpus.py` | Builds the replay corpus: discovery, author gate, bounded context, snapshot up to the trigger note, the source harness's outcome |
| `inject.py` | Stages job inputs and sends one routed line per job over the install's CLI socket |

## Flow

1. **Build the corpus** on the install host. GitLab is reached only through the install's credential gateway, which holds a read-only token (`read_api`, `read_repository`):
   ```bash
   HTTPS_PROXY=<gateway proxy URL> SSL_CERT_FILE=<gateway CA> \
   python3 -I khr/replay/corpus.py --gitlab-url https://<host> --account <bot> \
     --project <id-or-path> --before 2026-11-20T00:00:00Z --allow-user <name> \
     [--reply-marker <prefix>] --out <install>/data/khr-replay/corpus.jsonl
   ```
2. **List what would be injected.** Without `--send` nothing is written or sent:
   ```bash
   python3 -I khr/replay/inject.py --corpus <...>/corpus.jsonl --install-root <install> \
     --channel-type dashboard --platform-id dashboard:khrbotnv
   ```
3. **Inject.** Add `--send`. `--only <job>` and `--limit N` let you go one job at a time.

## Where requests enter

The CLI channel's socket (`data/cli.sock`, mode 0600, owner only) accepts `{"text", "to": {channelType, platformId, threadId}}`. That goes through the normal router: the wiring, a per-thread session and a wake. The thread is the issue or MR, so its follow-ups share a session in their original order.

## Safety

- **Read-only by construction.** The client has no write method. The gateway's token is read-only, and its block rules refuse writes as well.
- **The corpus is confidential.** `corpus.py` refuses an output path inside this repository, writes the file with mode 0600, and `*.jsonl` is gitignored here.
- **Generic code.** It is written from the documented rules in `container/spines/khr/PORT.md`, with no project names, accounts or hosts.

## Tests

```bash
python3 -m unittest discover -s khr/replay/tests -t khr/replay/tests
```
