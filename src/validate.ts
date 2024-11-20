import {format} from 'node:util';
import * as yaml from 'yaml';

export type TypeValidatorOptions<T = unknown> = {
	/**
	 * The type name of the validator. Example: any, any[], string, integer, number.
	 */
	typeName: string;
	/**
	 * Creates an error message string.
	 */
	fail: (this: TypeValidator<T>, value: unknown) => string | undefined;
	/**
	 * Parses the argv and returns a value. Can throw.
	 */
	parse: (this: TypeValidator<T>, argv: string) => T;
};

/**
 * Runtime type-checker.
 */
export class TypeValidator<T = unknown> implements TypeValidatorOptions<T> {
	public typeName;
	public fail;
	public parse;
	constructor(options: TypeValidatorOptions<T>) {
		this.typeName = options.typeName;
		this.fail = options.fail.bind(this);
		this.parse = options.parse.bind(this);
	}

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

	toString(): string {
		return this.typeName;
	}
}

/**
 * Runtime type-checker
 */
export type TypeValidatorArray<T = unknown> = TypeValidator<T[]> & {
	elementType: TypeValidator<T>;
};

/*
 * Runtime type-checker
 */
export type TypeValidatorRecord<T = unknown> = TypeValidator<Record<string, T>> & {
	valueType: TypeValidator<T>;
};

/*
 * Runtime type-checker
 */
