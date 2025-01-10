import * as commander from 'commander';
import * as config from '../src/index.js';
import * as integration from '../src/integration/commander/index.js';

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

it('type:struct commander init after load', () => {
	const cfg = getCfg(false, true);
	integration.initCommand(cfg, {adapter: commander});
});

it('type:struct commander init before load', () => {
	const cfg = getCfg(false, false);
	integration.initCommand(cfg, {adapter: commander});
});

it('type:?struct commander init after load', () => {
	const cfg = getCfg(true, true);
	integration.initCommand(cfg, {adapter: commander});
});

it('type:?struct commander init before load', () => {
	const cfg = getCfg(true, false);
	integration.initCommand(cfg, {adapter: commander});
});
