<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';

	interface Props {
		content: string;
		class?: string;
	}

	let { content, class: klass = '' }: Props = $props();

	const html = $derived(renderMarkdown(content));
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div class="markdown-body prose prose-invert prose-zinc max-w-none text-sm leading-relaxed {klass}">
	{@html html}
</div>
