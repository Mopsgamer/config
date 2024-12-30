import * as config from '../src/index.js';
import * as commander from '../src/integration/commander/index.js';

const cfg = new config.Config({
	path: '',
	type: config.Types.struct({
		optional: true,
		properties: {
			testprop: config.Types.number({optional: true}),
		},
	}),
});

it('commander new command', () => {
	cfg.load();
	commander.initCommand(cfg);
});

it('commander new command no data', () => {
	commander.initCommand(cfg);
});
