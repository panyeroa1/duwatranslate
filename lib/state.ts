/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  // FIX: Add FunctionDeclaration and FunctionResponseScheduling to imports.
  FunctionDeclaration,
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

const generateSystemPrompt = (lang1: string, lang2: string, topic: string) => {
  const topicInstruction = topic ? `The conversation is about: ${topic}. Please use appropriate terminology and context.` : '';
  return `You are an expert language translator. Your task is to provide EXTREMELY CONCISE translations.
    
**INSTRUCTIONS:**
1.  **LISTEN** to the input.
2.  **TRANSLATE** the meaning using the FEWEST WORDS POSSIBLE (aim for 3-5 words max if possible).
3.  **OUTPUT** format: "[LANG:LanguageName] TranslatedText"
    
**RULES:**
-   **NO** explanations.
-   **NO** filler words.
-   **NO** repetition of the source text.
-   **STRICTLY** output the translation only.
-   **EMOTIONAL NUANCE:** Mimic the speaker's tone and intensity (urgency, joy, etc.).
-   **VOICE PERSONA:** Staff=${lang2} ("Orus"), Guest=${lang1} ("Charon").

Example:
Input: "Where can I find the nearest bathroom, please?"
Output: "[LANG:${lang2}] Toilet location?" (or concise equivalent)

${topicInstruction}
`;
};


/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voiceStaff: string; // Staff voice
  voiceGuest: string; // Guest voice
  // voice: string; // Deprecated single voice accessor if needed, or we just map it to staff
  language1: string;
  language2: string;
  topic: string;
  // Supabase / Session State
  user: { id: string } | null;
  sessionId: string | null;

  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoiceStaff: (voice: string) => void;
  setVoiceGuest: (voice: string) => void;
  setLanguage1: (language: string) => void;
  setLanguage2: (language: string) => void;
  setTopic: (topic: string) => void;
  setUser: (user: { id: string } | null) => void;
  setSessionId: (id: string | null) => void;
}>((set, get) => ({
  systemPrompt: generateSystemPrompt('Dutch', 'English', ''),
  model: DEFAULT_LIVE_API_MODEL,
  voiceStaff: 'Orus',
  voiceGuest: 'Charon',
  language1: 'Dutch',
  language2: 'English',
  topic: '',
  user: null,
  sessionId: null,

  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
  setModel: (model) => set({ model }),
  setVoiceStaff: (voiceStaff) => set({ voiceStaff }),
  setVoiceGuest: (voiceGuest) => set({ voiceGuest }),
  setLanguage1: (language1) => {
    set({ language1, systemPrompt: generateSystemPrompt(language1, get().language2, get().topic) });
  },
  setLanguage2: (language2) => {
    set({ language2, systemPrompt: generateSystemPrompt(get().language1, language2, get().topic) });
  },
  setTopic: (topic) => {
    set({ topic, systemPrompt: generateSystemPrompt(get().language1, get().language2, topic) });
  },
  setUser: (user) => set({ user }),
  setSessionId: (sessionId) => set({ sessionId }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}>(set => ({
  isSidebarOpen: true,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
}));

// FIX: Define and export the FunctionCall interface.
/**
 * Tools
 */
// FIX: The FunctionCall interface was redefined to explicitly include the name, description, and parameters properties.
// This resolves TS errors where these properties were reported as missing because `FunctionDeclaration` did not seem to contain them.
export interface FunctionCall {
  name: string;
  description: string;
  parameters: any;
  isEnabled: boolean;
  scheduling: FunctionResponseScheduling;
}

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));