import {format} from 'node:util';
import * as yaml from 'yaml';

/**
 * Runtime type-checker.
 */
export class TypeValidator<T = any> {
	constructor(
		/**
         * The type name of the validator. Example: any, any[], string, integer, number.
         */
		public typeName: string,
		/**
         * Creates an error message string.
         */
		public fail: (value: unknown) => string | undefined,
		/**
         * Parses the argv and returns a value. Can throw.
         */
		public parse: (argv: string) => T,
	) {}

	/**
     * Throws an error instead of returning a message string.
     */
	public failThrow(value: unknown, ErrorClass: ErrorConstructor = Error): void {
		const message = this.fail(value);

		if (message) {
			throw new ErrorClass(message);
		}
	}

	/**
     * @param value The value to check.
     * @param error The error message for performance optimizations.
     */
	public check(value: unknown, error: string | undefined | 0): value is T {
		if (error === 0) {
			error = this.fail(value);
		}

		return error === undefined;
	}
}

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Types {
	/**
     * @public
     */
	export function any(): TypeValidator<unknown> {
		return new TypeValidator<unknown>(
			'any',
			value => {
				const validatorList = [array(), record(), boolean(), string(), number()];
				for (const validator of validatorList) {
					if (validator.check(value, validator.fail(value))) {
						return;
					}
				}

				return `Can not be represented as any: ${String(value)}.`;
			},
			argv => {
				const parsed: unknown = yaml.parse(argv) as unknown;
				const validator = any();
				const message = validator.fail(parsed);
				if (!validator.check(parsed, message)) {
					throw new Error(message);
				}

				return parsed;
			},
		);
	}

	/**
     * @public
     */
	export function array<T = unknown>(type?: TypeValidator<T>) {
		const validator = new TypeValidator<T[]>(
			`${type?.typeName ?? 'any'}[]`,
			value => {
				if (Array.isArray(value)) {
					if (type === undefined) {
						return;
					}

					const badElementList = value.map(element => type.fail(element)).filter(element => element !== undefined);
					if (badElementList.length > 0) {
						const list = badElementList.map((element, index) => `${index}: ${element}`).join('\n');
						return `The value should be a typed array. Found bad elements:\n${list}`;
					}

					return;
				}

				return 'The value should be an array.';
			},
			argv => argv.split(/[, ]/).map(element => (type ?? any()).parse(element)) as T[],
		);

		return validator;
	}

	/**
     * @public
     */
	export function literal<T extends string | number | boolean>(choices: Set<T>): TypeValidator<T> {
		const validator = new TypeValidator<T>(
			Array.from(choices, choice => format('%o', choice)).join('|'),
			value => {
				if (choices.has(value as T)) {
					return;
				}

				return `The value is invalid. Choices: ${Array.from(choices, String).join(', ')}.`;
			},
			(argv): T => {
				let value: string | number | boolean | undefined;
				const validatorList = [boolean(), number(), string()];
				for (const validator of validatorList) {
					if (validator.check(value, validator.fail(value))) {
						value = validator.parse(argv);
						break;
					}
				}

				const validator = literal(choices);
				const message = validator.fail(value as T);
				if (!literal(choices).check(value as T, message)) {
					throw new Error(message);
				}

				return value as T;
			},
		);

		return validator;
	}

	/**
     * @public
     */
	export function boolean() {
		return new TypeValidator<boolean>(
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
	}

	/**
     * @public
     */
	export function record<ValueT = unknown>(
		valueType = any() as TypeValidator<ValueT>,
	): TypeValidator<Record<string, ValueT>> {
		const validator = new TypeValidator<Record<string, ValueT>>(
			'object',
			value => {
				if (value?.constructor !== Object) {
					return 'The value should be an object.';
				}

				const object = value as Record<string | symbol | number, unknown>;

				for (const key in object) {
					if (!Object.hasOwn(object, key)) {
						continue;
					}

					const value = object[key];

					if (!valueType.check(value, 0)) {
						return `Invalid value type for the key ${key}, got ${String(value)}. Expected type: ${valueType.typeName}.`;
					}
				}
			},
			(argv): Record<string, ValueT> => {
				const parsed = yaml.parse(argv) as Record<string | number, ValueT>;
				const validator = record();
				const message = validator.fail(parsed);
				if (!validator.check(parsed, message)) {
					throw new TypeError(message);
				}

				return parsed;
			},
		);

		return validator;
	}

	/**
     * @public
     */
	export function string(): TypeValidator<string> {
		const validator = new TypeValidator<string>(
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
	}

	/**
     * @public
     */
	export function number(): TypeValidator<number> {
		const validator = new TypeValidator<number>(
			'number',
			value => {
				if (typeof value === 'number' && ((value < Number.MAX_SAFE_INTEGER && value > Number.MIN_SAFE_INTEGER) || Math.abs(value) === Infinity)) {
					return;
				}

				return 'The value should be a number.';
			},
			argv => {
				const validator = number();
				const parsed = Number(argv);
				const message = validator.fail(parsed);
				if (!validator.check(parsed, message)) {
					throw new Error(message);
				}

				return parsed;
			},
		);

		return validator;
	}

	/**
     * @public
     */
	export function integer(): TypeValidator<number> {
		const validator = new TypeValidator<number>(
			'integer',
			value => {
				if (number().fail(value) === undefined && Number.isInteger(value)) { // Add options for number validator here if provided
					return;
				}

				return 'The value should be an integer.';
			},
			argv => {
				const validator = number();
				const parsed = Number(argv);
				const message = validator.fail(parsed);
				if (!validator.check(parsed, message)) {
					throw new Error(message);
				}

				return parsed;
			},
		);

		return validator;
	}
}
