<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { children } = $props();

	const isRootPage = $derived($page.url.pathname === '/');

	async function handleLogout() {
		// TODO: Implement logout action
		console.log('Logout clicked');
	}

	async function handleBack() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto('/');
	}
</script>

<div class="flex min-h-screen flex-col">
	<!-- Minimal Header -->
	<header class="sticky top-0 z-50 border-b bg-background">
		<div class="container mx-auto flex h-16 items-center justify-between px-4">
			<!-- Left: Logo or Back Button -->
			<div class="flex items-center gap-4">
				{#if isRootPage}
					<img src="/logo.svg" alt="Fenbro Logo" class="h-8 w-auto" />
				{:else}
					// eslint-disable-next-line svelte/no-navigation-without-resolve
					<Button variant="ghost" size="sm" onclick={() => handleBack()}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="m15 18-6-6 6-6" />
						</svg>
						<span class="ml-1">Wstecz</span>
					</Button>
				{/if}
			</div>

			<!-- Right: Logout Button -->
			<Button variant="outline" size="sm" onclick={handleLogout}>Wyloguj</Button>
		</div>
	</header>

	<!-- Main Content Area -->
	<main class="container mx-auto flex-1 px-4 py-8">
		{@render children()}
	</main>
</div>
