<script lang="ts">
	import type { ConversationMessage } from '$lib/types';
	import { timeLabel } from '$lib/markdown';
	import MarkdownBody from './MarkdownBody.svelte';

	interface Props {
		message: ConversationMessage;
	}

	let { message }: Props = $props();

	const isUser = $derived(message.role === 'user');
	const isSystem = $derived(message.role === 'system');
	const time = $derived(timeLabel(message.createdAt));

	function getLabel(msg: ConversationMessage): string {
		switch (msg.role) {
			case 'user': return 'You';
			case 'assistant': return 'Assistant';
			case 'system': return 'System';
			default: return 'Message';
		}
	}
</script>

<article class={isUser ? 'ml-auto w-full max-w-[min(100%,40rem)]' : 'w-full max-w-[min(100%,48rem)]'}>
	<div class="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 {isUser ? 'justify-end' : ''}">
		<span>{getLabel(message)}</span>
		{#if time}
			<span class="text-zinc-700">•</span>
			<time>{time}</time>
		{/if}
	</div>

	<div
		class={isUser
			? 'rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3'
			: isSystem
				? 'rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5'
				: 'px-1'}
	>
		<MarkdownBody content={message.content} />
	</div>
</article>
