import assert from 'node:assert';
import {z} from 'zod';
import {Config} from '../src/config.js';

it('setter should work with Zod', () => {
	const cfg = new Config({
		path: 'test.json',
		schema: z.object({
			id: z.number().default(0),
		}),
	});

	cfg.set('id', 123);
	assert.strictEqual(cfg.get('id'), 123);
});

it('setter should fail with invalid value', () => {
	const cfg = new Config({
		path: 'test.json',
		schema: z.object({
			id: z.number(),
		}),
	});

	const error = cfg.failSet('id', 'not a number');
	assert(error?.includes('id'));
});
