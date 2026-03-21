<script lang="ts">
	import { Check, FolderOpen, Leaf, Feather, Brain, Flame, AlignLeft, AlignJustify, type IconProps } from 'lucide-svelte';
	import type { SvelteComponent } from 'svelte';
	import Select from './Select.svelte';
	import { store } from '$lib/store.svelte';
	import { toasts } from '$lib/toast.svelte';
	import { postCwd, postModelSettings } from '$lib/api';
	import type { ReasoningEffort, Verbosity } from '$lib/types';

	type IconComponent = new (...args: any[]) => SvelteComponent<IconProps>;

	let applyingModel = $state(false);
	let applyingCwd = $state(false);
	let cwdInput = $state(store.cwd);
	let cwdFocused = $state(false);

	// Keep cwd input in sync when not editing
	$effect(() => {		if (!cwdFocused) cwdInput = store.cwd;
	});

	// Build model select options — no icons
	const modelOptions = $derived(
		store.models.length > 0
			? store.models.map((m) => ({ value: m.id, label: m.label }))
			: [{ value: store.modelSettings.model, label: store.modelSettings.model }]
	);

	const reasoningOptions: { value: ReasoningEffort; label: string; icon: IconComponent }[] = [
		{ value: 'minimal', label: 'Minimal', icon: Leaf as unknown as IconComponent },
		{ value: 'low', label: 'Low', icon: Feather as unknown as IconComponent },
		{ value: 'medium', label: 'Medium', icon: Brain as unknown as IconComponent },
		{ value: 'high', label: 'High', icon: Flame as unknown as IconComponent }
	];

	const verbosityOptions: { value: Verbosity; label: string; icon: IconComponent }[] = [
		{ value: 'low', label: 'Low', icon: AlignLeft as unknown as IconComponent },
		{ value: 'medium', label: 'Medium', icon: AlignLeft as unknown as IconComponent },
		{ value: 'high', label: 'High', icon: AlignJustify as unknown as IconComponent }
	];

	async function sendModelSettings(patch: Partial<{ model: string; reasoningEffort: ReasoningEffort; verbosity: Verbosity }>) {
		if (applyingModel) return;
		applyingModel = true;
		try {
			const { snapshot } = await postModelSettings({
				model: store.modelSettings.model,
				reasoningEffort: store.modelSettings.reasoningEffort,
				verbosity: store.modelSettings.verbosity,
				...patch
			});
			store.applySnapshot(snapshot);
			toasts.success('Model settings updated.', 'Ready', 2200);
		} catch (err) {
			toasts.error((err as Error).message, 'Model update failed');
		} finally {
			applyingModel = false;
		}
	}

	async function applyCwd(e: SubmitEvent) {
		e.preventDefault();
		const cwd = cwdInput.trim();
		if (!cwd) return;
		applyingCwd = true;
		try {
			const { snapshot } = await postCwd(cwd);
			store.applySnapshot(snapshot);
			cwdInput = store.cwd;
			toasts.success('Workspace updated.', 'Ready', 2200);
		} catch (err) {
			toasts.error((err as Error).message, 'Workspace update failed');
		} finally {
			applyingCwd = false;
		}
	}
</script>

<div class="flex flex-col gap-2 xl:flex-row xl:items-center">
	<!-- Model settings (no form needed — each select auto-submits) -->
	<div class="flex min-w-0 flex-[1.4] flex-wrap items-center gap-2">
		<Select
			options={modelOptions}
			value={store.modelSettings.model}
			label="Model"
			class="min-w-[200px] flex-1"
			onchange={(v) => sendModelSettings({ model: v })}
		/>

		<Select
			options={reasoningOptions}
			value={store.modelSettings.reasoningEffort}
			label="Reasoning effort"
			class="min-w-[120px] flex-1 sm:flex-none"
			onchange={(v) => sendModelSettings({ reasoningEffort: v as ReasoningEffort })}
		/>

		<Select
			options={verbosityOptions}
			value={store.modelSettings.verbosity}
			label="Verbosity"
			class="min-w-[108px] flex-1 sm:flex-none"
			onchange={(v) => sendModelSettings({ verbosity: v as Verbosity })}
		/>
	</div>

	<!-- CWD form -->
	<form onsubmit={applyCwd} class="flex min-w-0 flex-1 items-center gap-2">
		<label for="cwd-input" class="sr-only">Workspace</label>
		<div class="relative min-w-0 flex-1">
			<FolderOpen
				class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600"
			/>
			<input
				id="cwd-input"
				bind:value={cwdInput}
				onfocus={() => (cwdFocused = true)}
				onblur={() => (cwdFocused = false)}
				type="text"
				autocomplete="off"
				spellcheck="false"
				placeholder="Working directory"
				class="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-colors duration-150 placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
			/>
		</div>
		<button
			type="submit"
			disabled={applyingCwd || store.processing || !cwdInput.trim()}
			aria-label="Apply workspace"
			title="Apply workspace"
			class="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
		>
			<Check class="size-4" />
		</button>
	</form>
</div>
