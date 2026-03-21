export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
	id: string;
	type: ToastType;
	title: string;
	message: string;
	duration: number;
}

class ToastStore {
	items = $state<Toast[]>([]);

	show(message: string, options: { type?: ToastType; title?: string; duration?: number } = {}) {
		const type = options.type ?? 'info';
		const defaultTitle = { info: 'Notice', success: 'Success', warning: 'Warning', error: 'Error' }[type];
		const duration = options.duration ?? (type === 'error' || type === 'warning' ? 5200 : 2800);

		const toast: Toast = {
			id: crypto.randomUUID(),
			type,
			title: options.title ?? defaultTitle,
			message: String(message ?? '').trim(),
			duration
		};

		if (this.items.length >= 4) {
			this.items = this.items.slice(1);
		}
		this.items = [...this.items, toast];

		if (duration > 0) {
			setTimeout(() => this.dismiss(toast.id), duration);
		}
	}

	dismiss(id: string) {
		this.items = this.items.filter((t) => t.id !== id);
	}

	error(message: string, title?: string) {
		this.show(message, { type: 'error', title });
	}

	success(message: string, title?: string, duration?: number) {
		this.show(message, { type: 'success', title, duration });
	}
}

export const toasts = new ToastStore();
