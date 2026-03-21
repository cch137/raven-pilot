import { store } from './store.svelte';
import { toasts } from './toast.svelte';
import { fetchSnapshot } from './api';
import type { StreamEvent } from './types';

let connectionLost = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let source: EventSource | null = null;

export function connectEvents() {
	if (source) {
		source.close();
		source = null;
	}

	const es = new EventSource('http://localhost:3600/api/events');
	source = es;

	es.onmessage = (event) => {
		let payload: StreamEvent;
		try {
			payload = JSON.parse(event.data);
		} catch {
			return;
		}

		if (connectionLost) {
			connectionLost = false;
			toasts.success('Live updates restored.', 'Reconnected', 2200);
		}

		switch (payload.type) {
			case 'snapshot':
			case 'conversation-reset':
				store.applySnapshot(payload.data);
				break;
			case 'message-added':
			case 'message-updated':
				store.upsertMessage(payload.data);
				break;
			case 'processing':
				store.processing = payload.data.processing;
				break;
		}
	};

	es.onerror = async () => {
		es.close();
		source = null;

		if (!connectionLost) {
			connectionLost = true;
			toasts.show('Connection lost. Reconnecting…', { type: 'warning', title: 'Offline' });
		}

		try {
			const snapshot = await fetchSnapshot();
			store.applySnapshot(snapshot);
		} catch {
			// swallow
		}

		if (retryTimer) clearTimeout(retryTimer);
		retryTimer = setTimeout(connectEvents, 2000);
	};
}

export function disconnectEvents() {
	if (retryTimer) {
		clearTimeout(retryTimer);
		retryTimer = null;
	}
	if (source) {
		source.close();
		source = null;
	}
}
