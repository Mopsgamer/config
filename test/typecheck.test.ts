import assert from 'node:assert';
import {z} from 'zod';
import {Config} from '../src/config.js';

it('type validation with zod', () => {
	const schema = z.object({
        name: z.string(),
        age: z.number().min(18),
        tags: z.array(z.string()).default([])
    });

    const cfg = new Config({
        path: '',
        schema
    });

    cfg.setData({ name: 'John', age: 25, tags: ['a'] });
    assert.strictEqual(cfg.get('name'), 'John');

    const error = cfg.failSet('age', 15);
    assert(error?.includes('age'));
});
