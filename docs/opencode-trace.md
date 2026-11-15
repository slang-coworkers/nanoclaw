# OpenCode trace

An OpenCode session leaves two files that show what the model saw and did. They are the OpenCode counterpart of claude-trace.

## Where the files are

Both files are in `groups/<folder>/.opencode-trace/` on the host.

| File                        | Content                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `session-<id>.jsonl`        | One line for each model request and reply. It has the method, the path, the headers, the body and the status. |
| `session-<id>.events.jsonl` | One line for each event of the OpenCode event stream. A string longer than 16 KiB is cut.                     |

## How it works

OpenCode sends its model calls to the `baseURL` in its provider options. The runner starts a small proxy on the loopback address and puts that address in the options. The proxy writes the record and forwards the call to the real endpoint. It uses the proxy settings of the container, so the OneCLI gateway and its model rules apply as before.

A follow-up request that the endpoint redirects is followed by the proxy. A client that leaves stops the call to the endpoint.

If the endpoint is `native`, no address is known. The proxy is not used, and only the event file is written.

## What is removed

The proxy replaces the value of a credential before it writes. It does this for the headers `authorization`, `cookie` and any name that ends in `key`, `token`, `secret`, `signature`, `credential` or `password`. It does the same for query parameters with such names. The endpoint still gets the real value.

A request or reply body is not changed. A body larger than 4 MiB is cut in the file, and the record says so. The call itself is not cut.

## Settings

| Setting                                  | Meaning                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `NANOCLAW_OPENCODE_TRACE`                | `off`, `0`, `false` or `no` stops both files. The default is on.       |
| `NANOCLAW_OPENCODE_TRACE_MAX_BODY_BYTES` | The largest body kept in a record. The default is 4 MiB.               |
| `NANOCLAW_OPENCODE_TRACE_DIR`            | Where the files go. The default is `/workspace/agent/.opencode-trace`. |

## Disk use

`scripts/claude-trace-gc.py` removes old files of both trace folders. They share one size limit.

## Limits

- The proxy reads a whole request before it forwards it. A very large request uses that much memory for a short time.
- A trace file holds prompts and tool results. Treat it like the claude-trace files.