export type TypeValidatorStruct<PropertiesT extends Record<string, unknown>> = TypeValidator<PropertiesT> & {
	properties: Record<keyof PropertiesT, TypeValidator<PropertiesT[keyof PropertiesT]>>;
};

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Types {
	/**
     * @public
     */
	export function any(): TypeValidator {
		return new TypeValidator<unknown>({
			typeName: 'any',
			fail(value) {
				const validatorList = [array(), object(), boolean(), string(), number()];
				for (const validator of validatorList) {
					if (validator.check(value, validator.fail(value))) {
						return;
					}
				}

				return `Can not be represented as any: ${String(value)}.`;
			},
			parse(argv) {
				const parsed: unknown = yaml.parse(argv) as unknown;
				const message = this.fail(parsed);
				if (!this.check(parsed, message)) {
					throw new TypeError(message);
				}

				return parsed;
			},
		});
	}

	export type ArrayOptions<T = unknown> = {
		elementType?: TypeValidator<T>;
	};

	/**
     * @public
     */
	export function array<T = unknown>(options?: ArrayOptions<T>): TypeValidatorArray<T> {
		const {elementType = any() as TypeValidator<T>} = options ?? {};
		const validator = new TypeValidator<T[]>({
			typeName: `${elementType.typeName}[]`,
			fail(value) {
				if (!Array.isArray(value)) {
					return 'The value should be an array.';
				}

				const badElementList = value.map(element => elementType.fail(element)).filter(element => element !== undefined);
				if (badElementList.length > 0) {
					const list = badElementList.map((element, index) => `${index}: ${element}`).join('\n');
					return `The value should be a typed array. Found bad elements:\n${list}`;
				}
			},
			parse(argv) {
				return argv.split(/[, ]/).map(element => elementType.parse(element));
			},
		}) as TypeValidatorArray<T>;

		validator.elementType = elementType;

		return validator;
	}

	export type LiteralOptions<T> = {
		choices: Set<T>;
	};

	/**
     * @public
     */
	export function literal<T extends string | number | boolean | TypeValidator>(options: LiteralOptions<T>): TypeValidator<T> {
		const {choices} = options;
		const validator = new TypeValidator<T>({
			typeName: Array.from(choices, choice => {
				if (choice instanceof TypeValidator) {
					return choice.toString();
				}

				return format('%o', choice);
			}).join('|'),
			fail(value) {
				if (choices.has(value as T)) {
					return;
				}

				const choicesArray = Array.from(choices);
				const validatorList = choicesArray.filter(choice => choice instanceof TypeValidator);
				for (const validator of validatorList) {
					if (validator.check(value, 0)) {
						return;
					}
				}

				const list = choicesArray.map(String);
				const listLast = list.pop();
				return `The value should be ${list.join(', ')} or ${listLast}.`;
			},
			parse(argv) {
				let value: unknown;
				const validatorList = [
					...Array.from(choices).filter(choice => choice instanceof TypeValidator),
					boolean(),
					number(),
					string(),
				];
				for (const validator of validatorList) {
					if (validator.check(value, 0)) {
						value = validator.parse(argv);
						break;
					}
				}

				const message = this.fail(value as T);
				if (!this.check(value as T, message)) {
					throw new TypeError(message);
				}

				return value as T;
			},
		});

		return validator;
	}

	/**
     * @public
     */
	export function boolean() {
		return new TypeValidator<boolean>({
			typeName: 'boolean',
			fail(value) {
				if (typeof value === 'boolean') {
					return;
				}

				return 'The value should be a boolean.';
			},
			parse(argv) {
				const bool0 = ['false', '0'];
				const bool1 = ['true', '1'];
				if (bool0.includes(argv)) {
					return false;
				}

				if (bool1.includes(argv)) {
					return false;
				}

				throw new TypeError(`The value should be a boolean: ${bool1.concat(bool0).join(', ')}.`);
			},
		});
	}

	export type DynamicPropertyCalculation<T = unknown> = {
		/**
		 * If undefined, the property is unexpected.
		 * @default any()
		 */
		validator?: TypeValidator<T> | undefined;
		/**
		 * @default false
		 */
		override?: boolean;
	};

	export type StructOptions<T extends Record<string, unknown>> = {
		properties: TypeValidatorStruct<T>['properties'];
		/**
		 * Dynamic properties type checking.
		 * Can be used to allow unknown properties.
		 */
		dynamicProperties?: DynamicPropertyCalculation | ((property: string) => DynamicPropertyCalculation);
	};

	/**
     * @public
     */
	export function struct<T extends Record<string, unknown>>(options: StructOptions<T>): TypeValidatorStruct<T> {
		const {properties, dynamicProperties} = options;
		const validator = new TypeValidator<T>({
			typeName: 'struct',
			fail(value) {
				const objectValidator = object();
				const message = objectValidator.fail(value);
				if (!objectValidator.check(value, message)) {
					return message;
				}

				for (const key in value) {
					if (!Object.hasOwn(value, key)) {
						continue;
					}

					const {override = false, validator}
					= typeof dynamicProperties === 'function'
						? dynamicProperties(key) : dynamicProperties ?? {};

					const propertyType: TypeValidator | undefined
					= override
						? validator ?? properties[key]
						: properties[key] ?? validator;

					if (!propertyType) {
						return `Unexpected key '${key}' for the struct.`;
					}

					const message = propertyType.fail(value[key]);
					if (!propertyType.check(value, message)) {
						return `Bad value for key '${key}': ${message}`;
					}
				}

				const missingKeys = Object.keys(properties).filter(expectedKey => !Object.hasOwn(value, expectedKey));
				if (missingKeys.length > 0) {
					return `Missing keys for the struct: '${missingKeys.join('\', \'')}'.`;
				}
			},
			parse(argv) {
				const parsed = yaml.parse(argv) as Record<string | number, unknown>;
				const message = this.fail(parsed);
				if (!this.check(parsed, message)) {
					throw new TypeError(message);
				}

				return parsed;
			},
		}) as TypeValidatorStruct<T>;

		validator.properties = properties;

		return validator;
	}

	export type ObjectOptions<ValueT = unknown> = {
		valueType: TypeValidator<ValueT>;
	};

	/**
     * @public
     */
	export function object<ValueT = unknown>(options?: ObjectOptions<ValueT>): TypeValidatorRecord<ValueT> {
		const {valueType = any() as TypeValidator<ValueT>} = options ?? {};
		const validator = new TypeValidator<Record<string, ValueT>>({
			typeName: 'object',
			fail(value) {
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
			parse(argv) {
				const parsed = yaml.parse(argv) as Record<string | number, ValueT>;
				const message = this.fail(parsed);
				if (!this.check(parsed, message)) {
					throw new TypeError(message);
				}

				return parsed;
			},
		}) as TypeValidatorRecord<ValueT>;

		validator.valueType = valueType;

		return validator;
	}

	/**
     * @public
     */
	export function string(): TypeValidator<string> {
		const validator = new TypeValidator<string>({
			typeName: 'string',
			fail(value) {
				if (typeof value === 'string') {
					return;
				}

				return 'The value should be a string.';
			},
			parse(argv) {
				return argv;
			},
		});

		return validator;
	}

	/**
     * @public
     */
	export function number(): TypeValidator<number> {
		const validator = new TypeValidator<number>({
			typeName: 'number',
			fail(value) {
				if (typeof value === 'number' && ((value < Number.MAX_SAFE_INTEGER && value > Number.MIN_SAFE_INTEGER) || Math.abs(value) === Infinity)) {
					return;
				}

				return 'The value should be a number.';
			},
			parse(argv) {
				const parsed = Number(argv);
				const message = this.fail(parsed);
				if (!this.check(parsed, message)) {
					throw new TypeError(message);
				}

				return parsed;
			},
		});

		return validator;
	}

	/**
     * @public
     */
	export function integer(): TypeValidator<number> {
		const validator = new TypeValidator<number>({
			typeName: 'integer',
			fail(value) {
				if (number().fail(value) === undefined && Number.isInteger(value)) { // Add options for number validator here if provided
					return;
				}

				return 'The value should be an integer.';
			},
			parse(argv) {
				const parsed = Number(argv);
				const message = this.fail(parsed);
				if (!this.check(parsed, message)) {
					throw new TypeError(message);
				}

				return parsed;
			},
		});

		return validator;
	}
}
