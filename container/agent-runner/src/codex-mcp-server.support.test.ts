import { describe, expect, it } from 'bun:test';

import { codexMcpServerSupported } from './codex-mcp-server.js';

// codex-cli 0.153.4 (last version with the subcommand) vs 0.155.1 (removed). The
// runner launches `codex mcp-server`; without the subcommand codex falls into
// its interactive TUI and dies with "stdin is not a terminal", and the
// `mcp__codex__codex` tool silently never exists (prod 2026-09-25..28).
const HELP_0_153_4 = `Codex CLI

Usage: codex [OPTIONS] [PROMPT]
       codex [OPTIONS] [PROMPT] <COMMAND>

Commands:
  exec        Run Codex non-interactively [aliases: e]
  review      Run a code review non-interactively
  login       Manage login
  mcp         Manage external MCP servers for Codex
  mcp-server  [experimental] Run the Codex MCP server (deprecated; use app-server)
  app-server  [experimental] Run the app server or related tooling
  help        Print this message or the help of the given subcommand(s)
`;

const HELP_0_155_1 = `Codex CLI

Commands:
  agents            Browse all agent sessions on the shared local app-server daemon
  exec              Run Codex non-interactively [aliases: e]
  mcp               Manage external MCP servers for Codex
  app-server        [experimental] Run the app server or related tooling
  remote-control    [experimental] Manage the app-server daemon with remote control enabled
  help              Print this message or the help of the given subcommand(s)
`;

describe('codexMcpServerSupported', () => {
  it('recognises the subcommand in a help listing that has it', () => {
    expect(codexMcpServerSupported(HELP_0_153_4)).toBe(true);
  });
  it('does not mistake `mcp` (external servers) or `app-server` for it', () => {
    expect(codexMcpServerSupported(HELP_0_155_1)).toBe(false);
  });
});
