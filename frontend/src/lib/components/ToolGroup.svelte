<script lang="ts">
	import { ChevronDown, Wrench } from 'lucide-svelte';
	import type { ConversationMessage } from '$lib/types';
	import { timeLabel } from '$lib/markdown';
	import CollapsibleMessage from './CollapsibleMessage.svelte';

	interface Props {
		messages: ConversationMessage[];
	}

	let { messages }: Props = $props();

	let open = $state(false);

	const call = $derived(messages.find((m) => m.kind === 'tool-call') ?? messages[0]);
	const result = $derived(messages.find((m) => m.kind === 'tool-result'));
	const title = $derived(call?.title || 'Tool activity');
	const badge = $derived(result ? 'completed' : 'running');
	const time = $derived(timeLabel(call?.createdAt ?? ''));
	const count = $derived(messages.length);
</script>

<section class="w-full max-w-[min(100%,48rem)] rounded-xl border border-zinc-800 bg-zinc-900/40">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		class="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left"
	>
		<div class="flex min-w-0 items-center gap-2.5">
			<span class="flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400">
				<Wrench class="size-4" />
			</span>
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-1.5">
					<p class="text-sm font-medium text-zinc-100">{title}</p>
					<span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] {badge === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}">
						{badge}
					</span>
				</div>
				<p class="mt-0.5 text-[11px] text-zinc-500">{count} item{count !== 1 ? 's' : ''}</p>
			</div>
		</div>
		<div class="flex shrink-0 items-center gap-2 pl-2 text-[11px] text-zinc-500">
			{#if time}
				<time>{time}</time>
			{/if}
			<ChevronDown class="size-4 transition-transform duration-150 {open ? 'rotate-180' : ''}" />
		</div>
	</button>

	{#if open}
		<div class="space-y-2 border-t border-zinc-800 px-3 py-3">
			{#each messages as msg (msg.id)}
				<CollapsibleMessage message={msg} compact={true} />
			{/each}
		</div>
	{/if}
</section>
