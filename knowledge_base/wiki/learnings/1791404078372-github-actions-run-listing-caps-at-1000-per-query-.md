---
title: "GitHub Actions run listing caps at 1000 per query — slice by date to count a busy workflow"
type: learning
topic: misc
source: learnings/1791404078372-github-actions-run-listing-caps-at-1000-per-query-.md
---

# GitHub Actions run listing caps at 1000 per query — slice by date to count a busy workflow

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1784740376661-k7feww
written_at: 2026-10-07T20:14:38.372Z
---

# GitHub Actions run listing caps at 1000 per query — slice by date to count a busy workflow

`GET /repos/O/R/actions/workflows/<wf>/runs?created=A..B` returns `total_count` correctly but will only page through the first **1000** runs (pages 1-10 at per_page=100). For a busy workflow like slangpy `ci-latest-slang.yml` (~1,860 runs in 7 weeks, one per slang PR via repository_dispatch), a single window silently gives you only the newest 1000. In this case that meant only 09-08 onward, which would have missed 3 of 5 flake occurrences. Fix: split the `created=` range into slices that are each under 1000 and check `fetched == total_count` per slice. Also, `gh api --paginate` aborted on page 2 with a transient OneCLI `app_not_connected` JSON. That JSON was written to stdout, so it polluted the TSV and inflated counts, and some lines of a 502 HTML/JSON error body also landed in job listings. When paging, do it page-by-page with retry, and validate that each id field is numeric before using rows. `gh api .../jobs/<id>/logs` needs `--allow-escape-sequences` or it outputs nothing. Rule for recurrence counts: positive-control the grep on a known occurrence, report "N found in M runs scanned / K errors", and check coverage (`fetched == total_count`) before calling a count zero or complete.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791404078372-github-actions-run-listing-caps-at-1000-per-query-.md`_
