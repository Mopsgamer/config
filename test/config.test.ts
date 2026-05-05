import assert from 'node:assert';
import {z} from 'zod';
import {Config} from '../src/config.js';

it('isObject should identify object schemas', () => {
    const cfg = new Config({
        path: '',
        schema: z.object({ test: z.string() })
    });
    assert(cfg.isObject());
});

it('isObject should identify optional object schemas', () => {
    const cfg = new Config({
        path: '',
        schema: z.object({ test: z.string() }).optional()
    });
    assert(cfg.isObject());
});
