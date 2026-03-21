import type { ConversationSnapshot, ModelConfig, ModelSettings } from './types';

const BASE = 'http://localhost:3600';

async function parseJson<T>(res: Response): Promise<T> {
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = (body as Record<string, unknown>)?.error;
		throw new Error(typeof msg === 'string' ? msg : `HTTP ${res.status}`);
	}
	return body as T;
}

export async function fetchModels(): Promise<ModelConfig[]> {
	const res = await fetch(`${BASE}/api/models`, { cache: 'no-store' });
	return parseJson<ModelConfig[]>(res);
}

export async function fetchSnapshot(): Promise<ConversationSnapshot> {
	const res = await fetch(`${BASE}/api/conversation`, { cache: 'no-store' });
	return parseJson<ConversationSnapshot>(res);
}

export async function postMessage(
	text: string,
	cwd?: string
): Promise<{ snapshot: ConversationSnapshot }> {
	const res = await fetch(`${BASE}/api/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text, cwd })
	});
	return parseJson(res);
}

export async function postCwd(cwd: string): Promise<{ snapshot: ConversationSnapshot }> {
	const res = await fetch(`${BASE}/api/cwd`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ cwd })
	});
	return parseJson(res);
}

export async function postModelSettings(
	settings: Partial<ModelSettings>
): Promise<{ snapshot: ConversationSnapshot }> {
	const res = await fetch(`${BASE}/api/model`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(settings)
	});
	return parseJson(res);
}

export async function postReset(): Promise<{ snapshot: ConversationSnapshot }> {
	const res = await fetch(`${BASE}/api/reset`, { method: 'POST' });
	return parseJson(res);
}
