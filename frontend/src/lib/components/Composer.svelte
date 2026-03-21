<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowUp } from 'lucide-svelte';
	import { store } from '$lib/store.svelte';
	import { toasts } from '$lib/toast.svelte';
	import { postMessage } from '$lib/api';

	const MIN_H = 40;
	const MAX_H = 128;

	let text = $state('');
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let sending = $state(false);

	onMount(() => { textareaEl?.focus(); });

	const canSend = $derived(!sending && !store.processing && text.trim().length > 0);

	function autoResize() {
		const el = textareaEl;
		if (!el) return;
		const styles = window.getComputedStyle(el);
		const borders = parseFloat(styles.borderTopWidth || '0') + parseFloat(styles.borderBottomWidth || '0');
		el.style.height = 'auto';
		el.style.height = `${Math.min(Math.max(el.scrollHeight + borders, MIN_H), MAX_H)}px`;
	}

	async function submit() {
		const trimmed = text.trim();
		if (!trimmed || sending || store.processing) return;

		sending = true;
		try {
			const { snapshot } = await postMessage(trimmed, store.cwd || undefined);
			store.applySnapshot(snapshot);
			text = '';
			requestAnimationFrame(autoResize);
		} catch (e) {
			toasts.error((e as Error).message, 'Message failed');
		} finally {
			sending = false;
			textareaEl?.focus();
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			submit();
		}
	}
</script>

<form
	onsubmit={(e) => { e.preventDefault(); submit(); }}
	class="flex items-end gap-2"
>
	<label for="composer-input" class="sr-only">Message</label>
	<div class="min-w-0 flex-1">
		<textarea
			id="composer-input"
			bind:this={textareaEl}
			bind:value={text}
			oninput={autoResize}
			onkeydown={onkeydown}
			rows={1}
			placeholder="Ask the agent…"
			style="min-height: {MIN_H}px; max-height: {MAX_H}px;"
			class="box-border w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm leading-5 text-zinc-100 outline-none transition-colors duration-150 placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
		></textarea>
	</div>

	<button
		type="submit"
		disabled={!canSend}
		aria-label="Send message"
		title="Send message"
		class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center self-end rounded-lg bg-zinc-100 text-zinc-950 transition-colors duration-150 hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
	>
		<ArrowUp class="size-4" />
	</button>
</form>
