<script lang="ts">
	import { ChevronDown, type IconProps } from 'lucide-svelte';
	import type { SvelteComponent } from 'svelte';

	type IconComponent = new (...args: any[]) => SvelteComponent<IconProps>;

	interface Option {
		value: string;
		label: string;
		icon?: IconComponent;
	}

	interface Props {
		options: Option[];
		value: string;
		label?: string;
		class?: string;
		onchange?: (value: string) => void;
		onopen?: () => void;
		onclose?: () => void;
	}

	let { options, value, label = '', class: klass = '', onchange, onopen, onclose }: Props = $props();

	let open = $state(false);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let menuEl = $state<HTMLDivElement | null>(null);
	let placement = $state<'top' | 'bottom'>('bottom');

	const selected = $derived(options.find((o) => o.value === value) ?? options[0]);

	function computePlacement() {
		if (!triggerEl || !menuEl) return;
		const rect = triggerEl.getBoundingClientRect();
		const menuH = Math.min(menuEl.scrollHeight, 256);
		const below = window.innerHeight - rect.bottom - 6;
		const above = rect.top - 6;
		placement = below < menuH && above > below ? 'top' : 'bottom';
	}

	function toggle() {
		open = !open;
		if (open) {
			requestAnimationFrame(computePlacement);
			onopen?.();
		} else {
			onclose?.();
		}
	}

	function select(opt: Option) {
		open = false;
		onclose?.();
		triggerEl?.focus();
		if (opt.value !== value) {
			onchange?.(opt.value);
		}
	}

	function onkeydown(e: KeyboardEvent) {
		const idx = options.findIndex((o) => o.value === value);
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open ? focusOption(idx + 1) : ((open = true), requestAnimationFrame(() => focusOption(idx)));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			open
				? focusOption(idx - 1)
				: ((open = true), requestAnimationFrame(() => focusOption(options.length - 1)));
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			open ? (open = false) : (open = true);
		} else if (e.key === 'Escape' && open) {
			e.preventDefault();
			open = false;
			onclose?.();
			triggerEl?.focus();
		}
	}

	function focusOption(idx: number) {
		const bounded = Math.max(0, Math.min(idx, options.length - 1));
		const buttons = menuEl?.querySelectorAll<HTMLButtonElement>('[data-option]');
		buttons?.[bounded]?.focus();
	}

	function optionKeydown(e: KeyboardEvent, opt: Option, idx: number) {
		if (e.key === 'ArrowDown') { e.preventDefault(); focusOption(idx + 1); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); focusOption(idx - 1); }
		else if (e.key === 'Home') { e.preventDefault(); focusOption(0); }
		else if (e.key === 'End') { e.preventDefault(); focusOption(options.length - 1); }
		else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(opt); }
		else if (e.key === 'Escape') { e.preventDefault(); open = false; triggerEl?.focus(); }
		else if (e.key === 'Tab') { open = false; }
	}

	function onDocPointer(e: PointerEvent) {
		if (!open) return;
		if (triggerEl?.contains(e.target as Node)) return;
		if (menuEl?.contains(e.target as Node)) return;
		open = false;
		onclose?.();
	}
</script>

<svelte:document onpointerdown={onDocPointer} />

<div class="relative {klass}">
	{#if label}
		<span class="sr-only">{label}</span>
	{/if}

	<button
		bind:this={triggerEl}
		type="button"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={label}
		title={selected?.label}
		{onkeydown}
		onclick={toggle}
		class="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-left text-sm text-zinc-100 transition-colors duration-150 hover:bg-zinc-800 focus:outline-none focus-visible:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-600"
	>
		<span class="flex min-w-0 items-center gap-2">
			{#if selected?.icon}
				{@const SelIcon = selected.icon}
				<SelIcon class="size-3.5 shrink-0 text-zinc-500" />
			{/if}
			<span class="min-w-0 truncate">{selected?.label ?? ''}</span>
		</span>
		<ChevronDown
			class="size-3.5 shrink-0 text-zinc-500 transition-transform duration-150 {open
				? 'rotate-180'
				: ''}"
		/>
	</button>

	{#if open}
		<div
			bind:this={menuEl}
			role="listbox"
			aria-label={label}
			class="absolute {placement === 'top'
				? 'bottom-[calc(100%+0.4rem)]'
				: 'top-[calc(100%+0.4rem)]'} left-0 z-30 min-w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-1 shadow-md"
		>
			{#each options as opt, idx}
				{@const isSelected = opt.value === value}
				<button
					data-option
					type="button"
					role="option"
					aria-selected={isSelected}
					tabindex={isSelected ? 0 : -1}
					onclick={() => select(opt)}
					onkeydown={(e) => optionKeydown(e, opt, idx)}
					class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 focus:outline-none
					{isSelected
						? 'bg-zinc-800 text-zinc-100'
						: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:bg-zinc-800 focus-visible:text-zinc-200'}"
				>
					{#if opt.icon}
						{@const OptIcon = opt.icon}
						<OptIcon class="size-3.5 shrink-0 text-zinc-500" />
					{/if}
					<span>{opt.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
