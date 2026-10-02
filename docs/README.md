# NanoClaw Documentation

The official documentation is at **[docs.nanoclaw.dev](https://docs.nanoclaw.dev)**.

The files in this directory are original design documents and developer references. For the most current and accurate information, use the documentation site.

| This directory | Documentation site |
|---|---|
| [SECURITY.md](SECURITY.md) | [Security model](https://docs.nanoclaw.dev/concepts/security) |
| [REQUIREMENTS.md](REQUIREMENTS.md) | [Introduction](https://docs.nanoclaw.dev/introduction) |

## Developer references

- [cost-cap-model.md](cost-cap-model.md): the cost cap model, a per-group 7-day p90 cap that catches a session spending abnormally for its role, escalates it to a human, and hard-stops non-critical ones.
- [scheduled-tasks.md](scheduled-tasks.md): scheduled tasks run an agent prompt at a future time or on a recurring cron schedule, each in its own system session.
- [thread-vs-session.md](thread-vs-session.md): thread vs session, the two orthogonal keys (the shared topic `thread_id` vs one coworker's private per-topic session).
