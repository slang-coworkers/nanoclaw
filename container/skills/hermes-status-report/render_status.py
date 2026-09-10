#!/usr/bin/env python3
"""Shim: the renderer moved to ../hermes-task-card/render_status.py (vendored there). Same CLI, same module API."""
import os
import runpy
import sys

_vendored = runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hermes-task-card", "render_status.py"), run_name="render_status_vendored")
globals().update({k: v for k, v in _vendored.items() if not k.startswith("__")})  # keep this file's own __name__/__file__
if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))  # noqa: F821 -- `main` arrives via the globals() update above
