import {
  formatHistoryLines,
  HISTORY_DEFAULT_LIMIT,
  sessionHistory,
  type HistoryRow,
} from '../../modules/cross-session-context/index.js';
import { registerResource } from '../crud.js';
import { readSessionMessages, type ReadOpts } from '../session-messages.js';
import { formatSessionPin, pinSessionProvider, presentSessionProviders } from '../session-provider-pin.js';

registerResource({
  name: 'session',
  plural: 'sessions',
  table: 'sessions',
  description:
    'Session — the runtime unit. Maps one (agent_group, messaging_group, thread) combination to a container with its own inbound.db and outbound.db. Created automatically by the router when a message arrives.',
  idColumn: 'id',
  scopeField: 'agent_group_id',
  columns: [
    { name: 'id', type: 'string', description: 'UUID.', generated: true },
    { name: 'agent_group_id', type: 'string', description: 'Agent group this session runs.' },
    {
      name: 'messaging_group_id',
      type: 'string',
      description: 'Messaging group this session serves. Null for agent-shared sessions.',
    },
    {
      name: 'thread_id',
      type: 'string',
      description: 'Thread ID. Only set for per-thread session mode.',
    },
    {
      name: 'agent_provider',
      type: 'string',
      description:
        'Provider pin, set with `ncl sessions update --provider`. Null means the session follows its group. ' +
        'list/get also show effective_provider (what the session runs on) and provider_source ' +
        '(session, group, config or default: the tier that decided it).',
    },
    {
      name: 'status',
      type: 'string',
      description: '"active" receives messages. "closed" is archived.',
      enum: ['active', 'closed'],
    },
    {
      name: 'container_status',
      type: 'string',
      description:
        '"running" — container alive and polling. "stopped" — container exited; the sweep will restart it automatically when due messages arrive. "idle" — reserved, currently unused.',
      enum: ['running', 'idle', 'stopped'],
    },
    { name: 'last_active', type: 'string', description: 'Last message or heartbeat. Used for stale detection.' },
    { name: 'created_at', type: 'string', description: 'Auto-set.', generated: true },
  ],
  operations: { list: 'open', get: 'open' },
  presentRows: presentSessionProviders,
  customOperations: {
    update: {
      access: 'approval',
      description:
        "Pin a session to a provider, or clear its pin with --provider ''. The pin outranks the group's " +
        'provider and its container config (session pin → agent_groups.agent_provider → ' +
        'container_configs.provider → default). The pin is checked against the model policy the way spawn ' +
        'checks it, so a pin that would make a weights=open session call a closed model is refused. It ' +
        "applies at the session's next spawn; --restart stops the session's running container now, and the " +
        'next message starts it on the new provider.',
      examples: [
        '# Run one session on Codex, and apply it now:\nncl sessions update --id sess-1751234-abc123 --provider codex --restart',
        "# Back to the group's provider:\nncl sessions update --id sess-1751234-abc123 --provider ''",
      ],
      args: [
        { name: 'id', type: 'string', description: 'Session id (from `ncl sessions list`).', required: true },
        {
          name: 'provider',
          type: 'string',
          description: "Provider to pin (one this host registers, e.g. opencode or claude). '' clears the pin.",
          required: true,
        },
        {
          name: 'restart',
          type: 'boolean',
          description:
            "Stop the session's running container so the next message starts it on the new provider. Default false.",
        },
      ],
      handler: async (args) => pinSessionProvider(args),
      formatHuman: formatSessionPin,
    },
    messages: {
      access: 'open',
      description:
        'Read merged inbound+outbound message transcript for a session (read-only). System-kind rows are filtered by default; pass --include-system to include them.',
      args: [
        { name: 'id', type: 'string', description: 'Session ID.', required: true },
        { name: 'limit', type: 'number', description: 'Max rows to return (default 50, hard cap 500).' },
        { name: 'offset', type: 'number', description: 'Skip the first N rows of the merged result (default 0).' },
        { name: 'since_seq', type: 'number', description: 'Return only rows with seq strictly greater than this.' },
        { name: 'kind', type: 'string', description: 'Filter by message kind (e.g. chat-sdk, chat, system).' },
        {
          name: 'include_system',
          type: 'boolean',
          description: 'Include system-kind rows (cli_request/cli_response noise). Default false.',
        },
        {
          name: 'full',
          type: 'boolean',
          description: 'Return untruncated text. Default false (truncates each text to 300 chars).',
        },
        {
          name: 'reverse',
          type: 'boolean',
          description:
            'Sort newest-first so --limit N returns the most recent N rows (default false = chronological). Use --limit 1 --reverse for the last message.',
        },
      ],
      handler: async (args) => readSessionMessages(args as unknown as ReadOpts),
    },
    history: {
      access: 'open',
      description:
        'Read a session transcript: inbound + outbound messages merged chronologically.\n\n' +
        'Output: pipe-separated lines "timestamp|direction(in/out)|kind|sender|text" (text capped at ' +
        '200 chars), the newest --limit rows in chronological order; `--json` returns the raw rows ' +
        'with ISO timestamps and uncapped text. Use after `ncl sessions list` to ' +
        'catch up fully on another conversation of your agent group (you only ever see your own ' +
        "group's sessions).",
      examples: [`# Catch up on another session of your group:\nncl sessions history sess-1751234-abc123 --limit 100`],
      args: [
        { name: 'id', type: 'string', description: 'Session id (from `ncl sessions list`).', required: true },
        {
          name: 'limit',
          type: 'number',
          description: `Max rows returned, newest first (default ${HISTORY_DEFAULT_LIMIT}).`,
          default: HISTORY_DEFAULT_LIMIT,
        },
      ],
      // Self-scoped in the handler: custom ops bypass the dispatcher's generic
      // scope post-filter, so cross-group callers get "session not found"
      // (the dispatcher's sessions pre-handler check covers this verb too).
      handler: async (args, ctx) => await sessionHistory(args, ctx),
      formatHuman: (data) => formatHistoryLines(data as HistoryRow[]),
    },
  },
});
