export type SupportedModelProvider = 'openai' | 'anthropic' | 'google' | 'xai';

export interface ModelConfig {
	id: string;
	label: string;
	provider: SupportedModelProvider;
}

export type ConversationRole = 'user' | 'assistant' | 'system' | 'tool';
export type MessageKind = 'message' | 'thinking' | 'tool-call' | 'tool-result';
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type Verbosity = 'low' | 'medium' | 'high';

export interface ConversationMessage {
	id: string;
	role: ConversationRole;
	kind: MessageKind;
	title?: string;
	content: string;
	createdAt: string;
	groupId?: string;
}

export interface ModelSettings {
	model: string;
	reasoningEffort: ReasoningEffort;
	verbosity: Verbosity;
}

export interface ConversationSnapshot {
	threadId: string;
	cwd: string;
	modelSettings: ModelSettings;
	processing: boolean;
	messages: ConversationMessage[];
}

export type StreamEvent =
	| { type: 'snapshot'; data: ConversationSnapshot }
	| { type: 'message-added'; data: ConversationMessage }
	| { type: 'message-updated'; data: ConversationMessage }
	| { type: 'conversation-reset'; data: ConversationSnapshot }
	| { type: 'processing'; data: { processing: boolean } };

// Render helpers
export type RenderItem =
	| { type: 'message'; message: ConversationMessage }
	| { type: 'collapsible'; message: ConversationMessage }
	| { type: 'tool-group'; messages: ConversationMessage[] };
