import type { Message, MessageCreateParams, MessageParam, TextBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { RawPair } from "./types";
export interface ProcessedPair {
    id: string;
    timestamp: string;
    request: MessageCreateParams;
    response: Message;
    model: string;
    isStreaming: boolean;
    rawStreamData?: string;
    streamFormat?: "standard" | "bedrock" | null;
}
export interface EnhancedMessageParam extends MessageParam {
    toolResults?: Record<string, ToolResultBlockParam>;
    hide?: boolean;
}
export interface SimpleConversation {
    id: string;
    models: Set<string>;
    system?: string | TextBlockParam[];
    messages: EnhancedMessageParam[];
    response: Message;
    allPairs: ProcessedPair[];
    finalPair: ProcessedPair;
    compacted?: boolean;
    metadata: {
        startTime: string;
        endTime: string;
        totalPairs: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}
/**
 * Shared conversation processing functionality for both frontend and backend
 */
export declare class SharedConversationProcessor {
    /**
     * Process raw JSONL pairs into ProcessedPairs
     */
    processRawPairs(rawPairs: RawPair[]): ProcessedPair[];
    /**
     * Detect if the response is from Bedrock by checking for binary event stream format
     */
    private isBedrockResponse;
    /**
     * Parse Bedrock binary event stream and extract the standard message events
     */
    private parseBedrockStreamingResponse;
    /**
     * Decode base64 string to UTF-8, compatible with both browser and Node.js environments
     */
    private decodeBase64ToUtf8;
    /**
     * Extract JSON chunks from AWS EventStream binary format
     */
    private extractJsonChunksFromEventStream;
    /**
     * Extract Bedrock invocation metrics from the response
     */
    private extractBedrockMetrics;
    /**
     * Parse streaming response from raw SSE data
     */
    private parseStreamingResponse;
    /**
     * Parse standard Anthropic API streaming response
     */
    private parseStandardStreamingResponse;
    /**
     * Build a Message object from a list of streaming events
     */
    private buildMessageFromEvents;
    /**
     * Extract model name from the raw pair
     */
    private extractModel;
    /**
     * Normalize model names from different formats to a consistent display format
     */
    private normalizeModelName;
    /**
     * Group processed pairs into conversations
     */
    mergeConversations(pairs: ProcessedPair[], options?: {
        includeShortConversations?: boolean;
    }): SimpleConversation[];
    /**
     * Process messages to pair tool_use with tool_result
     */
    private processToolResults;
    /**
     * Detect and merge compact conversations
     */
    private detectAndMergeCompactConversations;
    /**
     * Merge a compact conversation with its original counterpart
     */
    private mergeCompactConversation;
    /**
     * Compare two messages to see if they're roughly equal
     */
    private messagesRoughlyEqual;
    /**
     * Normalize message for grouping (removes dynamic content)
     */
    private normalizeMessageForGrouping;
    /**
     * Generate hash string for conversation grouping
     */
    private hashString;
}
//# sourceMappingURL=shared-conversation-processor.d.ts.map