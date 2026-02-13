export enum Modality {
    TEXT = "TEXT",
    AUDIO = "AUDIO",
}

export interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

export interface LiveConnectConfig {
    model?: string;
    systemInstruction?: {
        parts: Part[];
    };
    generationConfig?: {
        responseModalities?: string[];
        speechConfig?: {
            voiceConfig?: {
                prebuiltVoiceConfig?: {
                    voiceName: string;
                };
            };
        };
    };
    tools?: any[];
}

export interface GroundingChunk {
    web?: {
        uri?: string;
        title?: string;
    };
}

export interface LiveClientToolResponse {
    functionResponses?: {
        name: string;
        response: any;
        id: string;
    }[];
}

export interface LiveServerToolCall {
    functionCalls: {
        name: string;
        args: any;
        id: string;
    }[];
}

export interface LiveServerToolCallCancellation {
    ids: string[];
}

export interface LiveServerContent {
    modelTurn?: {
        parts: Part[];
    };
    turnComplete?: boolean;
    interrupted?: boolean;
    inputTranscription?: {
        text: string;
        isFinal?: boolean; // added isFinal
    };
    outputTranscription?: {
        text: string;
        isFinal?: boolean; // added isFinal
    };
    groundingMetadata?: {
        groundingChunks: GroundingChunk[];
    };
}

export interface FunctionResponse {
    name: string;
    response: any;
    id: string;
}

export interface FunctionResponseScheduling {
    output_items_before?: string[];
    output_items_after?: string[];
}

export interface FunctionCall {
    name: string;
    description: string;
    parameters: any;
    isEnabled: boolean;
    scheduling: FunctionResponseScheduling;
}

export interface LiveServerMessage {
    setupComplete?: boolean;
    serverContent?: LiveServerContent;
    toolCall?: LiveServerToolCall;
    toolCallCancellation?: LiveServerToolCallCancellation;
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

export interface StreamingLog {
    count?: number;
    data?: unknown;
    date: Date;
    message: string | object;
    type: string;
}
