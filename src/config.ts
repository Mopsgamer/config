import {
	existsSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import {format} from 'node:util';
import * as yaml from 'yaml';
import {type ChalkInstance, Chalk} from 'chalk';
import ansiRegex from 'ansi-regex';
import {type TypeValidatorStruct} from './validate.js';

export function failThrow(Error: ErrorConstructor, message: string | undefined, options?: ErrorOptions) {
	if (typeof message !== 'string') {
		return;
	}

	throw new Error(message, options);
}

export type ShowSourcesType = boolean;

/**
 * Checks if the value is the {@link ShowSourcesType}.
 */
export function isShowSources(value: unknown): value is ShowSourcesType {
	return typeof value === 'boolean';
}

/**
 * Command-line configuration structure.
 */
export type ConfigRaw = {[K in string]: unknown};

export function isConfigRaw(value: unknown): value is ConfigRaw {
	return value?.constructor === Object;
}

export type ConfigManagerGetMode = 'real' | 'current' | 'default';

export type ConfigManagerKeyListOptions = ConfigManagerGetOptions;

export type ConfigManagerGetOptions = {
	/**
	 * Use default value as fallback.
	 * @default 'current'
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

/**
 * File-specific actions container.
 */
export class Config<ConfigType extends {[K in string]: unknown} = ConfigRaw> {
	private data: Record<string, unknown> = {};
	private readonly dataDefault: Record<string, unknown> = {};

	constructor(
		public readonly path: string,
		public readonly type: TypeValidatorStruct<ConfigType>,
	) {}

	/**
     * Loads the config from the file in {@link path}.
     * @returns The error message for each invalid configuration key.
     */
	failLoad(): string | undefined {
		const parsed: unknown = existsSync(this.path) ? yaml.parse(readFileSync(this.path).toString()) : undefined;
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
     * Saves the partial config to the file {@link path}. If there are no keys, the file will be deleted (if exists).
     * @throws Error message for invalid write operation.
     */
	save() {
		failThrow(Error, this.failSave());
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
		this.data[key] = value;
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
		if (key === undefined) {
			for (const key of Object.keys(this.data)) {
				delete this.data[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
			}

			return;
		}

		return delete this.data[key] ? undefined : `Unable to unset the key: ${key}`; // eslint-disable-line @typescript-eslint/no-dynamic-delete
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
	keyList(options?: ConfigManagerKeyListOptions): Array<keyof ConfigType & string> {
		const {mode = 'current'} = options ?? {};
		const keys = mode === 'current' ? Object.keys(this.data) : Array.from(Object.keys(this.type.properties));
		return keys;
	}

	/**
     * @param key The configuration key.
     * @param real The options.
     * @returns The value for the specified key.
     */
	get<T extends keyof ConfigType & string>(key: T, options: ConfigManagerGetOptions): ConfigType[T] | undefined;
	get<T extends keyof ConfigType & string>(key: T, options?: ConfigManagerGetOptions & {mode: 'real' | 'default'}): ConfigType[T];
	get<T extends keyof ConfigType & string>(key: T, options?: ConfigManagerGetOptions): ConfigType[T] | undefined {
		const {mode = 'current'} = options ?? {};

		let value = this.data[key as string] as ConfigType[T] | undefined;
		if (mode === 'default' || (mode === 'real' && value === undefined)) {
			value = this.dataDefault[key as string] as ConfigType[T] | undefined;
			if (value === undefined) {
				throw new Error(`Excpected default value for configuration key: ${String(key)}.`);
			}
		}

		return value;
	}

	/**
     * @returns Printable properties string.
     */
	getPairString<T extends keyof ConfigType & string>(keys?: T | T[], options?: GetPairStringOptions): string {
		const {mode = 'current', types = true, syntax, parsable} = options ?? {};
		if (keys === undefined) {
			return this.getPairString(this.keyList({mode}), options);
		}

		if (typeof keys === 'string') {
			return this.getPairString([keys], options);
		}

		if (parsable) {
			return keys.map(key => {
				const value = format('%o', this.get(key, {mode}));
				if (types) {
					const {typeName} = this.type.properties[key];
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
			const {typeName} = this.type.properties[key];
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
