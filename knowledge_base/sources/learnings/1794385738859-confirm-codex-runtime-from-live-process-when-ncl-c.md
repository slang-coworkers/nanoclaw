---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1794385257874-6lemoe
written_at: 2026-11-11T08:28:58.859Z
---

# Confirm Codex runtime from live process when ncl config fields disagree

A group switch can leave `ncl groups config get` reporting `provider=codex` but `agent_provider=claude` and `effective_model=""`. In the live Slang Discord Support container on 2026-11-11, the process command line (`codex app-server -c model=openai/openai/gpt-6-sol -c model_provider=nvinference`) and nonsecret `AGENT_PROVIDER`/`CODEX_MODEL` env fields confirmed the active client/model. Check live process/override rather than claiming the `agent_provider` config field establishes the running model.
