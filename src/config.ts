import {
	existsSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import {format} from 'node:util';
import {type ChalkInstance, Chalk} from 'chalk';
import {z} from 'zod';
import {highlight, type ConfigHighlightOptions} from './highlight.js';

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

export type Parser = {
	parse(text: string): unknown;
	stringify(value: unknown): string;
};

export type ConfigOptions<T extends z.ZodTypeAny> = {
	/**
	 * @see You can use the {@link https://www.npmjs.com/package/find-config?activeTab=readme  find-config} package for the path searching.
	 */
	path: string;
	/**
	 * Configuration schema validation.
	 */
	schema: T;
	/**
	 * @see yaml, jsonc, ini and other similar packages.
	 * @default JSON
	 */
	parser?: Parser;
};

/**
 * The configuration manager.
 */
export class Config<T extends z.ZodTypeAny> {
	public readonly path: string;
	public readonly parser: Parser;
	public readonly schema: T;

	private data: z.infer<T> | undefined;

	constructor(options: ConfigOptions<T>) {
		this.path = options.path;
		this.parser = options.parser ?? JSON;
		this.schema = options.schema;

		const result = this.schema.safeParse(undefined);
		if (result.success) {
			this.data = result.data;
		}
	}

	/**
	 * @returns A clone of the original data object.
	 */
	getData(): z.infer<T> | undefined {
		return structuredClone(this.data);
	}

	setData(data: z.infer<T>): void {
		this.data = data;
	}

	/**
     * Loads the config from the {@link path}, if satisfies the schema.
     * @returns The error message for each invalid configuration key.
     */
	failLoad(): string | undefined {
		let parsed: unknown;
		if (existsSync(this.path)) {
			try {
				parsed = this.parser.parse(readFileSync(this.path).toString());
			} catch {
				return `Unable to parse: ${this.path}.`;
			}
		} else {
			parsed = undefined;
		}

		const result = this.schema.safeParse(parsed);
		if (result.success) {
			this.data = result.data;
			return undefined;
		}

		return fromZodError(result.error);
	}

	/**
     * Loads the config from the {@link path}, if satisfies the schema.
	 * @throws The error message for each invalid configuration key.
     */
	load() {
		failThrow(TypeError, this.failLoad());
	}

	/**
	 * Checks if the schema is an object.
	 */
	isObject(): boolean {
		let s = this.schema;
		while (s instanceof z.ZodOptional || s instanceof z.ZodDefault || s instanceof z.ZodNullable) {
			s = s._def.innerType;
		}
		return s instanceof z.ZodObject;
	}

	/**
     * Saves the config to the {@link path}. If there are no keys (for objects), the file will be deleted.
	 * @param keep Do not delete the config file, for empty data object.
     * @return Error message for invalid write operation.
     */
	failSave(keep = false): string | undefined {
		const result = this.schema.safeParse(this.data);
		if (!result.success) {
			return fromZodError(result.error);
		}

		if (this.isObject() && Object.keys(this.data || {}).length === 0) {
			if (!existsSync(this.path) || keep) {
				return;
			}

			try {
				rmSync(this.path);
				return;
			} catch {
				return `Unable to remove: ${this.path}.`;
			}
		}

		try {
			writeFileSync(this.path, this.getDataString());
		} catch (error: any) {
			return `Unable to write: ${this.path}. ${error.message}`;
		}
	}

	/**
     * Saves the config to the file {@link path}.
	 * @param keep Do not delete the config file, for empty data object.
     * @throws Error message for invalid write operation.
     */
	save(keep = false) {
		failThrow(Error, this.failSave(keep));
	}

	/**
     * Sets a new value for the specified configuration key.
     * @param key The name of the configuration key.
     * @param value The new value for the configuration key.
     */
	failSet(key: string, value: unknown): string | undefined {
		let s = this.schema;
		while (s instanceof z.ZodOptional || s instanceof z.ZodDefault || s instanceof z.ZodNullable) {
			s = s._def.innerType;
		}

		if (!(s instanceof z.ZodObject)) {
			return `Unable to set the key: '${key}'. Schema is not an object.`;
		}

		const propertySchema = s.shape[key];
		if (!propertySchema) {
			if (s._def.unknownKeys === 'passthrough') {
				(this.data ||= {} as any)[key] = value;
				return;
			}
			return `Unable to set the key: '${key}'. Unknown property.`;
		}

		const result = propertySchema.safeParse(value);
		if (!result.success) {
			return `Unable to set the key: '${key}'. Got: ${format('%o', value)}. ${fromZodError(result.error)}`;
		}

		(this.data ||= {} as any)[key] = result.data;
	}

	/**
     * Sets a new value for the specified configuration key.
     * @param key The name of the configuration key.
     * @param value The new value for the configuration key.
     */
	set(key: string, value: unknown): void {
		failThrow(TypeError, this.failSet(key, value));
	}

	/**
     * Deletes the specified configuration key from the config.
     * If the configuration key is not specified, then all properties will be deleted.
     * @param key The configuration key.
	 * @returns An error message if the key does not exist.
     */
	failUnset(key?: string): string | undefined {
		if (!this.isObject()) {
			return `Unable to unset the key: '${key}'. Schema is not an object.`;
		}

		if (this.data === undefined) return;

		if (key !== undefined) {
			return delete (this.data as any)[key] ? undefined : `Unable to unset the key: '${key}'.`;
		}

		for (const k of Object.keys(this.data as any)) {
			delete (this.data as any)[k];
		}
	}

	/**
     * Deletes the specified configuration key from the config.
     * @param key The configuration key.
	 * @throws An error message if the key does not exist.
     */
	unset(key?: string): void {
		failThrow(Error, this.failUnset(key));
	}

	/**
     * @returns An array of properties which defined in the configuration.
     */
	keyList(options?: ConfigKeyListOptions): string[] {
		const {mode = 'current'} = options ?? {};

		let s = this.schema;
		while (s instanceof z.ZodOptional || s instanceof z.ZodDefault || s instanceof z.ZodNullable) {
			s = s._def.innerType;
		}

		if (!(s instanceof z.ZodObject)) {
			throw new TypeError('Unable to list keys. Schema is not an object.');
		}

		if (mode === 'default') {
			return Object.keys(s.shape);
		}

		if (mode === 'real') {
			const keys = new Set(Object.keys(s.shape));
			if (this.data) {
				for (const k of Object.keys(this.data as any)) {
					keys.add(k);
				}
			}
			return Array.from(keys);
		}

		// 'current'
		return this.data ? Object.keys(this.data as any) : [];
	}

	/**
     * @param key The configuration key.
     * @param options The options.
     * @returns The value for the specified key.
     */
	get(key: string, options?: ConfigGetOptions): unknown {
		if (!this.isObject()) {
			throw new TypeError('Unable to get the key. Schema is not an object.');
		}

		const {mode = 'real'} = options ?? {};

		if (mode === 'default') {
			const result = this.schema.safeParse(undefined);
			return result.success ? (result.data as any)?.[key] : undefined;
		}

		let value = (this.data as any)?.[key];
		if (mode === 'real' && value === undefined) {
			const result = this.schema.safeParse(undefined);
			if (result.success) {
				value = (result.data as any)?.[key];
			}
		}

		return value;
	}

	/**
	 * For command-line printing purposes.
     * @returns Printable properties string.
     */
	getPrintable(keys?: string | string[], options?: ConfigGetPrintableOptions): string {
		const {mode = 'current', types = true, syntax = {}, parsable} = options ?? {};

		if (this.isObject()) {
			keys ??= this.keyList({mode});

			if (typeof keys === 'string') {
				return this.getPrintable([keys], options);
			}

			if (parsable) {
				return keys.map(key => {
					const value = format('%o', this.get(key, {mode}));
					return `${key}\n${value}`;
				}).join('\n');
			}

			const keyMaxLength: number = keys.reduce((maxLength, key) => Math.max(maxLength, key.length), 0);
			const chalk: ChalkInstance = syntax?.chalk ?? new Chalk();
			return keys.map((key): string => {
				const value = format('%o', this.get(key, {mode}));
				const pad = keyMaxLength - key.length;

				const coloredKey = chalk.hex('#FFBC42')(key);
				const coloredValue = highlight(value, syntax);

				return format(
					`${' '.repeat(pad)}%s ${highlight('=', syntax)} %s`,
					coloredKey,
					coloredValue,
				);
			}).join('\n');
		}

		const value = format('%o', this.data);
		if (parsable) {
			return value;
		}

		const chalk: ChalkInstance = syntax?.chalk ?? new Chalk();
		const coloredKey = chalk.hex('#FFBC42')(String(this.data));
		const coloredValue = highlight(value, syntax);

		return format(
			'%s: %s',
			coloredKey,
			coloredValue,
		);
	}

	/**
	 * Stringify the config data with the schema checking.
	 */
	getDataString() {
		const result = this.schema.safeParse(this.data);
		if (!result.success) {
			throw new TypeError(fromZodError(result.error));
		}

		return this.parser.stringify(result.data);
	}
}

function fromZodError(error: z.ZodError): string {
	return error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
}
