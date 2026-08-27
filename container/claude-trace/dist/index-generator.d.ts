export interface ConversationSummary {
    id: string;
    title: string;
    summary: string;
    startTime: string;
    messageCount: number;
    models: string[];
}
export interface LogSummary {
    logFile: string;
    htmlFile: string;
    generated: string;
    conversations: ConversationSummary[];
}
export declare class IndexGenerator {
    private traceDir;
    private htmlGenerator;
    private conversationProcessor;
    constructor();
    generateIndex(): Promise<void>;
    private findLogFiles;
    private processLogFile;
    private extractConversations;
    private summarizeConversation;
    private conversationToText;
    private callClaude;
    private generateIndexHTML;
}
//# sourceMappingURL=index-generator.d.ts.map