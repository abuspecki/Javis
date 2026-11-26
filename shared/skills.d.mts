export declare const SKILL_IDS: string[];
export declare const PAGE_SKILLS: Set<string>;
export declare function skillError(msg: string, status?: number): Error & { status: number };
export declare function parseJson(text: string): unknown;
export interface SkillSpec {
  system?: string;
  messages: unknown[];
  webSearch?: boolean;
  webFetch?: boolean;
  effort?: 'low' | 'medium' | 'high';
  finish(text: string, sources: { url: string; title: string }[]): {
    text: string;
    sources?: { url: string; title: string }[];
    data?: { kind: 'email'; to: string; subject: string; body: string } | { kind: 'categories'; map: Record<string, string> } | { kind: 'steps'; steps: string[] };
  };
}
export declare function buildSkill(skill: string, input?: Record<string, unknown>, page?: { url: string; title: string; text: string } | null): SkillSpec;
