<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { store } from '$lib/store.svelte';
	import { toasts } from '$lib/toast.svelte';	import { fetchSnapshot, fetchModels } from '$lib/api';
	import { connectEvents, disconnectEvents } from '$lib/sse.svelte';
	import Header from '$lib/components/Header.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import ControlBar from '$lib/components/ControlBar.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import Toaster from '$lib/components/Toaster.svelte';	onMount(async () => {
		try {
			const [snapshot, models] = await Promise.all([fetchSnapshot(), fetchModels()]);
			store.applySnapshot(snapshot);
			store.models = models;
		} catch (e) {
			toasts.error((e as Error).message, 'Unable to load conversation');
		}
		connectEvents();
	});

	onDestroy(() => {
		disconnectEvents();
	});
</script>

<svelte:head>
	<title>Raven Pilot</title>
</svelte:head>

<div class="min-h-[100dvh] bg-zinc-950">
	<main class="mx-auto flex h-[100dvh] min-h-0 max-w-4xl flex-col px-4 py-3">
		<Header />

		<section class="flex min-h-0 flex-1 flex-col pt-3">
			<MessageList />

			<div class="mt-2 space-y-2 border-t border-zinc-800 pt-3">
				<ControlBar />
				<Composer />
			</div>
		</section>
	</main>
</div>

<Toaster />
