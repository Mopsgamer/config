import {format} from 'node:util';
import * as yaml from 'yaml';

export type StringOptions = {
	/**
	 * @returns Error message.
	 */
	pattern?: RegExp | ((value: string) => string | undefined);
};

export type IntegerOptions = {
	min?: number;
	max?: number;
	/**
	 * @returns Error message.
	 */
	pattern?: RegExp | ((value: number, valueString: string) => string | undefined);
};

export type NumberOptions = IntegerOptions;

export type LiteralOptions<T> = {
	choices: Set<T>;
};

export type ArrayOptions<T> = {
	/**
	 * Type validator for the each element.
	 */
	elementType: TypeValidator<T>;
};

export type RecordOptions<T> = {
	/**
	 * Type validator for the each value.
	 */
	valueType: TypeValidator<T>;
};

export type DynamicPropertyCalculation<T = unknown> = {
	/**
	 * If undefined, the property is unexpected.
	 * @default undefined
	 */
	validator?: TypeValidator<T> | undefined;
	/**
	 * If enabled, overrides the {@link StructOptions.properties} validator.
	 * @default false
	 */
	override?: boolean;
	/**
	 * Additional error message for the unexpected key.
	 * @default undefined
	 */
	info?: string;
};

export type StructOptions<T extends Record<string, unknown>> = {
	/**
	 * Type validator for the each value.
	 */
	properties: TypeValidatorStructProperties<T>;
	/**
	 * Dynamic properties type checking.
	 * Can be used to allow unknown properties.
	 *
	 * If you are using it as a function you can get the value using `this[property]`.
	 */
	dynamicProperties?: DynamicPropertyCalculation | ((this: T, property: string) => DynamicPropertyCalculation | undefined);
};

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

export type TypeValidatorArrayOptions<T = unknown> = TypeValidatorOptions<T[]> & ArrayOptions<T>;

/**
 * Runtime type-checker
 */
export class TypeValidatorArray<T = unknown> extends TypeValidator<T[]> implements TypeValidatorArrayOptions<T> {
	public elementType: TypeValidator<T>;
	constructor(options: TypeValidatorArrayOptions<T>) {
		super(options);
		this.elementType = options.elementType;
	}
}

export type TypeValidatorRecordOptions<T = unknown> = TypeValidatorOptions<Record<string, T>> & RecordOptions<T>;

/**
 * Runtime type-checker
 */
export class TypeValidatorRecord<T = unknown> extends TypeValidator<Record<string, T>> implements TypeValidatorRecordOptions<T> {
	public valueType: TypeValidator<T>;
	constructor(options: TypeValidatorRecordOptions<T>) {
		super(options);
		this.valueType = options.valueType;
	}
}

export type TypeValidatorStructProperties<T extends Record<string, unknown> = Record<string, unknown>> = Record<keyof T, TypeValidator<T[keyof T]>>;
export type TypeValidatorStructOptions<T extends Record<string, unknown>> = TypeValidatorOptions<T> & StructOptions<T>;

/**
 * Runtime type-checker
 */
export class TypeValidatorStruct<T extends Record<string, unknown>> extends TypeValidator<T> implements TypeValidatorStructOptions<T> {
	public properties: TypeValidatorStructProperties<T>;
	public dynamicProperties: DynamicPropertyCalculation | ((property: string) => DynamicPropertyCalculation | undefined) | undefined;
	constructor(options: TypeValidatorStructOptions<T>) {
		super(options);
		this.properties = options.properties;
		this.dynamicProperties = options.dynamicProperties;
	}
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Types {
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

	export function array<T = unknown>(options?: ArrayOptions<T>): TypeValidatorArray<T> {
		const {elementType = any() as TypeValidator<T>} = options ?? {};
		const validator = new TypeValidatorArray<T>({
			elementType,
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
		});

		return validator;
	}

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

	export function struct<T extends Record<string, unknown>>(options: StructOptions<T>): TypeValidatorStruct<T> {
		const {properties, dynamicProperties} = options;
		const validator = new TypeValidatorStruct<T>({
			properties,
			dynamicProperties,
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

					const dynamic: DynamicPropertyCalculation = (
						typeof dynamicProperties === 'function'
							? dynamicProperties.apply(value as T, [key])
							: dynamicProperties
					) ?? {};

					const {override = false, validator, info} = dynamic;

					const propertyType: TypeValidator | undefined
					= override
						? validator ?? properties[key]
						: properties[key] ?? validator;

					if (!propertyType) {
						return `Unexpected key '${key}' for the struct.` + (info ? ' ' + info : '');
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
		});

		return validator;
	}

	export type ObjectOptions<ValueT = unknown> = {
		valueType: TypeValidator<ValueT>;
	};

	export function object<ValueT = unknown>(options?: ObjectOptions<ValueT>): TypeValidatorRecord<ValueT> {
		const {valueType = any() as TypeValidator<ValueT>} = options ?? {};
		const validator = new TypeValidatorRecord<ValueT>({
			valueType,
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
		});

		return validator;
	}

	export function string(options?: StringOptions): TypeValidator<string> {
		const {pattern} = options ?? {};
		const validator = new TypeValidator<string>({
			typeName: 'string',
			fail(value) {
				if (typeof value !== 'string') {
					return `Should be a string. Got '${String(value)}'.`;
				}

				if (pattern instanceof RegExp) {
					if (!pattern.test(value)) {
						return `Should satisfy the regex pattern: ${pattern.source}. Got '${value}'.`;
					}
				} else if (pattern) {
					const message = pattern(value);
					return `Should be a specific string. Got '${value}'. ${message}`;
				}
			},
			parse(argv) {
				return argv;
			},
		});

		return validator;
	}

	export function number(options?: NumberOptions): TypeValidator<number> {
		const {min = -Infinity, max = Infinity, pattern} = options ?? {};
		const validator = new TypeValidator<number>({
			typeName: 'number',
			fail(value) {
				const maximum = Math.min(max, Number.MAX_SAFE_INTEGER);
				const minimum = Math.max(min, Number.MIN_SAFE_INTEGER);
				const valueString = String(value);
				const error = `Should be a number: ${minimum} - ${maximum}. Got ${valueString}.`;

				if (typeof value !== 'number') {
					return error;
				}

				const minimax = (value <= maximum && value >= minimum);
				const infinit = (value === Infinity && max === Infinity) || (value === -Infinity && min === -Infinity);
				if (!(minimax || infinit)) {
					return error;
				}

				if (pattern instanceof RegExp) {
					if (!pattern.test(valueString)) {
						return `Should satisfy the regex pattern: ${pattern.source}. Got '${valueString}'.`;
					}
				} else if (pattern) {
					const message = pattern(value, valueString);
					return `Should be a specific string. Got '${valueString}'. ${message}`;
				}
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

	export function integer(options?: NumberOptions): TypeValidator<number> {
		const {min = -Infinity, max = Infinity} = options ?? {};
		const validator = new TypeValidator<number>({
			typeName: 'integer',
			fail(value) {
				if (number(options).fail(value) === undefined && Number.isInteger(value)) {
					return;
				}

				const maximum = Math.min(max, Number.MAX_SAFE_INTEGER);
				const minimum = Math.max(min, Number.MIN_SAFE_INTEGER);
				return `The value should be an integer: ${minimum} - ${maximum}. Got ${String(value)}.`;
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
