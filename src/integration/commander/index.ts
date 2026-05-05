import * as commander from 'commander';
import {z} from 'zod';
import {type Config} from '../../config.js';

/**
 * Adds configuration commands to commander.
 */
export function initCommand<T extends z.ZodTypeAny>(cfg: Config<T>, program: commander.Command = commander.program) {
	const cfgCommand = program.command('config').alias('cfg').description('Manage configuration');

	cfgCommand.command('path').description('print the config file path').action(() => {
		console.log(cfg.path);
	});

	cfgCommand.command('get [key]')
		.description('print config values')
		.option('--mode [mode]', 'config mode', 'current')
		.option('--parsable', 'parsable output', false)
		.action((key, options) => {
			console.log(cfg.getPrintable(key, options));
		});

	cfgCommand.command('set <key> <value>')
		.description('set config value')
		.action((key, value) => {
			const error = cfg.failSet(key, value);
			if (error) {
				console.error(error);
				process.exit(1);
			}
			cfg.save();
			console.log(cfg.getPrintable(key));
		});

	cfgCommand.command('unset [key]')
		.description('delete config values')
		.action((key) => {
			cfg.unset(key);
			cfg.save();
			if (key === undefined) {
				console.log('Configuration file has been completely deleted.');
			} else {
				console.log(`Unset ${key}`);
			}
		});

	return cfgCommand;
}
