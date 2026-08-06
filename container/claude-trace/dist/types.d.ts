export interface RawPair {
    request: {
        timestamp: number;
        method: string;
        url: string;
        headers: Record<string, string>;
        body: any;
    };
    response: {
        timestamp: number;
        status_code: number;
        headers: Record<string, string>;
        body?: any;
        body_raw?: string;
        events?: SSEEvent[];
    } | null;
    logged_at: string;
    note?: string;
}
export interface SSEEvent {
    event: string;
    data: any;
    timestamp: string;
}
export interface ClaudeData {
    rawPairs: RawPair[];
    timestamp?: string;
    metadata?: Record<string, any>;
}
export interface HTMLGenerationData {
    rawPairs: RawPair[];
    timestamp: string;
    title?: string;
    includeAllRequests?: boolean;
}
export interface TemplateReplacements {
    __CLAUDE_LOGGER_BUNDLE_REPLACEMENT_UNIQUE_9487__: string;
    __CLAUDE_LOGGER_DATA_REPLACEMENT_UNIQUE_9487__: string;
    __CLAUDE_LOGGER_TITLE_REPLACEMENT_UNIQUE_9487__: string;
}
export interface ProcessedConversation {
    id: string;
    model: string;
    messages: any[];
    system?: any;
    latestResponse?: string;
    pairs: RawPair[];
    metadata: {
        startTime: string;
        endTime: string;
        totalPairs: number;
        totalTokens?: number;
        tokenUsage?: {
            input: number;
            output: number;
        };
    };
    rawPairs: RawPair[];
}
export interface ProcessedMessage {
    role: "user" | "assistant" | "system";
    content: string;
    thinking?: string;
    toolCalls?: ToolCall[];
    metadata?: {
        timestamp: string;
        model?: string;
    };
}
export interface ToolCall {
    id: string;
    type: string;
    name: string;
    input: any;
    result?: any;
    error?: string;
}
export interface BedrockBinaryEvent {
    bytes: string;
    p?: string;
}
export interface BedrockInvocationMetrics {
    inputTokenCount: number;
    outputTokenCount: number;
    invocationLatency: number;
    firstByteLatency: number;
    cacheReadInputTokenCount?: number;
    cacheWriteInputTokenCount?: number;
}
declare global {
    interface Window {
        claudeData: ClaudeData;
    }
}
//# sourceMappingURL=types.d.ts.map