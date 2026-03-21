<script lang="ts">
	import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-svelte';
	import { toasts, type Toast } from '$lib/toast.svelte';

	function iconFor(type: Toast['type']) {
		return { info: Info, success: CheckCircle, warning: AlertTriangle, error: AlertCircle }[type];
	}

	function colorFor(type: Toast['type']) {
		return {
			info: {
				wrapper: 'border-zinc-800 bg-zinc-900',
				icon: 'bg-zinc-800 text-zinc-300'
			},
			success: {
				wrapper: 'border-emerald-500/20 bg-zinc-900',
				icon: 'bg-emerald-500/10 text-emerald-400'
			},
			warning: {
				wrapper: 'border-amber-500/20 bg-zinc-900',
				icon: 'bg-amber-500/10 text-amber-400'
			},
			error: {
				wrapper: 'border-red-500/20 bg-zinc-900',
				icon: 'bg-red-500/10 text-red-400'
			}
		}[type];
	}
</script>

<div
	class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6"
	aria-live="polite"
	aria-atomic="false"
>
	<div class="flex w-full max-w-sm flex-col gap-2">
		{#each toasts.items as toast (toast.id)}
			{@const color = colorFor(toast.type)}
			{@const Icon = iconFor(toast.type)}
			<div
				class="pointer-events-auto overflow-hidden rounded-xl border {color.wrapper} shadow-md transition-all duration-150 ease-out"
				role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
			>
				<div class="flex items-start gap-3 px-4 py-3">
					<div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg {color.icon}">
						<Icon class="size-4" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-semibold text-zinc-100">{toast.title}</p>
						<p class="mt-0.5 text-sm leading-relaxed text-zinc-400">{toast.message}</p>
					</div>
					<button
						type="button"
						onclick={() => toasts.dismiss(toast.id)}
						aria-label="Dismiss"
						class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-200"
					>
						<X class="size-4" />
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
