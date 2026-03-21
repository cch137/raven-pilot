<script lang="ts">
	import { store } from '$lib/store.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import CollapsibleMessage from './CollapsibleMessage.svelte';
	import ToolGroup from './ToolGroup.svelte';

	let scrollEl = $state<HTMLDivElement | null>(null);

	// Auto-scroll: stick to bottom within 80px threshold
	$effect(() => {
		// track messages reactively
		const _ = store.messages.length;
		const el = scrollEl;
		if (!el) return;
		const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (gap < 80) {
			requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight }));
		}
	});
</script>

<div
	bind:this={scrollEl}
	class="message-scroll min-h-0 flex-1 overflow-y-auto px-1"
	aria-live="polite"
>
	{#if store.messages.length === 0}
		<div class="flex min-h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
			No messages yet. Start a conversation below.
		</div>
	{:else}
		<div class="space-y-4 pb-4 pt-1">
			{#each store.renderItems as item (item.type === 'tool-group' ? `group:${item.messages[0].groupId}` : `msg:${item.message.id}`)}
				{#if item.type === 'tool-group'}
					<ToolGroup messages={item.messages} />
				{:else if item.type === 'collapsible'}
					<CollapsibleMessage message={item.message} />
				{:else}
					<ChatMessage message={item.message} />
				{/if}
			{/each}
		</div>
	{/if}
</div>
