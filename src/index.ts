import {
	existsSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import {format} from 'node:util';
import * as yaml from 'yaml';
import {type ChalkInstance} from 'chalk';
import {type Command, type Option} from 'commander';
import ansiRegex from 'ansi-regex';

/**
 * For each property of the configuration we have an error message.
 * @public
 */
export type ConfigCheckMap<ConfigType extends ConfigRaw> = Map<keyof ConfigType, string>;

/**
 * @public
 */
export type ShowSourcesType = boolean;

/**
 * Checks if the value is the {@link ShowSourcesType}.
 * @public
 */
export function isShowSources(value: unknown): value is ShowSourcesType {
	return typeof value === 'boolean';
}

/**
 * Command-line configuration structure.
 * @see {@link configKeyList} Before adding new properties.
 * @public
 */
export type ConfigRaw = Record<string, unknown>;

export function isConfigRaw(value: unknown): value is ConfigRaw {
	return value?.constructor === Object;
}

export type ConfigValidator<T = unknown> = {
	typeName: string;
	getMessage(value: unknown): string | undefined;
	check(value: unknown, message: string | undefined): value is T;
};

export function createConfigValidator<T>(typeName: string, getMessage: (value: unknown) => string | undefined): ConfigValidator<T> {
	return {
		typeName,
		/**
         * @returns Error message or undefined if the value satisfies the type.
         */
		getMessage,
		check(value: unknown, error: string | undefined): value is T {
			return error === undefined;
		},
	};
}

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Validate {
	/**
     * @public
     */
	export const array = <T>(type?: ConfigValidator<T>) => {
		const validator: ConfigValidator<T[]> = createConfigValidator(
			`${type?.typeName ?? 'any'}[]`,
			value => {
				if (Array.isArray(value)) {
					if (type === undefined) {
						return;
					}

					const badElementList = value.map(element => type.getMessage(element)).filter(element => element !== undefined);
					if (badElementList.length > 0) {
						const list = badElementList.map((element, index) => `${index}: ${element}`).join('\n');
						return `The value should be a typed array. Found bad elements:\n${list}`;
					}

					return;
				}

				return 'The value should be an array.';
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const literal = <T extends string | number>(choices: T[]): ConfigValidator<T> => {
		const validator: ConfigValidator<T> = createConfigValidator(
			choices.map(choice => format('%o', choice)).join('|'),
			value => {
				if (choices.includes(value as T)) {
					return;
				}

				return `The value is invalid. Choices: ${choices.map(String).join(', ')}.`;
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const boolean = (): ConfigValidator<boolean> => {
		const validator: ConfigValidator<boolean> = createConfigValidator(
			'boolean',
			value => {
				if (typeof value === 'boolean') {
					return;
				}

				return 'The value should be a boolean.';
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const object = (): ConfigValidator<Record<string, unknown>> => {
		const validator: ConfigValidator<Record<string, unknown>> = createConfigValidator(
			'object',
			value => {
				if (value?.constructor === Object) {
					return;
				}

				return 'The value should be an object.';
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const string = (): ConfigValidator<string> => {
		const validator: ConfigValidator<string> = createConfigValidator(
			'string',
			value => {
				if (typeof value === 'string') {
					return;
				}

				return 'The value should be a string.';
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const number = (): ConfigValidator<number> => {
		const validator: ConfigValidator<number> = createConfigValidator(
			'number',
			value => {
				if (typeof value === 'number' && ((value > Number.MAX_SAFE_INTEGER && value < Number.MIN_SAFE_INTEGER) || Math.abs(value) === Infinity)) {
					return;
				}

				return 'The value should be a number.';
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const integer = (): ConfigValidator<number> => {
		const validator: ConfigValidator<number> = createConfigValidator(
			'integer',
			value => {
				if (number().getMessage(value) !== undefined || !Number.isInteger(value)) { // Add options for number validator here if provided
					return;
				}

				return 'The value should be an integer.';
			},
		);

		return validator;
	};
}

/**
 * @public
 */
export type ConfigManagerGetOptions = {
	/**
	 * Use default value as fallback.
	 * @default true
	 */
	real?: boolean;
};

/**
 * @public
 */
export type ConfigManagerGetPairStringOptions = ConfigManagerGetOptions & {
	/**
	 * Add the type postfix.
	 * @default true
	 */
	types?: boolean;

	/**
	 * Determine the colors behavior.
	 * @default undefined
	 */
	chalk?: ChalkInstance;

	/**
	 * Use parsable format. If enabled, `chalk` option ignored.
	 * @default false
	 */
	parsable?: boolean;
};

export type HighlightOptions = {
	/**
     * @default '#9999ff'
     */
	types: string;
	/**
     * @default '#73A7DE'
     */
	specials: string;
	/**
     * @default '#A2D2FF'
     */
	strings: string;
	/**
     * @default '#73DEA7'
     */
	numbers: string;
	/**
     * @default '#D81159'
     */
	separators: string;
	/**
     * @default '#B171D9'
     */
	squareBrackets: string;
};

/**
 * File-specific actions container.
 * @public
 */
export class Config<ConfigType extends ConfigRaw = ConfigRaw> {
	/**
	 * Do not change this value directly.
	 * @see {@link configManager}.
	 */
	private data: Record<string, unknown> = {};
	private readonly configValidation = new Map<keyof ConfigType, ConfigValidator>();
	private readonly cliOptionLinkMap = new Map<string, Option>();
	private readonly dataDefault: Record<string, unknown> = {};

	constructor(
		public readonly path: string,
	) {}

	/**
     * Get errors (if any) for every property if the value is an object. Otherwise returns the "bad object" message.
     */
	fail(data: unknown): ConfigCheckMap<ConfigType> | string {
		const propertyStack: ConfigCheckMap<ConfigType> = new Map();
		const object = data as Record<string, unknown>;
		if (object?.constructor !== Object) {
			return Validate.object().getMessage(object)!;
		}

		for (const key in object) {
			if (!Object.hasOwn(object, key)) {
				continue;
			}

			const value = object[key];

			const message = this.failValue<string>(key, value);
			if (message === undefined) {
				continue;
			}

			propertyStack.set(key, message);
		}

		return propertyStack;
	}

	/**
	 * Get type name for the key.
	 */
	getType<T extends keyof ConfigType>(key: T): string;
	getType(key: string): string;
	getType(key: string): string {
		return this.configValidation.get(key)?.typeName ?? 'any';
	}

	/**
	 * Get type checker for the key.
	 */
	getValidator<T extends keyof ConfigType>(key: T): ConfigValidator | undefined;
	getValidator(key: string): ConfigValidator | undefined {
		return this.configValidation.get(key);
	}

	/**
	 * Define type checker for the key.
	 */
	setValidator<T extends keyof ConfigType & string>(key: T, defaultValue: ConfigType[T], type: ConfigValidator): this {
		this.configValidation.set(key, type);
		const errorMessage = type.getMessage(defaultValue);
		if (errorMessage !== undefined) {
			throw new TypeError(`Invalid default value preset for configuration key ${format(key)} - ${errorMessage}`);
		}

		this.dataDefault[key] = defaultValue;
		return this;
	}

	/**
	 * Checks if the key is defined.
	 * @returns Error message if the key is not defined.
	 */
	failKey(key: string): string | undefined {
		if (this.configValidation.has(key)) {
			return;
		}

		return `Unknown config key '${key}'. Choices: ${Array.from(this.configValidation.keys()).join(', ')}`;
	}

	/**
	 * Call the type checker for the key.
	 */
	failValue<T extends keyof ConfigType>(key: T, value: unknown): string | undefined;
	failValue(key: string, value: unknown): string | undefined {
		const type = this.configValidation.get(key);
		if (type === undefined) {
			return;
		}

		return type.getMessage(value);
	}

	/**
	 * Link a configuration property with a command-line option.
	 */
	setOption<T extends keyof ConfigType>(key: T, command: Command, option: Option, parseArgument?: (argument: string) => unknown): this;
	setOption(key: string, command: Command, option: Option, parseArgument?: (argument: string) => unknown): this {
		if (parseArgument) {
			option.argParser(parseArgument);
		}

		const deflt = this.get(key);
		option.default(deflt);
		command.addOption(option);
		this.cliOptionLinkMap.set(key, option);
		return this;
	}

	/**
	 * Get a command-line option for the configuration property.
	 */
	getOption<T extends keyof ConfigType>(key: T): Option | undefined;
	getOption(key: string): Option | undefined;
	getOption(key: string): Option | undefined {
		return this.cliOptionLinkMap.get(key);
	}

	/**
     * Loads the config from the file {@link path}.
     * @returns The error message for each invalid property.
     */
	failLoad(): ConfigCheckMap<ConfigType> | string | undefined {
		const parsed: unknown = existsSync(this.path) ? yaml.parse(readFileSync(this.path).toString()) : undefined;
		if (parsed === undefined) {
			return;
		}

		const message = this.fail(parsed);

		if (typeof message === 'string') {
			return message;
		}

		const object = parsed as Record<string, unknown>;
		for (const key in object) {
			if (!Object.hasOwn(object, key) || message.has(key)) {
				continue;
			}

			const element = object[key];
			this.data[key] = element;
		}

		return message;
	}

	/**
     * Saves the partial config to the file. If there are no settings, the file will be deleted, if exists.
     * @return Error message for invalid write operation.
     */
	failSave(): string | undefined {
		if (Object.keys(this.data).length === 0) {
			if (existsSync(this.path)) {
				try {
					rmSync(this.path);
				} catch {
					return `Unuble to remove: ${this.path}`;
				}
			}

			return;
		}

		try {
			writeFileSync(this.path, yaml.stringify(this.data));
		} catch {
			return `Unuble to write: ${this.path}`;
		}
	}

	/**
     * Sets a new value for the specified config property.
     * Expects a valid value.
     * @param key The name of the config property.
     * @param value The new value for the config property.
     */
	failSet<T extends keyof ConfigType>(key: T, value: ConfigType[T]): string | undefined;
	failSet(key: string, value: unknown): string | undefined;
	failSet(key: string, value: unknown): string | undefined {
		const errorMessage = this.failValue(key, value);
		if (errorMessage !== undefined) {
			return errorMessage;
		}

		this.data[key] = value;
	}

	/**
     * Deletes the specified property from the config.
     * If the property is not specified, then all properties will be deleted.
     * @param key The config property.
     */
	failUnset<T extends keyof ConfigType>(key?: T): this;
	failUnset(key?: string): this;
	failUnset(key?: string): this {
		if (key === undefined) {
			for (const key of Object.keys(this.data)) {
				delete this.data[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
			}

			return this;
		}

		delete this.data[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
		return this;
	}

	/**
     * @returns An array of properties which defined in the configuration file.
     */
	keyList(real = true): Array<keyof ConfigType> {
		const keys = real ? Array.from(this.configValidation.keys()) : Object.keys(this.data);
		return keys;
	}

	/**
     * @param key The config property.
     * @param real The options.
     * @returns The value for the specified property.
     */
	get<T extends keyof ConfigType>(key: T, options: ConfigManagerGetOptions & {real?: false}): ConfigType[T] | undefined;
	get<T extends keyof ConfigType>(key: T, options?: ConfigManagerGetOptions & {real: true}): ConfigType[T];
	get(key: string, options?: ConfigManagerGetOptions): unknown;
	get(key: string, options?: ConfigManagerGetOptions): unknown {
		const {real = true} = options ?? {};
		let value: unknown = this.data[key];
		if (real && value === undefined) {
			value = this.dataDefault[key];
			if (value === undefined) {
				throw new Error(`Excpected default value for config property '${key}'.`);
			}
		}

		return value;
	}

	/**
     * @returns Printable properties string.
     */
	getPairString<T extends keyof ConfigType>(keys?: T | T[], options?: ConfigManagerGetPairStringOptions): string;
	getPairString(keys?: string | string[], options?: ConfigManagerGetPairStringOptions): string;
	getPairString(keys?: string | string[], options?: ConfigManagerGetPairStringOptions): string {
		const {real = true, types = true, chalk, parsable} = options ?? {};
		if (keys === undefined) {
			return this.getPairString(this.keyList(real), options);
		}

		if (typeof keys === 'string') {
			return this.getPairString([keys], options);
		}

		if (parsable) {
			return keys.map((key: string) => {
				const value = format('%o', this.get(key, options));
				if (types) {
					const type = this.getType(key);
					return `${key}\n${value}\n${type}`;
				}

				return `${key}\n${value}`;
			}).join('\n');
		}

		// eslint-disable-next-line unicorn/no-array-reduce
		const keyMaxLength: number = keys.reduce((maxLength, key) => Math.max(maxLength, key.length), 0);
		return keys.map((key: string): string => {
			const value = format('%o', this.get(key, options));
			const type = this.getType(key);
			const pad = keyMaxLength - key.length;
			const line = types ? format(
				`${' '.repeat(pad)}%s ${this.highlight('=', chalk)} %s${this.highlight(':', chalk)} %s`,
				(chalk ? chalk.hex('#FFBC42')(key) : key),
				chalk ? this.highlight(value, chalk) : value,
				(chalk ? chalk.dim(this.highlight(type, chalk)) : type),
			) : format(
				`${' '.repeat(pad)}%s ${this.highlight('=', chalk)} %s`,
				(chalk ? chalk.hex('#FFBC42')(key) : key),
				chalk ? this.highlight(value, chalk) : value,
			);

			return line;
		}).join('\n');
	}

	/**
     * Add some colors for the syntax.
     * @see {@link getPairString}.
     * @public
     */
	highlight(text: string, chalk?: ChalkInstance, options?: HighlightOptions): string {
		if (chalk === undefined) {
			return text;
		}

		const rtype = /^(?<=\s*)(switch|boolean|object|string|number|integer)(\[])*(?=\s*)$/;
		if (rtype.test(text)) {
			return chalk.hex(options?.types ?? '#9999ff')(text);
		}

		const rseparator = /([,.\-:="|])/g;
		const rstring = /'[^']+'/g;
		const rbracketsSquare = /(\[|])/g;
		const rnumber = /\d+/g;
		const rspecial = /(true|false|null|Infinity)/g;

		const rall = new RegExp(`${
			[ansiRegex(), rstring, rseparator, rbracketsSquare, rnumber, rspecial]
				.map(r => `(${typeof r === 'string' ? r : r.source})`)
				.join('|')
		}`, 'g');

		const colored = text.replaceAll(rall, match => {
			if (match.match(ansiRegex()) !== null) {
				return match;
			}

			if (match.match(rstring) !== null) {
				return match.replace(/^'[^']*'$/, chalk.hex(options?.strings ?? '#A2D2FF')('$&'));
			}

			if (match.match(rseparator) !== null) {
				return chalk.hex(options?.separators ?? '#D81159')(match);
			}

			if (match.match(rbracketsSquare) !== null) {
				return chalk.hex(options?.squareBrackets ?? '#B171D9')(match);
			}

			if (match.match(rnumber) !== null) {
				return chalk.hex(options?.numbers ?? '#73DEA7')(match);
			}

			if (match.match(rspecial) !== null) {
				return chalk.hex(options?.specials ?? '#73A7DE')(match);
			}

			return match;
		});
		return colored;
	}
}
