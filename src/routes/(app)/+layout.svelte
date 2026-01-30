<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { ArrowLeft } from '@lucide/svelte';

	let { children } = $props();

	const pathname = $derived(String(page.url.pathname));
	const isModeRoute = $derived(pathname === '/new' || pathname === '/overwrite');

	async function handleBack() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto('/');
	}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Minimal Header -->
	<header class="sticky top-0 z-50 border-b bg-background">
		<div class="container mx-auto flex h-16 items-center justify-between px-4">
			<!-- Left: Back Button (only on mode routes) -->
			<div class="flex w-24 items-center">
				{#if isModeRoute}
					<Button variant="ghost" size="sm" onclick={() => handleBack()}>
						<ArrowLeft class="h-5 w-5" />
						<span class="ml-1">Wstecz</span>
					</Button>
				{/if}
			</div>

			<!-- Center: Logo (always visible) -->
			<div class="flex flex-1 justify-center">
				<img src="/logo.svg" alt="Fenbro Logo" class="h-8 w-auto" />
			</div>

			<!-- Right: Logout Button -->
			<div class="flex w-24 justify-end">
				<form method="POST" action="/logout" use:enhance>
					<Button type="submit" variant="outline" size="sm">Wyloguj</Button>
				</form>
			</div>
		</div>
	</header>

	<!-- Main Content Area -->
	<main class="container mx-auto flex-1 px-4 py-8">
		{@render children()}
	</main>
</div>
