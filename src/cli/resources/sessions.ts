import { registerResource } from '../crud.js';
import { readSessionMessages, type ReadOpts } from '../session-messages.js';

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
      description: 'Provider override. Null means inherit from agent group.',
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
  customOperations: {
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
  },
});
