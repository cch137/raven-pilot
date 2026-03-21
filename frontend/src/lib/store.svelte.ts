import type {
	ConversationMessage,
	ConversationSnapshot,
	ModelConfig,
	ModelSettings,
	RenderItem,
	ReasoningEffort,
	Verbosity
} from './types';

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
	model: 'claude-sonnet-4-6',
	reasoningEffort: 'high',
	verbosity: 'low'
};

class ConversationStore {
	threadId = $state('');
	cwd = $state('');
	modelSettings = $state<ModelSettings>({ ...DEFAULT_MODEL_SETTINGS });
	processing = $state(false);
	messages = $state<ConversationMessage[]>([]);
	connectionLost = $state(false);
	models = $state<ModelConfig[]>([]);

	applySnapshot(snapshot: ConversationSnapshot) {
		this.threadId = snapshot.threadId ?? '';
		this.cwd = snapshot.cwd ?? '';
		this.modelSettings = normalizeModelSettings(snapshot.modelSettings);
		this.processing = Boolean(snapshot.processing);
		this.messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
	}

	upsertMessage(message: ConversationMessage) {
		const idx = this.messages.findIndex((m) => m.id === message.id);
		if (idx === -1) this.messages = [...this.messages, message];
		else {
			const next = [...this.messages];
			next[idx] = message;
			this.messages = next;
		}
	}

	get renderItems(): RenderItem[] {
		const msgs = this.messages;

		// First pass: collect ALL messages belonging to each groupId, regardless of
		// whether they are consecutive. Using a Map preserves first-seen order.
		const groups = new Map<string, ConversationMessage[]>();
		for (const msg of msgs) {
			if (msg.groupId) {
				const bucket = groups.get(msg.groupId);
				if (bucket) {
					bucket.push(msg);
				} else {
					groups.set(msg.groupId, [msg]);
				}
			}
		}

		// Second pass: build render items. Emit a tool-group only the first time a
		// given groupId is encountered; skip subsequent messages that belong to it.
		// This prevents duplicate keys even when messages with the same groupId are
		// not contiguous in the list (e.g. an intermediate assistant chunk arrived
		// between tool-call and tool-result SSE events).
		const seenGroups = new Set<string>();
		const items: RenderItem[] = [];

		for (const msg of msgs) {
			if (msg.groupId) {
				if (seenGroups.has(msg.groupId)) continue;
				seenGroups.add(msg.groupId);
				// groups.get is guaranteed to return a value here
				items.push({ type: 'tool-group', messages: groups.get(msg.groupId)! });
				continue;
			}

			const collapsible =
				msg.kind === 'thinking' || msg.kind === 'tool-call' || msg.kind === 'tool-result';
			items.push({ type: collapsible ? 'collapsible' : 'message', message: msg });
		}

		return items;
	}
}

function normalizeModelSettings(s: Partial<ModelSettings> = {}): ModelSettings {
	const effort = s.reasoningEffort;
	const verbosity = s.verbosity;
	return {
		model: typeof s.model === 'string' && s.model.trim() ? s.model.trim() : DEFAULT_MODEL_SETTINGS.model,
		reasoningEffort: isReasoningEffort(effort) ? effort : DEFAULT_MODEL_SETTINGS.reasoningEffort,
		verbosity: isVerbosity(verbosity) ? verbosity : DEFAULT_MODEL_SETTINGS.verbosity
	};
}

function isReasoningEffort(v: unknown): v is ReasoningEffort {
	return v === 'minimal' || v === 'low' || v === 'medium' || v === 'high';
}

function isVerbosity(v: unknown): v is Verbosity {
	return v === 'low' || v === 'medium' || v === 'high';
}

export const store = new ConversationStore();
