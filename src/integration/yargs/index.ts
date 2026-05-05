import {type Argv} from 'yargs';
import {z} from 'zod';
import {type Config} from '../../config.js';

/**
 * Adds configuration commands to yargs.
 */
export function initYargs<T extends z.ZodTypeAny>(y: Argv, cfg: Config<T>) {
	return y.command('config', 'Manage configuration', (y) => {
		return y
			.command('path', 'Show config path', {}, () => {
				console.log(cfg.path);
			})
			.command('get [key]', 'Get config value(s)', (y) => {
				return y
					.positional('key', {type: 'string', description: 'Config key'})
					.option('mode', {choices: ['real', 'current', 'default'], default: 'current'})
					.option('parsable', {type: 'boolean', default: false});
			}, (argv) => {
				console.log(cfg.getPrintable(argv.key as string | string[] | undefined, {
					mode: argv.mode as any,
					parsable: argv.parsable as boolean,
				}));
			})
			.command('set <key> <value>', 'Set config value', (y) => {
				return y
					.positional('key', {type: 'string', description: 'Config key'})
					.positional('value', {type: 'string', description: 'Config value'});
			}, (argv) => {
				const error = cfg.failSet(argv.key as string, argv.value);
				if (error) {
					console.error(error);
					process.exit(1);
				}
				cfg.save();
				console.log(cfg.getPrintable(argv.key as string));
			})
			.command('unset [key]', 'Unset config value(s)', (y) => {
				return y.positional('key', {type: 'string', description: 'Config key'});
			}, (argv) => {
				cfg.unset(argv.key as string | undefined);
				cfg.save();
				if (argv.key) {
					console.log(`Unset ${argv.key}`);
				} else {
					console.log('Cleared all config');
				}
			});
	});
}
