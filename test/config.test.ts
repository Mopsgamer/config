import assert from 'node:assert';
import * as config from '../src/index.js';

const getCfg = (optional: boolean, useDefaultData: boolean) => {
	const cfg = new config.Config({
		path: '',
		type: config.Types.struct({
			optional,
			properties: {
				testprop: config.Types.number({optional: true}),
			},
		}),
	});
	if (useDefaultData) {
		cfg.setData(cfg.type.defaultVal!);
	}

	return cfg;
};

it('type:struct is object before load', () => {
	const cfg = getCfg(false, false);
	assert(!cfg.isObjectLike(0));
});

it('type:?struct is object before load', () => {
	const cfg = getCfg(true, false);
	assert(!cfg.isObjectLike(0));
});

it('type:struct is object after load', () => {
	const cfg = getCfg(false, true);
	assert(cfg.isObjectLike(0));
});

it('type:?struct is object after load', () => {
	const cfg = getCfg(true, true);
	assert(cfg.isObjectLike(0));
});
