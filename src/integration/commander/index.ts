import {format} from 'node:util';
import * as commander from 'commander';
import * as config from '../../index.js';
import {Types} from '../../types.js';

export const cfgRealOption = new commander.Option('--real', 'use default value(s) as fallback').default(false);
export const cfgTypesOption = new commander.Option('--types', 'show types').default(false);

export function initCommand<ConfigType extends Types.OptionalTypeAny>(cfg: config.Config<ConfigType>): commander.Command {
	const data = cfg.getData();
	const dataString = format('%o', data);

	if (!cfg.isObjectLike(undefined)) {
		throw new TypeError(`Can not initialize config command. Expected type: ${cfg.type.typeName}. Got: ${dataString}.`);
	}

	const cfgCommand = new commander.Command('config').aliases(['cfg']);

	cfgCommand
		.command('path').description('print the config file path')
		.action(wrapAction(cfg, actionCfgPath));

	const argumentConfigKeyValue = new commander.Argument('[pair]', 'config property value or just value, if the config is not an object');
	const argumentConfigKey = new commander.Argument('[key]', 'config property name');

	if (cfg.type instanceof Types.TypeValidatorStruct) {
		argumentConfigKey.choices(cfg.keyList({mode: 'default'}));
	}

	cfgCommand
		.command('set').description('set config values')
		.addArgument(argumentConfigKeyValue)
		.addOption(cfgRealOption)
		.addOption(cfgTypesOption)
		.action(wrapAction(cfg, actionCfgSet));
	cfgCommand
		.command('unset').description('delete config values, if specified, otherwise delete entire config')
		.addArgument(argumentConfigKey)
		.addOption(cfgRealOption)
		.addOption(cfgTypesOption)
		.action(wrapAction(cfg, actionCfgUnset));
	cfgCommand
		.command('get').description('print config values. You can use --real option to view real values')
		.addArgument(argumentConfigKey)
		.addOption(cfgRealOption)
		.addOption(cfgTypesOption)
		.action(wrapAction(cfg, actionCfgGet));

	return cfgCommand;
}

function wrapAction<ConfigType extends Types.ObjectLike>(
	cfg: config.Config<ConfigType>,
	action: (cfg: config.Config<ConfigType>, ...arguments_: any[]) => string,
): (...arguments_: any[]) => void {
	return (...arguments_: any[]) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		console.log(action(cfg, ...arguments_));
	};
}

function actionCfgPath<ConfigType extends Types.OptionalTypeAny>(cfg: config.Config<ConfigType>): string {
	return cfg.path;
}

function actionCfgSet<ConfigType extends Types.OptionalTypeAny>(
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

function actionCfgUnset<ConfigType extends Types.OptionalTypeAny>(
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

function actionCfgGet<ConfigType extends Types.OptionalTypeAny>(cfg: config.Config<ConfigType>, key: config.ConfigPair<ConfigType>[0] | undefined, options: config.ConfigGetOptions): string {
	return cfg.getPrintable(key, options);
}
