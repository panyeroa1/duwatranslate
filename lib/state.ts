// lib/state.ts

import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  ConversationTurn,
  GroundingChunk,
  LiveClientToolResponse,
  LiveServerToolCall,
  FunctionResponse,
  FunctionResponseScheduling,
  FunctionCall
} from './types';

/**
 * State management for Eburon AI application settings and configuration.
 * Uses Zustand for efficient state updates and persistence.
 */


const generateSystemPrompt = (lang1: string, lang2: string, topic: string) => {
  const topicInstruction = topic ? `The conversation is about: ${topic}. Please use appropriate terminology and context.` : '';
  return `You are an elite, native-level real-time interpreter. Your goal is to provide seamless, culturally-accurate, and natural-sounding translations.

**CORE DIRECTIVES:**
1. **CLEAN OUTPUT:** Output ONLY the translated text. NO metadata, labels like "[LANG:...]", or conversational filler.
2. **NATIVE FLUENCY:** Use idioms, phrasing, and prosody that are natural and common for a native speaker of ${lang1} or ${lang2}. Avoid "translation-ese".
3. **MIMIC NUANCE:** Capture the speaker's EXACT tone, intensity, and emotional nuance (humor, urgency, hesitation, etc.) in the translation.
4. **CONCISENESS:** Be extremely brief. Distill the meaning into 3-5 core words if possible, while maintaining the native flow.

**TRANSCRIPTION & VOICE:**
- Listen with absolute precision to the source audio. Capture the full meaning accurately before translating.
- When reading out the translation (TTS), ensure it sounds natural, human-like, and captures the original speaker's rhythm.

**VOICE PERSONA REFERENCE:**
- Voice: **Orus** for Staff (${lang1}).
- Voice: **Charon** for Guest (${lang2}).

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

/**
 * Logs
 */
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