<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import { SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	// Mock data for prototyping
	const mode = page.params.mode;
	const mockFilters = Array.from({ length: 60 }, (_, i) => ({
		id: i + 1,
		name: `Filter ${i + 1} - ${['Active Deals', 'Hot Leads', 'Q1 2025', 'Enterprise Clients', 'Follow-up Required'][i % 5]}`
	}));

	// Mock active job (set to null to see no-job state)
	const mockActiveJob = null;

	// Local state
	let selectedFilterIds = new SvelteSet<number>();
	let isSyncing = $state(false);

	// Derived state
	const hasSelection = $derived(selectedFilterIds.size > 0);
	const title = $derived(mode === 'new' ? 'Utwórz nowe listy' : 'Nadpisz istniejące listy');
	const buttonText = $derived(
		mode === 'new'
			? `Utwórz nowe (${selectedFilterIds.size})`
			: `Nadpisz (${selectedFilterIds.size})`
	);

	function toggleFilter(filterId: number) {
		if (selectedFilterIds.has(filterId)) {
			selectedFilterIds.delete(filterId);
		} else {
			selectedFilterIds.add(filterId);
		}
	}

	function handleSubmit() {
		isSyncing = true;
		return async ({ result }: { result: { type: string } }) => {
			isSyncing = false;
			if (result.type === 'success') {
				selectedFilterIds.clear();
			}
		};
	}
</script>

<div class="mx-auto max-w-2xl">
	<!-- Title -->
	<h1 class="mb-6 text-3xl font-bold">{title}</h1>

	<!-- Active Job Alert -->
	{#if mockActiveJob}
		<Alert.Root variant="default" class="mb-6">
			<CheckCircle2Icon class="h-4 w-4" />
			<Alert.Title>Synchronizacja w toku</Alert.Title>
			<Alert.Description>
				Wszystkie akcje są obecnie zablokowane. Poczekaj na zakończenie operacji i odśwież stronę.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Form wrapping the entire filter selection -->
	<form method="POST" action="?/sync" use:enhance={handleSubmit}>
		<!-- Filter Selection Card -->
		<Card.Root class="mb-6">
			<Card.Header>
				<div class="flex items-center justify-between">
					<Card.Title>Wybierz filtry do synchronizacji</Card.Title>
					<Badge variant="secondary">{selectedFilterIds.size} / {mockFilters.length}</Badge>
				</div>
			</Card.Header>
			<Card.Content>
				<!-- Scrollable filter list -->
				<div class="max-h-96 overflow-y-auto rounded-md border">
					{#each mockFilters as filter (filter.id)}
						<div class="flex items-center space-x-3 border-b px-4 py-3 last:border-b-0">
							<Checkbox
								name="filterIds"
								value={String(filter.id)}
								data-testid={`filter-checkbox-${filter.id}`}
								checked={selectedFilterIds.has(filter.id)}
								onCheckedChange={() => toggleFilter(filter.id)}
								disabled={!!mockActiveJob}
							/>
							<span class="flex-1 text-sm">{filter.name}</span>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Sync Action Button -->
		<Button
			type="submit"
			data-testid="sync-button"
			disabled={isSyncing || !hasSelection || !!mockActiveJob}
			class="w-full cursor-pointer"
			size="lg"
		>
			{#if isSyncing}
				<Spinner class="mr-2 h-4 w-4" />
			{/if}
			{buttonText}
		</Button>
	</form>
</div>
