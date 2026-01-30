<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import { goto } from '$app/navigation';

	function handleRetry() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('/');
	}
</script>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="flex max-w-md flex-col items-center space-y-6 text-center">
		<h1 class="text-2xl font-semibold">Wystąpił błąd</h1>
		<p class="text-muted-foreground">
			{page.error?.message || 'Nie udało się załadować strony. Spróbuj ponownie później.'}
		</p>
		<Button onclick={handleRetry}>Spróbuj ponownie</Button>
	</div>
</div>
