import * as commander from 'commander';
import * as config from '../../index.js';
import {Types} from '../../types.js';

const cfgRealOption = new commander.Option('--real', 'use default value(s) as fallback').default(false);
const cfgTypesOption = new commander.Option('--types', 'show types').default(false);

/**
 * Object-like config only.
 */
export function initCommand<ConfigType extends Types.OptionalTypeAny>(cfg: config.Config<ConfigType>): commander.Command {
	const cfgCommand = new commander.Command('config').aliases(['cfg']);

	cfgCommand.addCommand(cfgCommandPath.action(wrapAction(cfg, actionCfgPath)));

	if (!cfg.isObjectLike(0)) {
		return cfgCommand;
	}

	if (cfg.type instanceof Types.TypeValidatorStruct && cfg.type.dynamicProperties === undefined) {
		argumentConfigKey.choices(cfg.keyList({mode: 'default'}));
	}

	cfgCommand.addCommand(cfgCommandSet.action(wrapAction(cfg, actionCfgSet)));
	cfgCommand.addCommand(cfgCommandUnset.action(wrapAction(cfg, actionCfgUnset)));
	cfgCommand.addCommand(cfgCommandGet.action(wrapAction(cfg, actionCfgGet)));

	return cfgCommand;
}

const argumentConfigKeyValue = new commander.Argument('[pair]', 'config property value or just value, if the config is not an object');
const argumentConfigKey = new commander.Argument('[key]', 'config property name');

const cfgCommandPath = new commander.Command('path').description('print the config file path');
const cfgCommandSet = new commander.Command('set').description('set config values')
	.addArgument(argumentConfigKeyValue)
	.addOption(cfgRealOption)
	.addOption(cfgTypesOption);
const cfgCommandUnset = new commander.Command('unset').description('delete config values, if specified, otherwise delete entire config')
	.addArgument(argumentConfigKey)
	.addOption(cfgRealOption)
	.addOption(cfgTypesOption);
const cfgCommandGet = new commander.Command('get').description('print config values. You can use --real option to view real values')
	.addArgument(argumentConfigKey)
	.addOption(cfgRealOption)
	.addOption(cfgTypesOption);

function wrapAction<ConfigType extends Types.OptionalTypeAny>(
	cfg: config.Config<ConfigType>,
	action: (cfg: config.Config<ConfigType>, ...arguments_: any[]) => string,
): (...arguments_: any[]) => void {
	return (...arguments_: any[]) => {
		const error = cfg.type.fail(cfg.getData());
		if (!cfg.isObjectLike(0)) {
			return `Configuration is not object-like. ${error}`;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		console.log(action(cfg, ...arguments_));
	};
}

function actionCfgPath<ConfigType extends Types.OptionalTypeAny>(cfg: config.Config<ConfigType>): string {
	return cfg.path;
}

function actionCfgSet<ConfigType extends Types.ObjectLike>(
	cfg: config.Config<ConfigType>,
	pair: string | undefined,
	options: config.ConfigGetPrintableOptions,
): string {
	if (pair === undefined) {
		return cfg.getPrintable(undefined, options);
	}

	const [key_, value_] = pair.split('=');
	const key = key_ as keyof ConfigType & string;
	if (!cfg.keyList().includes(key)) {
		return '';
	}

	const [value, error] = config.failString(() => cfg.type.parse(value_));
	if (error !== undefined) {
		return error;
	}

	const errorMessage = cfg.failSet(key, value);
	if (errorMessage !== undefined) {
		return errorMessage;
	}

	cfg.save();
	return cfg.getPrintable(key, options);
}

function actionCfgUnset<ConfigType extends Types.ObjectLike>(
	cfg: config.Config<ConfigType>,
	key: string | undefined,
	options: config.ConfigGetOptions,
): string {
	const errorMessage = cfg.failUnset(key);
	if (errorMessage !== undefined) {
		return errorMessage;
	}

	cfg.save();
	if (key === undefined) {
		return 'Configuration file has been completely deleted.';
	}

	return cfg.getPrintable(key, options);
}

function actionCfgGet<ConfigType extends Types.ObjectLike>(cfg: config.Config<ConfigType>, key: config.ConfigPair<ConfigType>[0] | undefined, options: config.ConfigGetOptions): string {
	return cfg.getPrintable(key, options);
}
