/* eslint-disable @typescript-eslint/no-dynamic-delete */
import {
	existsSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import {format} from 'node:util';
import {type ChalkInstance, Chalk} from 'chalk';
import ansiRegex from 'ansi-regex';
import Types from './types.js';

/**
 * @returns Result and error string message from the thrower exception.
 */
export function failString<R>(thrower: () => R): [R | undefined, string | undefined] {
	try {
		return [thrower(), undefined];
	} catch (error: unknown) {
		return [undefined, String(error)];
	}
}

/**
 * @throws If the message is a string.
 */
export function failThrow(Error: ErrorConstructor, message: string | undefined, options?: ErrorOptions): typeof message extends string ? never : void {
	if (typeof message !== 'string') {
		return;
	}

	throw new Error(message, options);
}

export type ConfigPair<ConfigType extends Types.OptionalTypeAny>
= ConfigType extends Types.ObjectLike
	? [key: keyof ConfigType, value: ConfigType[keyof ConfigType]]
	: never;

/**
 * `"real"` - values, with resolved default values.
 *
 * `"current"` - values provided in the config file.
 *
 * `"default"` - only default values, ignoring the configuration file.
 */
export type ConfigGetMode = 'real' | 'current' | 'default';

export type ConfigKeyListOptions = {
	/**
	 * Use the default value as a fallback.
	 * @default 'current'
	 */
	mode?: ConfigGetMode;
};

export type ConfigGetOptions = {
	/**
	 * Use the default value as a fallback.
	 * @default 'real'
	 */
	mode?: ConfigGetMode;
};

export type ConfigGetPrintableOptions = {
	/**
	 * Use the default value as a fallback.
	 * @default 'current'
	 */
	mode?: ConfigGetMode;

	/**
	 * Add the type postfix.
	 * @default true
	 */
	types?: boolean;

	/**
	 * Custom color for the syntax highlighting.
	 */
	syntax?: ConfigHighlightOptions;

	/**
	 * Use the parsable format. If enabled, `chalk` option ignored.
	 * @default false
	 */
	parsable?: boolean;
};

/**
 * Custom color for the syntax highlighting.
 */
export type ConfigHighlightOptions = {
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
	/**
     * @default '#B171D9'
     */
	squareRound?: string;
	/**
     * @default '#B171D9'
     */
	squareAngle?: string;
};

export type ConfigOptions<ConfigType extends Types.OptionalTypeAny> = {
	/**
	 * @see You can use the {@link https://www.npmjs.com/package/find-config?activeTab=readme  find-config} package for the path searching.
	 */
	path: string;
	/**
	 * Configuration type check.
	 * @see {@link Types} have many useful methods.
	 */
	type: Types.TypeValidator<ConfigType>;
	/**
	 * @see yaml, jsonc, ini and other similar packages.
	 * @default JSON
	 */
	parser?: Types.Parser;
};

/**
 * The configuration manager.
 */
export class Config<ConfigType extends Types.OptionalTypeAny> implements Required<ConfigOptions<ConfigType>> {
	public readonly path;
	public readonly parser;
	public readonly type;

	private data: ConfigType | undefined;

	constructor(options: ConfigOptions<ConfigType>) {
		this.path = options.path;
		this.parser = options.parser ?? JSON;
		this.type = options.type;
		this.data = this.type.defaultVal;
	}

	/**
	 * @returns A clone of the original data object.
	 */
	getData(): unknown {
		return structuredClone(this.data);
	}

	setData(data: ConfigType): void {
		this.data = data;
	}

	/**
     * Loads the config from the {@link path}, if satisfies the type check.
     * @returns The error message for each invalid configuration key.
     */
	failLoad(): string | undefined {
		let parsed: unknown;
		try {
			parsed = existsSync(this.path) ? this.parser.parse(readFileSync(this.path).toString()) : this.type.defaultVal;
		} catch {
			return `Unable to parse: ${this.path}.`;
		}

		const message = this.type.fail(parsed) ?? this.type.fail(this.data);
		if (this.type.check(parsed, message)) {
			this.data = parsed;
		}

		return message;
	}

	/**
     * Loads the config from the {@link path}, if satisfies the type check.
	 * @throws The error message for each invalid configuration key.
     */
	load() {
		failThrow(TypeError, this.failLoad());
	}

	/**
	 * Checks if the data is object-like.
	 */
	isObjectLike(error: string | undefined | 0): this is Config<Types.ObjectLike> {
		const isStructOrObjectValidator = this.type.isObjectLike;
		const isValidDataValue = this.type.check(this.data, error);
		return isStructOrObjectValidator && isValidDataValue;
	}

	/**
     * Saves the partial config to the {@link path}. If there are no keys, the file will be deleted (if exists).
	 * @param keep Do not delete the config file, for empty data object.
     * @return Error message for invalid write operation.
     */
	failSave(keep = false): string | undefined {
		const error = this.type.fail(this.data);
		if (this.isObjectLike(error) && this.keyList({mode: 'current'}).length === 0) {
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
			writeFileSync(this.path, this.getDataString());
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
	failSet<T extends ConfigPair<Types.ObjectLike<ConfigType>>>(key: T[0], value: T[1]): string | undefined;
	failSet(key: string, value: unknown): string | undefined;
	failSet(key: string, value: unknown): string | undefined {
		if (!this.isObjectLike(undefined)) {
			return `Unable to set the key: '${key}'.`;
		}

		const error = this.type.fail(value);
		if (!this.type.check(value, error)) {
			return `Unable to set the key: '${key}'. Got: ${format('%o', value)}. ${error}`;
		}

		((this.data as Types.ObjectLike) ||= {})[key] = value;
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
	failUnset<T extends ConfigPair<ConfigType>>(key?: T[0]): string | undefined;
	failUnset(key?: string): string | undefined;
	failUnset(key?: string): string | undefined {
		const error = this.type.fail(this.data);
		if (!this.isObjectLike(error) || !this.data) {
			return `Unable to unset the key: '${key}'. ${error}`;
		}

		if (key !== undefined) {
			return delete this.data[key] ? undefined : `Unable to unset the key: '${key}'.`;
		}

		const deleteErrorList: string[] = [];
		for (const key of this.keyList({mode: 'current'})) {
			if (!delete this.data[key]) {
				deleteErrorList.push(key);
			}
		}

		if (deleteErrorList.length > 0) {
			return `Unable to unset keys: '${deleteErrorList.join('\', \'')}'.`;
		}
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
	keyList(options?: ConfigKeyListOptions): string[] {
		if (!this.isObjectLike(undefined)) {
			throw new TypeError('Unable to list keys.');
		}

		const {mode = 'current'} = options ?? {};

		if (mode === 'real' && this.type instanceof Types.TypeValidatorStruct) {
			return Array.from(Object.entries(this.type.properties).filter(
				([key, value]) => (this.data?.[key] ?? value) !== undefined,
			)).map(([key]) => key);
		}

		if (mode === 'default' && this.type instanceof Types.TypeValidatorStruct) {
			return Array.from(Object.entries(this.type.properties).filter(
				([, value]) => (value) !== undefined,
			)).map(([key]) => key);
		}

		// 'current'
		return this.data ? Object.keys(this.data) : [];
	}

	/**
     * @param key The configuration key.
     * @param options The options.
     * @returns The value for the specified key.
     */
	get<T extends keyof ConfigType>(key: T, options?: ConfigGetOptions): ConfigType[T];
	get(key: string, options?: ConfigGetOptions): unknown;
	get(key: string, options?: ConfigGetOptions): unknown {
		if (!this.isObjectLike(undefined)) {
			throw new TypeError('Unable to get the key or keys.');
		}

		const {mode = 'real'} = options ?? {};

		let value = ((this.data as Types.ObjectLike) ||= {})[key];
		if (mode === 'default' || (mode === 'real' && value === undefined)) {
			value = this.type.defaultVal![key];
		}

		return value;
	}

	/**
	 * For command-line printing purposes. Uses {@link format}, not {@link Types.defaultParser}.
     * @returns Printable properties string.
     */
	getPrintable<T extends ConfigPair<ConfigType>[0]>(keys?: T | T[], options?: ConfigGetPrintableOptions): string;
	getPrintable(keys?: string | string[], options?: ConfigGetPrintableOptions): string;
	getPrintable(keys?: string | string[], options?: ConfigGetPrintableOptions): string {
		const {mode = 'current', types = true, syntax = {}, parsable} = options ?? {};
		if (this.isObjectLike(0)) {
			const {type} = this;
			keys ??= this.keyList({mode});

			if (typeof keys === 'string') {
				return this.getPrintable([keys], options);
			}

			if (parsable) {
				return keys.map(key => {
					const value = format('%o', this.get(key, {mode}));
					if (types) {
						const {typeName} = type instanceof Types.TypeValidatorStruct
							? type.properties[key]
							: (type instanceof Types.TypeValidatorObject
								? type.valueType : type);
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
				const {typeName} = type instanceof Types.TypeValidatorStruct
					? type.properties[key]
					: (type instanceof Types.TypeValidatorObject
						? type.valueType : type);
				const pad = keyMaxLength - key.length;

				const coloredKey = chalk.hex('#FFBC42')(key);
				const coloredValue = highlight(value, syntax);
				if (types) {
					const coloredType = chalk.dim(highlight(typeName, syntax));
					return format(
						`${' '.repeat(pad)}%s ${highlight('=', syntax)} %s${highlight(':', syntax)} %s`,
						coloredKey,
						coloredValue,
						coloredType,
					);
				}

				return format(
					`${' '.repeat(pad)}%s ${highlight('=', syntax)} %s`,
					coloredKey,
					coloredValue,
				);
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

		const coloredKey = chalk.hex('#FFBC42')(this.data);
		const coloredValue = highlight(value, syntax);
		if (types) {
			const coloredType = chalk.dim(highlight(typeName, syntax));
			return format(
				`%s${highlight(':', syntax)} %s`,
				coloredKey,
				coloredValue,
				coloredType,
			);
		}

		return format(
			'%s',
			coloredKey,
			coloredValue,
		);
	}

	/**
	 * Stringify the config data with the type checking.
	 */
	getDataString() {
		const message = this.type.fail(this.data);
		if (!this.type.check(this.data, message)) {
			throw new TypeError(message);
		}

		return this.type.stringify(this.data as never);
	}
}

/**
 * For command-line printing purposes. Add some colors for the syntax.
 * @see {@link Config.getPrintable}.
 */
export function highlight(text: string, options?: ConfigHighlightOptions): string {
	const chalk = options?.chalk ?? new Chalk();

	const rtype = /^(?<=\s*)(switch|boolean|object|string|number|integer)(\[])*(?=\s*)$/;
	if (rtype.test(text)) {
		return chalk.hex(options?.types ?? '#9999ff')(text);
	}

	const rseparator = /([,.\-:="|])/g;
	const rstring = /'[^']+'/g;
	const rbracketsSquare = /(\[|])/g;
	const rbracketsRound = /(\(|\))/g;
	const rbracketsAngle = /(<|>)/g;
	const rnumber = /\d+/g;
	const rspecial = /(true|false|null|Infinity)/g;

	const rall = new RegExp(`${
		[ansiRegex(), rstring, rseparator, rbracketsSquare, rbracketsRound, rbracketsAngle, rnumber, rspecial]
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

		if (match.match(rbracketsRound) !== null) {
			return chalk.hex(options?.squareRound ?? '#B171D9')(match);
		}

		if (match.match(rbracketsAngle) !== null) {
			return chalk.hex(options?.squareAngle ?? '#B171D9')(match);
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
