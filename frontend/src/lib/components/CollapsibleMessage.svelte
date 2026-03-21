<script lang="ts">
	import { ChevronDown, Lightbulb, Wrench, Terminal, Bot, User, Shield, MessageSquare } from 'lucide-svelte';
	import type { ConversationMessage } from '$lib/types';
	import { timeLabel } from '$lib/markdown';
	import MarkdownBody from './MarkdownBody.svelte';

	interface Props {
		message: ConversationMessage;
		compact?: boolean;
		defaultOpen?: boolean;
	}

	let { message, compact = false, defaultOpen = false }: Props = $props();
	// svelte warns that $state(defaultOpen) only captures the initial prop value —
	// that is intentional here: the user controls open/close after mount.
	// eslint-disable-next-line svelte/state_referenced_locally
	let open = $state(false);
	let initialized = false;
	$effect(() => {
		if (!initialized) { open = defaultOpen; initialized = true; }
	});

	function getIcon(msg: ConversationMessage) {
		switch (msg.kind) {
			case 'thinking': return Lightbulb;
			case 'tool-call': return Wrench;
			case 'tool-result': return Terminal;
			default:
				switch (msg.role) {
					case 'user': return User;
					case 'assistant': return Bot;
					case 'system': return Shield;
					default: return MessageSquare;
				}
		}
	}

	function getLabel(msg: ConversationMessage): string {
		if (msg.title) return msg.title;
		switch (msg.kind) {
			case 'thinking': return 'Thinking';
			case 'tool-call': return 'Tool Call';
			case 'tool-result': return 'Tool Result';
			default:
				switch (msg.role) {
					case 'user': return 'You';
					case 'assistant': return 'Assistant';
					case 'system': return 'System';
					default: return 'Message';
				}
		}
	}

	function getBadge(msg: ConversationMessage): string {
		switch (msg.kind) {
			case 'thinking': return 'thinking';
			case 'tool-call': return 'tool call';
			case 'tool-result': return 'tool result';
			default: return msg.role ?? 'message';
		}
	}

	const Icon = $derived(getIcon(message));
	const label = $derived(getLabel(message));
	const badge = $derived(getBadge(message));
	const time = $derived(timeLabel(message.createdAt));
	const px = $derived(compact ? 'px-2.5 py-2' : 'px-3 py-2.5');

	/** Wrap tool-call / tool-result content in a fenced code block so it is
	 *  rendered as code rather than being interpreted as Markdown. */
	const renderedContent = $derived(
		message.kind === 'tool-call' || message.kind === 'tool-result'
			? '```json\n' + message.content + '\n```'
			: message.content
	);
</script>

<article class="{compact ? '' : 'w-full max-w-[min(100%,48rem)]'} rounded-xl border border-zinc-800 bg-zinc-900/40">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		class="flex w-full cursor-pointer items-center justify-between gap-3 {px} text-left"
	>
		<div class="flex min-w-0 items-center gap-2.5">
			<span class="flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400">
				<Icon class="size-4" />
			</span>
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-1.5">
					<p class="text-sm font-medium text-zinc-100">{label}</p>
					<span class="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
						{badge}
					</span>
				</div>
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
		<div class="border-t border-zinc-800 {compact ? 'px-2.5 py-2.5' : 'px-3 py-3'}">
			<MarkdownBody content={renderedContent} />
		</div>
	{/if}
</article>
