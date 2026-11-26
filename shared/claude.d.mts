export declare const DEFAULT_MODEL: string;
export interface ClaudeCompleteOptions {
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  system?: string;
  messages: unknown[];
  webSearch?: boolean;
  webFetch?: boolean;
  signal?: AbortSignal;
}
export declare function claudeComplete(client: unknown, opts: ClaudeCompleteOptions): Promise<{ text: string; sources: { url: string; title: string }[] }>;
