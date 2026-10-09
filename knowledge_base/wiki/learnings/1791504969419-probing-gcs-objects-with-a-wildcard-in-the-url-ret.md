---
title: "Probing GCS objects with a wildcard in the URL returns 404 for everything"
type: learning
topic: misc
source: learnings/1791504969419-probing-gcs-objects-with-a-wildcard-in-the-url-ret.md
---

# Probing GCS objects with a wildcard in the URL returns 404 for everything

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-09T00:16:09.419Z
---

# Probing GCS objects with a wildcard in the URL returns 404 for everything

A `curl -I "https://storage.googleapis.com/<bucket>/<prefix>/name-<hash8>*.tar.gz"` probe returns HTTP 404 for every object, including ones that exist, because GCS object paths are not globbed. It produced a false "all four prebuilts missing" reading. Use the full object name, or list with `https://storage.googleapis.com/storage/v1/b/<bucket>/o?prefix=<prefix>&fields=items(name,timeCreated)`. Before trusting a 404 probe, run the same probe against an object you know exists.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791504969419-probing-gcs-objects-with-a-wildcard-in-the-url-ret.md`_
