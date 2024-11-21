import {
	existsSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import {format} from 'node:util';
import {type ChalkInstance, Chalk} from 'chalk';
import ansiRegex from 'ansi-regex';
import {
	Types, type TypeValidator, TypeValidatorObject, TypeValidatorStruct,
} from './validate.js';
import {type Parser} from './parser.js';

/**
 * @throws If the message is a string.
 */
export function failThrow(Error: ErrorConstructor, message: string | undefined, options?: ErrorOptions) {
	if (typeof message !== 'string') {
		return;
	}

	throw new Error(message, options);
}

/**
 * Command-line configuration structure.
 */
export type ConfigRaw = Record<string, unknown>;

export function isConfigRaw(value: unknown): value is ConfigRaw {
	return value?.constructor === Object;
}

/**
 * `"real"` - values, with resolved default values.
 *
 * `"current"` - values provided in the config file.
 *
 * `"default"` - only default values, ignoring the configuration file.
 */
export type ConfigManagerGetMode = 'real' | 'current' | 'default';

export type ConfigManagerKeyListOptions = {
	/**
	 * Use default value as fallback.
	 * @default 'current'
	 */
	mode?: ConfigManagerGetMode;
};

export type ConfigManagerGetOptions = {
	/**
	 * Use default value as fallback.
	 * @default 'real'
	 */
	mode?: ConfigManagerGetMode;
};

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

export type ConfigOptions<ConfigType> = {
	/**
	 * @see You can use {@link https://www.npmjs.com/package/find-config?activeTab=readme  find-config} package for the path searching.
	 */
	path: string;
	/**
	 * Co
	 */
	type: TypeValidator<ConfigType>;
	/**
	 * @see yaml, jsonc, ini and other similar packages.
	 * @default JSON
	 */
	parser?: Parser;
};

/**
 * The configuration manager.
 */
export class Config<ConfigType = unknown> implements Required<ConfigOptions<ConfigType>> {
	public readonly path: string;
	public readonly parser: Parser;
	public readonly type: TypeValidator<ConfigType>;

	private data: unknown = {};

	constructor(options: ConfigOptions<ConfigType>) {
		this.path = options.path;
		this.parser = options.parser ?? JSON;
		this.type = options.type;
	}

	getData(): unknown {
		return structuredClone(this.data);
	}

	/**
     * Loads the config from the file in {@link path}.
     * @returns The error message for each invalid configuration key.
     */
	failLoad(): string | undefined {
		let parsed: unknown;
		try {
			parsed = existsSync(this.path) ? this.parser.parse(readFileSync(this.path).toString()) : undefined;
		} catch {
			return `Unable to parse: ${this.path}.`;
		}

		if (parsed === undefined) {
			return;
		}

		return this.type.fail(parsed);
	}

	/**
     * Loads the config from the file in {@link path}.
	 * @throws The error message for each invalid configuration key.
     */
	load() {
		failThrow(TypeError, this.failLoad());
	}

	/**
     * Saves the partial config to the file {@link path}. If there are no keys, the file will be deleted (if exists).
	 * @param keep Do not delete the config file, for empty data object.
     * @return Error message for invalid write operation.
     */
	failSave(keep = false): string | undefined {
		if ((this.type instanceof TypeValidatorStruct || this.type instanceof TypeValidatorObject) && this.keyList({mode: 'current'}).length === 0) {
			if (!existsSync(this.path) || keep) {
				return;
			}

			try {
				rmSync(this.path);
				return;
			} catch {
				return `Unuble to remove: ${this.path}.`;
			}
		}

		try {
			writeFileSync(this.path, this.parser.stringify(this.data));
		} catch {
			return `Unuble to write: ${this.path}.`;
		}
	}

	/**
     * Saves the partial config to the file {@link path}. If there are no keys, the file will be deleted (if exists).
	 * @param keep Do not delete the config file, for empty data object.
     * @throws Error message for invalid write operation.
     */
	save(keep = false) {
		failThrow(Error, this.failSave(keep));
	}

	/**
     * Sets a new value for the specified configuration key.
     * Expects a valid value.
     * @param key The name of the configuration key.
     * @param value The new value for the configuration key.
     */
	failSet<T extends keyof ConfigType>(key: T, value: ConfigType[T]): string | undefined;
	failSet(key: string, value: unknown): string | undefined;
	failSet(key: string, value: unknown): string | undefined {
		if (!((this.type instanceof TypeValidatorStruct || this.type instanceof TypeValidatorObject) && this.type.check(this.data, 0))) {
			return `Unable to set the key: '${key}'. The config is not an object.`;
		}

		this.data[key] = value;
	}

	/**
     * Sets a new value for the specified configuration key.
     * Expects a valid value.
     * @param key The name of the configuration key.
     * @param value The new value for the configuration key.
     */
	set<T extends keyof ConfigType>(key: T, value: ConfigType[T]): void;
	set(key: string, value: unknown): void;
	set(key: string, value: unknown): void {
		failThrow(TypeError, this.failSet(key, value));
	}

	/**
     * Deletes the specified configuration key from the config.
     * If the configuration key is not specified, then all properties will be deleted.
     * @param key The configuration key.
	 * @returns An error message if the key does not exist.
     */
	failUnset<T extends keyof ConfigType>(key?: T): string | undefined;
	failUnset(key?: string): string | undefined;
	failUnset(key?: string): string | undefined {
		if (!((this.type instanceof TypeValidatorStruct || this.type instanceof TypeValidatorObject) && this.type.check(this.data, 0))) {
			return `Unable to unset the key: '${key}'. The config is not an object.`;
		}

		if (key === undefined) {
			for (const key of this.keyList({mode: 'current'})) {
				delete this.data[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
			}

			return;
		}

		return delete this.data[key] ? undefined : `Unable to unset the key: '${key}'.`; // eslint-disable-line @typescript-eslint/no-dynamic-delete
	}

	/**
     * Deletes the specified configuration key from the config.
     * If the configuration key is not specified, then all properties will be deleted.
     * @param key The configuration key.
	 * @throws An error message if the key does not exist.
     */
	unset<T extends keyof ConfigType>(key?: T): void;
	unset(key?: string): void;
	unset(key?: string): void {
		failThrow(Error, this.failUnset(key));
	}

	/**
     * @returns An array of properties which defined in the configuration file.
     */
	keyList(options?: ConfigManagerKeyListOptions): string[] {
		const {data} = this;
		if (!(Types.object().check(data, 0) && (this.type instanceof TypeValidatorStruct || this.type instanceof TypeValidatorObject))) {
			throw new TypeError('Unable to list keys. The config is not an object.');
		}

		const {mode = 'current'} = options ?? {};
		if (mode === 'current') {
			return Object.keys(data);
		}

		if (mode === 'real') {
			return this.type instanceof TypeValidatorStruct
				? Array.from(Object.entries(this.type.properties).filter(([key, value]) => (data[key] ?? value) !== undefined)).map(([key]) => key)
				: Object.keys(data);
		}

		return this.type instanceof TypeValidatorStruct
			? Array.from(Object.entries(this.type.properties).filter(([, value]) => (value) !== undefined)).map(([key]) => key)
			: Object.keys(data);
	}

	/**
     * @param key The configuration key.
     * @param options The options.
     * @returns The value for the specified key.
     */
	get<T extends keyof ConfigType & string>(key: T, options?: ConfigManagerGetOptions): ConfigType[T] | undefined;
	get<T extends string>(key: T, options?: ConfigManagerGetOptions): ConfigType[keyof ConfigType] | undefined;
	get<T extends string>(key: T, options?: ConfigManagerGetOptions): ConfigType[keyof ConfigType] | undefined {
		if (!Types.object().check(this.data, 0)) {
			throw new TypeError('Unable to get the key or keys. The config is not an object.');
		}

		const {mode = 'real'} = options ?? {};

		let value = this.data[key] as ConfigType[keyof ConfigType] | undefined;
		if (mode === 'default' || (mode === 'real' && value === undefined)) {
			value = this.type.defaultVal?.[key as string as keyof ConfigType];
		}

		return value;
	}

	/**
     * @returns Printable properties string.
     */
	getPairString<T extends keyof ConfigType & string>(keys?: T | T[], options?: GetPairStringOptions): string;
	getPairString<T extends string>(keys?: T | T[], options?: GetPairStringOptions): string;
	getPairString<T extends string>(keys?: T | T[], options?: GetPairStringOptions): string {
		const {mode = 'current', types = true, syntax, parsable} = options ?? {};
		const {type} = this;
		if (type instanceof TypeValidatorStruct) {
			keys ??= this.keyList({mode}) as T[];

			if (typeof keys === 'string') {
				return this.getPairString([keys], options);
			}

			if (parsable) {
				return keys.map(key => {
					const value = format('%o', this.get(key, {mode}));
					if (types) {
						const {typeName} = type.properties[key];
						return `${key}\n${value}\n${typeName}`;
					}

					return `${key}\n${value}`;
				}).join('\n');
			}

			// eslint-disable-next-line unicorn/no-array-reduce
			const keyMaxLength: number = keys.reduce((maxLength, key) => Math.max(maxLength, key.length), 0);
			const chalk: ChalkInstance = syntax?.chalk ?? new Chalk();
			return keys.map((key): string => {
				const value = format('%o', this.get(key, {mode}));
				const {typeName} = type.properties[key];
				const pad = keyMaxLength - key.length;
				const line = types ? format(
					`${' '.repeat(pad)}%s ${this.highlight('=', syntax)} %s${this.highlight(':', syntax)} %s`,
					(syntax ? chalk.hex('#FFBC42')(key) : key),
					syntax ? this.highlight(value, syntax) : value,
					(syntax ? chalk.dim(this.highlight(typeName, syntax)) : typeName),
				) : format(
					`${' '.repeat(pad)}%s ${this.highlight('=', syntax)} %s`,
					(syntax ? chalk.hex('#FFBC42')(key) : key),
					syntax ? this.highlight(value, syntax) : value,
				);

				return line;
			}).join('\n');
		}

		if (parsable) {
			const value = format('%o', this.data);
			if (types) {
				const {typeName} = this.type;
				return `${value}\n${typeName}`;
			}

			return value;
		}

		const value = format('%o', this.data);
		const chalk: ChalkInstance = syntax?.chalk ?? new Chalk();
		const {typeName} = this.type;
		const line = types ? format(
			`%s${this.highlight(':', syntax)} %s`,
			(syntax ? chalk.hex('#FFBC42')(this.data) : this.data),
			syntax ? this.highlight(value, syntax) : value,
			(syntax ? chalk.dim(this.highlight(typeName, syntax)) : typeName),
		) : format(
			'%s',
			(syntax ? chalk.hex('#FFBC42')(this.data) : this.data),
			syntax ? this.highlight(value, syntax) : value,
		);

		return line;
	}

	/**
     * Add some colors for the syntax.
     * @see {@link getPairString}.
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
