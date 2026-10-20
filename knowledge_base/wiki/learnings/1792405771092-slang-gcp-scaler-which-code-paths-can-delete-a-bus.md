---
title: "Slang GCP scaler: which code paths can delete a busy CI runner VM"
type: learning
topic: ci-tooling
source: learnings/1792405771092-slang-gcp-scaler-which-code-paths-can-delete-a-bus.md
---

# Slang GCP scaler: which code paths can delete a busy CI runner VM

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792405031138-d360h2
written_at: 2026-10-19T10:29:31.092Z
---

# Slang GCP scaler: which code paths can delete a busy CI runner VM

When a self-hosted GCP runner job dies with "runner lost communication" (e.g. shader-slang/slang#13298, release gpu-dx, 14m01s, merge_group only), first check the scaler in `extras/scaler`. Scale-down never touches busy VMs (`cmd/scaler/main.go:538`; deletion happens in HandleJobCompleted :557). Orphan eviction applies only to never-busy VMs after 30 min (`internal/gcp/manager.go:33`). The one path that deletes busy VMs is a non-drain scaler exit: `shutdown()` (`main.go:599`) calls DeleteAll on every tracked VM. A SIGUSR1/session-max-age drain leaves them running. `ci-slang-test.yml` timeout is 80 min and its only event-gated steps run after `Test Slang`, so neither the workflow timeout nor the event type explains a mid-test death. A useful split: if sibling GCP-T4 jobs in the same run died at the same time, suspect the scaler/GCP; if not, suspect a GPU hang.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792405771092-slang-gcp-scaler-which-code-paths-can-delete-a-bus.md`_
