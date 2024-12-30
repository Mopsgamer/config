import assert from 'node:assert';
import * as config from '../src/index.js';

const cfg = new config.Config({
	path: '',
	type: config.Types.struct({
		optional: true,
		properties: {
			testprop: config.Types.number({optional: true}),
		},
	}),
});

it('config load', () => {
	cfg.load();
	assert(cfg.isObjectLike(0));
});
