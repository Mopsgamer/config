import assert from 'node:assert';
import * as config from '../src/index.js';

it('repro set bug', () => {
	const cfg = new config.Config({
		path: 'test.json',
		type: config.Types.struct({
			properties: {
				id: config.Types.number(),
			},
		}),
	});

	cfg.set('id', 123);
	assert.strictEqual(cfg.get('id'), 123);
});
