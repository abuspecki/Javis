import { createContext, useContext } from 'react';
import type { JarvisAction, SkillId } from '../types';

/** Lets any component trigger JARVIS actions (skills, routines, navigation) without prop drilling. */
export interface Commands {
  execute: (actions: JarvisAction[]) => void;
  /** Run a skill from a button: logs a user line so the chat shows what was asked. */
  skill: (skill: SkillId, arg?: string) => void;
  analyzeFile: (file: File) => void;
}

export const CommandsContext = createContext<Commands | null>(null);

export function useCommands() {
  const c = useContext(CommandsContext);
  if (!c) throw new Error('useCommands outside CommandsContext');
  return c;
}
