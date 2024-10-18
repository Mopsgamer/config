import {
	existsSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import {format} from 'node:util';
import * as yaml from 'yaml';
import {type ChalkInstance, Chalk} from 'chalk';
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

export class ConfigValidator<T = any> {
	constructor(
		public typeName: string,
		public getMessage: (value: unknown) => string | undefined,
		public parse: (value: string) => T,
	) {}

	check(value: unknown, error: string | undefined): value is T {
		return error === undefined;
	}
}

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Validate {
	/**
     * @public
     */
	export const any = new ConfigValidator<any>(
		'any',
		value => {
			const validatorList = [array(), object(), boolean, string(), number()];
			for (const validator of validatorList) {
				if (validator.check(value, validator.getMessage(value))) {
					return;
				}
			}

			return `Can not be represented as any: ${String(value)}.`;
		},
		argv => {
			const parsed: any = yaml.parse(argv) as unknown;
			const validator = any;
			const message = validator.getMessage(parsed);
			if (!validator.check(parsed, message)) {
				throw new Error(message);
			}

			return parsed; // eslint-disable-line @typescript-eslint/no-unsafe-return
		},
	);
	/**
     * @public
     */
	export const array = <T = any>(type?: ConfigValidator<T>) => {
		const validator = new ConfigValidator<T[]>(
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
			(argv): any => argv.split(/[, ]/).map(element => (type ?? any).parse(element)), // eslint-disable-line @typescript-eslint/no-unsafe-return
		);

		return validator;
	};

	/**
     * @public
     */
	export const literal = <T extends string | number | boolean>(choices: T[]): ConfigValidator<T> => {
		const validator = new ConfigValidator<T>(
			choices.map(choice => format('%o', choice)).join('|'),
			value => {
				if (choices.includes(value as T)) {
					return;
				}

				return `The value is invalid. Choices: ${choices.map(String).join(', ')}.`;
			},
			(argv): T => {
				let value: string | number | boolean | undefined;
				const validatorList = [boolean, number(), string()];
				for (const validator of validatorList) {
					if (validator.check(value, validator.getMessage(value))) {
						value = validator.parse(argv);
						break;
					}
				}

				const validator = literal(choices);
				const message = validator.getMessage(value as T);
				if (!literal(choices).check(value as T, message)) {
					throw new Error(message);
				}

				return value as T;
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const boolean = new ConfigValidator<boolean>(
		'boolean',
		value => {
			if (typeof value === 'boolean') {
				return;
			}

			return 'The value should be a boolean.';
		},
		argv => {
			const bool0 = ['false', '0'];
			const bool1 = ['true', '1'];
			if (bool0.includes(argv)) {
				return false;
			}

			if (bool1.includes(argv)) {
				return false;
			}

			throw new Error(`The value should be a boolean: ${bool1.concat(bool0).join(', ')}.`);
		},
	);

	/**
     * @public
     */
	export const object = <KeyT extends string = string, ValueT = unknown>(): ConfigValidator<Record<KeyT, ValueT>> => {
		const validator = new ConfigValidator<Record<KeyT, ValueT>>(
			'object',
			value => {
				if (value?.constructor === Object) {
					return;
				}

				return 'The value should be an object.';
			},
			(argv): Record<KeyT, ValueT> => {
				const parsed = yaml.parse(argv) as Record<KeyT, ValueT>;
				const validator = object();
				const message = validator.getMessage(parsed);
				if (!validator.check(parsed, message)) {
					throw new Error(message);
				}

				return parsed;
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const string = (): ConfigValidator<string> => {
		const validator = new ConfigValidator<string>(
			'string',
			value => {
				if (typeof value === 'string') {
					return;
				}

				return 'The value should be a string.';
			},
			argv => argv,
		);

		return validator;
	};

	/**
     * @public
     */
	export const number = (): ConfigValidator<number> => {
		const validator = new ConfigValidator<number>(
			'number',
			value => {
				if (typeof value === 'number' && ((value > Number.MAX_SAFE_INTEGER && value < Number.MIN_SAFE_INTEGER) || Math.abs(value) === Infinity)) {
					return;
				}

				return 'The value should be a number.';
			},
			argv => {
				const validator = number();
				const parsed = Number(argv);
				const message = validator.getMessage(parsed);
				if (!validator.check(parsed, message)) {
					throw new Error(message);
				}

				return parsed;
			},
		);

		return validator;
	};

	/**
     * @public
     */
	export const integer = (): ConfigValidator<number> => {
		const validator = new ConfigValidator<number>(
			'integer',
			value => {
				if (number().getMessage(value) !== undefined || !Number.isInteger(value)) { // Add options for number validator here if provided
					return;
				}

				return 'The value should be an integer.';
			},
			argv => {
				const validator = number();
				const parsed = Number(argv);
				const message = validator.getMessage(parsed);
				if (!validator.check(parsed, message)) {
					throw new Error(message);
				}

				return parsed;
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
export type GetPairStringOptions = ConfigManagerGetOptions & {
	/**
	 * Add the type postfix.
	 * @default true
	 */
	types?: boolean;

	/**
	 * Custom color for the syntax highlighting.
	 */
	syntax: HighlightOptions;

	/**
	 * Use parsable format. If enabled, `chalk` option ignored.
	 * @default false
	 */
	parsable?: boolean;
};

/**
 * Custom color for the syntax highlighting.
 */
export type HighlightOptions = {
	/**
	 * Determine the colors behavior.
	 * @default undefined
	 */
	chalk?: ChalkInstance;
	/**
     * @default '#9999ff'
     */
	types?: string;
	/**
     * @default '#73A7DE'
     */
	specials?: string;
	/**
     * @default '#A2D2FF'
     */
	strings?: string;
	/**
     * @default '#73DEA7'
     */
	numbers?: string;
	/**
     * @default '#D81159'
     */
	separators?: string;
	/**
     * @default '#B171D9'
     */
	squareBrackets?: string;
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
	getPairString<T extends keyof ConfigType>(keys?: T | T[], options?: GetPairStringOptions): string;
	getPairString(keys?: string | string[], options?: GetPairStringOptions): string;
	getPairString(keys?: string | string[], options?: GetPairStringOptions): string {
		const {real = true, types = true, syntax, parsable} = options ?? {};
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
		const chalk: ChalkInstance = syntax?.chalk ?? new Chalk();
		return keys.map((key: string): string => {
			const value = format('%o', this.get(key, options));
			const type = this.getType(key);
			const pad = keyMaxLength - key.length;
			const line = types ? format(
				`${' '.repeat(pad)}%s ${this.highlight('=', syntax)} %s${this.highlight(':', syntax)} %s`,
				(syntax ? chalk.hex('#FFBC42')(key) : key),
				syntax ? this.highlight(value, syntax) : value,
				(syntax ? chalk.dim(this.highlight(type, syntax)) : type),
			) : format(
				`${' '.repeat(pad)}%s ${this.highlight('=', syntax)} %s`,
				(syntax ? chalk.hex('#FFBC42')(key) : key),
				syntax ? this.highlight(value, syntax) : value,
			);

			return line;
		}).join('\n');
	}

	/**
     * Add some colors for the syntax.
     * @see {@link getPairString}.
     * @public
     */
	highlight(text: string, options?: HighlightOptions): string {
		const chalk = options?.chalk ?? new Chalk();
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
