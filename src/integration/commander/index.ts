import * as commander from 'commander';
import * as config from '../../index.js';
import {Types} from '../../types.js';

export type ArgumentClassAdapter = {
	prototype: ArgumentAdapter;
	new (argument: string, description?: string): ArgumentAdapter;
};
export type ArgumentAdapter = {
	choices(values: readonly string[]): ArgumentAdapter;
};

export type CommandClassAdapter = {
	prototype: CommandAdapter;
	new (argument: string, description?: string): CommandAdapter;
};
export type CommandAdapter = {
	addCommand(argument: CommandAdapter): CommandAdapter;
	addArgument(argument: ArgumentAdapter): CommandAdapter;
	addOption(option: OptionAdapter): CommandAdapter;
	action(action: () => any): CommandAdapter;
	aliases(aliases: string[]): CommandAdapter;
	description(description: string): CommandAdapter;
};

export type OptionClassAdapter = {
	prototype: OptionAdapter;
	new (argument: string, description?: string): OptionAdapter;
};
export type OptionAdapter = {
	default(value: any): OptionAdapter;
	choices(values: readonly string[]): OptionAdapter;
};

export type CommanderAdapter = {
	Argument: ArgumentClassAdapter;
	Command: CommandClassAdapter;
	Option: OptionClassAdapter;
};

export type Options = {
	adapter: CommanderAdapter;
};

/**
 * Object-like config only.
 */
export function initCommand<ConfigType extends Types.OptionalTypeAny, O extends Options>(cfg: config.Config<ConfigType>, options?: O): (O['adapter']['Command'])['prototype'] {
	const {adapter} = options ?? {};
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const {Command, Argument, Option} = adapter ?? commander as CommanderAdapter;

	const argumentConfigKeyValue = new Argument('[pair]', 'config property value or just value, if the config is not an object');
	const argumentConfigKey = new Argument('[key]', 'config property name');
	const cfgCommand = new Command('config').aliases(['cfg']);
	const cfgNoColorOption = new Option('--no-color', 'disable colors').default(false);
	const cfgTypesOption = new Option('--types', 'value types').default(false);
	const cfgParsableOption = new Option('--parsable', 'parsable output').default(false);
	const cfgModeOption = new Option('--mode [mode]', 'config mode').default('current' as config.ConfigGetMode).choices(['real', 'current', 'default']);

	const cfgCommandPath = new Command('path').description('print the config file path');
	const cfgCommandSet = new Command('set').description('set config values')
		.addArgument(argumentConfigKeyValue)
		.addOption(cfgModeOption)
		.addOption(cfgNoColorOption)
		.addOption(cfgParsableOption)
		.addOption(cfgTypesOption);
	const cfgCommandUnset = new Command('unset').description('delete config values, if specified, otherwise delete entire config')
		.addArgument(argumentConfigKey)
		.addOption(cfgModeOption)
		.addOption(cfgNoColorOption)
		.addOption(cfgParsableOption)
		.addOption(cfgTypesOption);
	const cfgCommandGet = new Command('get').description('print config values. You can use --real option to view real values')
		.addArgument(argumentConfigKey)
		.addOption(cfgModeOption)
		.addOption(cfgNoColorOption)
		.addOption(cfgParsableOption)
		.addOption(cfgTypesOption);

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

function wrapAction<ConfigType extends Types.OptionalTypeAny>(
	cfg: config.Config<ConfigType>,
	action: (cfg: config.Config<ConfigType>, ...arguments_: any[]) => string,
): (...arguments_: any[]) => void {
	return (...arguments_: any[]) => {
		const error = cfg.type.fail(cfg.getData());
		if (!cfg.isObjectLike(0)) {
			return `Configuration value is bad. ${error}`;
		}

		// // const options = arguments_.at(-2) as Record<string, unknown>;

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
