import { describe, it, expect } from 'vitest';
import { load, actions } from '../../../src/routes/login/+page.server';
import { createMockFormData } from '../test-utils';

describe('login/+page.server.ts', () => {
	describe('load', () => {
		it('returns empty object when user is not authenticated', async () => {
			const event = { locals: { user: null, session: null } } as any;
			const result = await load(event);
			expect(result).toEqual({});
		});

		it('redirects to / when user is already authenticated', async () => {
			const event = {
				locals: { user: { id: 'user-123', username: 'testuser' }, session: {} }
			} as any;
			await expect(load(event)).rejects.toMatchObject({ status: 302, location: '/' });
		});
	});

	describe('validateUsername', () => {
		it('rejects username shorter than 3 characters', async () => {
			const formData = createMockFormData({ username: 'ab', password: 'password123' });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid username' } });
		});

		it('rejects username longer than 31 characters', async () => {
			const formData = createMockFormData({ username: 'a'.repeat(32), password: 'password123' });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid username' } });
		});

		it('rejects username with uppercase letters', async () => {
			const formData = createMockFormData({ username: 'TestUser', password: 'password123' });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid username' } });
		});

		it('rejects username with special characters', async () => {
			const formData = createMockFormData({ username: 'test@user!', password: 'password123' });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid username' } });
		});
	});

	describe('validatePassword', () => {
		it('rejects password shorter than 6 characters', async () => {
			const formData = createMockFormData({ username: 'testuser', password: 'abc' });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid password' } });
		});

		it('rejects password longer than 255 characters', async () => {
			const formData = createMockFormData({ username: 'testuser', password: 'a'.repeat(256) });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid password' } });
		});
	});

	describe('actions.login - input validation (AUTH-03)', () => {
		it('returns 400 for invalid username format', async () => {
			const formData = createMockFormData({ username: 'AB', password: 'password123' });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid username' } });
		});

		it('returns 400 for invalid password format', async () => {
			const formData = createMockFormData({ username: 'fenbro', password: '12345' });
			const event = { request: { formData: async () => formData } } as any;
			const result = await actions.login(event);
			expect(result).toMatchObject({ status: 400, data: { message: 'Invalid password' } });
		});
	});
});
