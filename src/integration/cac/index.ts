import {type CAC} from 'cac';
import {z} from 'zod';
import {type Config} from '../../config.js';

/**
 * Adds configuration commands to CAC.
 */
export function initCAC<T extends z.ZodTypeAny>(cac: CAC, cfg: Config<T>) {
	const config = cac.command('config', 'Manage configuration');

	cac.command('config path', 'Show config path').action(() => {
		console.log(cfg.path);
	});

	cac.command('config get [key]', 'Get config value(s)')
		.option('--mode <mode>', 'Config mode (real, current, default)', { default: 'current' })
		.option('--parsable', 'Parsable output')
		.action((key, options) => {
			console.log(cfg.getPrintable(key, options));
		});

	cac.command('config set <key> <value>', 'Set config value')
		.action((key, value) => {
			const error = cfg.failSet(key, value);
			if (error) {
				console.error(error);
				process.exit(1);
			}
			cfg.save();
			console.log(cfg.getPrintable(key));
		});

	cac.command('config unset [key]', 'Unset config value(s)')
		.action((key) => {
			cfg.unset(key);
			cfg.save();
			if (key) {
				console.log(`Unset ${key}`);
			} else {
				console.log('Cleared all config');
			}
		});

	return config;
}
