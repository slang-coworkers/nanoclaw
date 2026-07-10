# Devin (Reviewer B) agent-browser Chrome fails in reviewer container — no DBus socket

On the slang-reviewer container, `slang-pr-review-runner/scripts/devin-fetch.sh` (Reviewer B) fails at Chrome launch: `Chrome exited early ... without writing DevToolsActivePort`, root cause `Failed to connect to the bus: ... /run/dbus/system_bus_socket: No such file or directory`. Exit code 1 (not 2 auth-wall / 3 timeout). Retrying does not help — it is an environment gap (no DBus / headless Chrome sandbox deps), not transient.

**How to apply:** Treat Reviewer B as `_skipped: agent-browser Chrome cannot launch (infra)_` in the combined report and note it in the `[Review Verdict]` (Devin skipped). Reviewers A (correctness) and C (clarity) still produce valid reports, so the review is not blocked. If Devin coverage is required, the container needs headless-Chrome deps / a DBus session — raise to operator. Don't burn time retrying devin-fetch on this host.
