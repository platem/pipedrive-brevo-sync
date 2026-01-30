<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { goto } from '$app/navigation';

	function handleNavigate(path: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(path);
	}
</script>

<div class="flex min-h-full items-center justify-center px-4 pt-16">
	<div class="w-full max-w-4xl">
		<div class="flex flex-row items-center justify-center gap-8">
			<!-- Left Side: Create New Lists -->
			<div class="flex flex-1 flex-col items-center space-y-6 px-4 text-center">
				<div class="space-y-3">
					<h2 class="text-2xl font-semibold">Chcę utworzyć nowe listy</h2>
					<p class="text-sm text-muted-foreground">
						Nowe listy w Brevo z niezsynchronizowanych filtrów Pipedrive
					</p>
				</div>
				<Button
					variant="outline"
					size="lg"
					class="w-full max-w-xs"
					onclick={() => handleNavigate('/new')}
				>
					Utwórz nowe
				</Button>
			</div>

			<!-- Vertical Separator -->
			<div class="h-48 w-px self-center bg-border"></div>

			<!-- Right Side: Overwrite Existing Lists -->
			<div class="flex flex-1 flex-col items-center space-y-6 px-4 text-center">
				<div class="space-y-3">
					<h2 class="text-2xl font-semibold">Chcę nadpisać istniejące listy</h2>
					<p class="text-sm text-muted-foreground">
						Aktualizacja list w Brevo ze zsynchronizowanych filtrów Pipedrive
					</p>
				</div>
				<Button
					variant="outline"
					size="lg"
					class="w-full max-w-xs"
					onclick={() => handleNavigate('/overwrite')}
				>
					Nadpisz istniejące
				</Button>
			</div>
		</div>
	</div>
</div>
