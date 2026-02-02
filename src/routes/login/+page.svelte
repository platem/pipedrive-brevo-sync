<script lang="ts">
	import type { ActionResult } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import * as Card from '$lib/components/ui/card/index';
	import { Button } from '$lib/components/ui/button/index';
	import { Input } from '$lib/components/ui/input/index';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let isSubmitting = $state(false);

	function handleSubmit() {
		isSubmitting = true;
		return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
			await update();
			isSubmitting = false;
		};
	}
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-2xl">Login</Card.Title>
			<Card.Description>Enter your credentials to continue</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/login" use:enhance={handleSubmit} class="space-y-4">
				<div class="space-y-2">
					<label for="username" class="text-sm font-medium">Username</label>
					<Input
						id="username"
						name="username"
						type="text"
						required
						autocomplete="username"
						data-testid="username-input"
					/>
				</div>

				<div class="space-y-2">
					<label for="password" class="text-sm font-medium">Password</label>
					<Input
						id="password"
						name="password"
						type="password"
						required
						autocomplete="current-password"
						data-testid="password-input"
					/>
				</div>

				{#if form?.message}
					<p class="text-sm text-destructive" data-testid="error-message">{form.message}</p>
				{/if}

				<Button type="submit" class="w-full" data-testid="submit-button" disabled={isSubmitting}>
					{#if isSubmitting}
						<Spinner class="mr-2 h-4 w-4" />
					{/if}
					Sign In
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
