<script lang="ts">
	import { Bot, Hash, Activity, RotateCcw } from 'lucide-svelte';
	import { store } from '$lib/store.svelte';
	import { toasts } from '$lib/toast.svelte';
	import { postReset } from '$lib/api';

	let resetting = $state(false);

	async function handleReset() {
		resetting = true;
		try {
			const { snapshot } = await postReset();
			store.applySnapshot(snapshot);
			toasts.success('Conversation reset.', 'Done', 2200);
		} catch (e) {
			toasts.error((e as Error).message, 'Reset failed');
		} finally {
			resetting = false;
		}
	}
</script>

<header class="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
	<div class="flex min-w-0 items-center gap-2.5">
		<div class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800">
			<Bot class="size-4" />
		</div>
		<div class="min-w-0">
			<div class="flex min-w-0 items-center gap-2 text-sm">
				<h1 class="truncate text-sm font-semibold tracking-tight text-zinc-100">Raven Pilot</h1>
				<span class="text-zinc-700">/</span>
				<div class="flex min-w-0 items-center gap-1 text-[11px] text-zinc-500">
					<Hash class="size-3.5" />
					<span class="truncate font-mono">{store.threadId || '—'}</span>
				</div>
			</div>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<div class="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-[13px] text-zinc-400">
			<span
				class="size-1.5 rounded-full transition-colors duration-200 {store.processing
					? 'animate-pulse bg-amber-400'
					: 'bg-zinc-600'}"
			></span>
			<Activity class="size-3.5 text-zinc-600" />
			<span class="text-zinc-400">{store.processing ? 'Streaming' : 'Idle'}</span>
		</div>

		<button
			type="button"
			onclick={handleReset}
			disabled={resetting || store.processing}
			aria-label="Reset conversation"
			title="Reset conversation"
			class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
		>
			<RotateCcw class="size-4 {resetting ? 'animate-spin' : ''}" />
		</button>
	</div>
</header>
