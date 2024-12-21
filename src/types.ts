import {format} from 'node:util';

/**
 * Run-time type ckecking.
*/
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Types {
	export type Parser = {
		parse(text: string): unknown;
		stringify(value: unknown): string;
	};

	export type OptionalForOptions<T extends OptionalTypeAny, O extends undefined | TypeOptions> = O extends {optional: true} ? OptionalType<T> : T;
	export type OptionalType<T extends OptionalTypeAny> = undefined | T;
	// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style, @typescript-eslint/consistent-type-definitions
	export interface ObjectLike<ValueT extends OptionalTypeAny = OptionalTypeAny> {
		[x: string | number | symbol]: ValueT;
	}
	export type LowType = string | number | boolean | TypeValidator;
	export type AnyType = LowType | ObjectLike | AnyType[] | Date;
	export type OptionalTypeAny = OptionalType<AnyType>;

	/**
	 * Describes methods of the {@link TypeValidator}.
	 * Not all file formats are supporting the `undefined`, so it may not work for normal JSON or some other parsers.
	 * @see {@link TypeValidator.parse} is a wrapper with the type checking.
	 * @default JSON
	 */
	export const defaultParser: Parser = JSON;

	export type TypeOptions<T extends OptionalTypeAny = OptionalTypeAny> = {
		/**
		 * Allow `undefined`.
		 */
		optional?: boolean;
		/**
		 * Describes methods of the {@link TypeValidator}.
		 * Not all file formats are supporting the `undefined`, so it may not work for normal JSON or some other parsers.
		 * @see {@link TypeValidator.parse} is a wrapper with the type checking.
		 * @default Types.defaultParser
		 */
		parser?: Parser;
		/**
		 * The default value.
		 */
		defaultVal?: T;
	};

	export type AnyOptions = TypeOptions;
	export type BooleanOptions = TypeOptions<boolean>;

	export type StringOptions = TypeOptions<string> & {
		/**
		 * @returns Error message.
		 */
		pattern?: RegExp | ((value: string) => string | undefined);
	};

	export type IntegerOptions = TypeOptions<number> & {
		min?: number;
		max?: number;
		/**
		 * @returns Error message.
		 */
		pattern?: RegExp | ((value: number, valueString: string) => string | undefined);
	};

	export type NumberOptions = IntegerOptions;

	export type LiteralOptions<T extends LowType | TypeValidator> = TypeOptions<T> & {
		choices: Set<T>;
	};

	export type ArrayOptions<T extends AnyType = AnyType> = TypeOptions<T[]> & {
		/**
		 * Type validator for the each element.
		 */
		elementType: TypeValidator<T>;
	};

	export type ObjectOptions<T extends ObjectLike = ObjectLike> = TypeOptions<T> & {
		/**
		 * Type validator for the each value.
		 */
		valueType: TypeValidator<T[keyof T]>;
	};

	export type DynamicPropertyCalculation<T extends ObjectLike = ObjectLike> = {
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

	export type StructOptions<T extends ObjectLike> = Omit<TypeOptions<T>, 'defaultVal'> & {
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

	export type DateOptions = TypeOptions<Date>;

	export type TypeValidatorOptions<T extends OptionalTypeAny = OptionalTypeAny> = TypeOptions<T> & {
		/**
		 * The default value.
		 */
		defaultVal?: T | undefined;
		/**
		 * The type name of the validator. Example: any, any[], string, integer, number.
		 */
		typeName: string;
		/**
		 * Creates an error message string.
		 */
		fail: (this: TypeValidator<T>, value: unknown) => string | undefined;
		/**
		 * Convert value after parsing.
		 */
		afterParse?: (this: TypeValidator<T>, value: unknown) => T;
	};

	/**
	 * Runtime type-checker.
	 */
	export class TypeValidator<T extends OptionalTypeAny = OptionalTypeAny> implements TypeValidatorOptions<T> {
		public parser;
		public optional;
		public defaultVal?: T;
		public typeName;
		public fail;
		public readonly afterParse;
		constructor(options: TypeValidatorOptions<T>) {
			this.defaultVal = options.defaultVal;
			this.optional = options.optional ?? false;
			this.parser = options.parser ?? defaultParser;
			this.typeName = options.typeName;
			this.fail = function (value: unknown) {
				if (value === undefined && this.optional) {
					return;
				}

				return options.fail.bind(this)(value);
			};

			this.afterParse = options.afterParse?.bind(this);
		}

		/**
		 * @param value The value to check.
		 * @param error The error message for performance optimizations.
		 */
		public check(value: unknown, error: string | undefined | 0): value is (OptionalForOptions<T, typeof this>) {
			if (error === 0) {
				error = this.fail(value);
			}

			return error === undefined;
		}

		/**
		 * Parses the value (expects process.argv) and checks the type.
		 * @throws A {@link TypeError}, if the values does not satisfy the type, or an exception from the {@link Parser.parse} method.
		 */
		parse(argv: string) {
			let parsed = this.parser.parse(argv);
			if (this.afterParse) {
				parsed = this.afterParse(parsed);
			}

			const message = this.fail(parsed);
			if (!this.check(parsed, message)) {
				throw new TypeError(message);
			}

			return parsed;
		}

		stringify(value: T) {
			return this.parser.stringify(value);
		}

		toString(): string {
			return this.typeName;
		}
	}

	export type TypeValidatorArrayOptions<T extends AnyType = AnyType> = TypeValidatorOptions<T[]> & ArrayOptions<T>;

	/**
	 * Runtime type-checker
	 */
	export class TypeValidatorArray<T extends AnyType = AnyType> extends TypeValidator<T[]> implements TypeValidatorArrayOptions<T> {
		public elementType: TypeValidator<T>;
		constructor(options: TypeValidatorArrayOptions<T>) {
			super(options);
			this.elementType = options.elementType;
		}
	}

	export type TypeValidatorObjectOptions<T extends ObjectLike = ObjectLike> = TypeValidatorOptions<T> & ObjectOptions<T>;

	/**
	 * Runtime type-checker
	 */
	export class TypeValidatorObject<T extends ObjectLike = ObjectLike> extends TypeValidator<T> implements TypeValidatorObjectOptions<T> {
		public valueType: TypeValidator<T[keyof T]>;
		constructor(options: TypeValidatorObjectOptions<T>) {
			super(options);
			this.valueType = options.valueType;
		}
	}

	export type TypeValidatorStructProperties<T extends ObjectLike = ObjectLike> = Record<keyof T, TypeValidator<T[keyof T]>>;
	export type TypeValidatorStructOptions<T extends ObjectLike> = Omit<TypeValidatorOptions<T> & StructOptions<T>, 'defaultVal'>;

	/**
	 * Runtime type-checker
	 */
	export class TypeValidatorStruct<T extends ObjectLike> extends TypeValidator<T> implements TypeValidatorStructOptions<T> {
		public defaultVal: T;
		public properties: TypeValidatorStructProperties<T>;
		public dynamicProperties: DynamicPropertyCalculation | ((property: string) => DynamicPropertyCalculation | undefined) | undefined;
		constructor(options: TypeValidatorStructOptions<T>) {
		// eslint-disable-next-line unicorn/prevent-abbreviations
			const defaultVal = Object.fromEntries(Object.entries(options.properties).map(([key, type]) => [key, type.defaultVal])) as T;
			super({...options, defaultVal});
			this.defaultVal = defaultVal;
			this.properties = options.properties;
			this.dynamicProperties = options.dynamicProperties;
		}
	}

	export function any(options?: AnyOptions): TypeValidator {
		const {defaultVal, optional, parser} = options ?? {};
		return new TypeValidator({
			defaultVal,
			optional,
			parser,
			typeName: 'any',
			fail(value) {
				const validatorList = [array(), object(), boolean(), string(), number()];
				for (const validator of validatorList) {
					if (validator.check(value, validator.fail(value))) {
						return;
					}
				}

				return `Can not be represented as any. Got: ${format('%o', value)}.`;
			},
		});
	}

	export function array<T extends AnyType>(options?: ArrayOptions<T>): TypeValidatorArray<T> {
		const {defaultVal, optional, parser, elementType = any() as TypeValidator<T>} = options ?? {};
		const validator = new TypeValidatorArray<T>({
			defaultVal,
			optional,
			parser,
			elementType,
			typeName: `array<${elementType.typeName}>`,
			fail(value) {
				if (!Array.isArray(value)) {
					return 'The value should be an array.';
				}

				const massageList = value.map(element => elementType.fail(element)).filter(message => message !== undefined);
				if (massageList.length > 0) {
					const list = massageList.map((message, index) => `Element ${index}: ${message}`).join('\n\n');
					return `The value should be a typed array. Found bad elements:\n${list}`;
				}
			},
		});

		return validator;
	}

	export function literal<T extends LowType | TypeValidator>(options: LiteralOptions<T>): TypeValidator<T> {
		const {defaultVal, optional, parser, choices} = options;
		const validator = new TypeValidator<T>({
			defaultVal,
			optional,
			parser,
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
		});

		return validator;
	}

	export function struct<T extends ObjectLike>(options: StructOptions<T>): TypeValidatorStruct<T> {
		const {properties, optional, parser, dynamicProperties} = options;
		const validator = new TypeValidatorStruct<T>({
			properties,
			dynamicProperties,
			optional,
			parser,
			typeName: 'struct',
			fail(value) {
				const objectValidator = object();
				const objectValidationMessage = objectValidator.fail(value);
				if (!objectValidator.check(value, objectValidationMessage)) {
					return objectValidationMessage;
				}

				const errorList: string[] = [];
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
						errorList.push(`Unexpected key '${key}'.` + (info ? ' ' + info : ''));
						continue;
					}

					const message = propertyType.fail(value[key]);
					if (!propertyType.check(value, message)) {
						errorList.push(`Bad value for the key '${key}': ${message!}`);
						continue;
					}
				}

				const missingKeys = Object.keys(properties).filter(expectedKey => !Object.hasOwn(value, expectedKey));
				if (missingKeys.length > 0) {
					errorList.push(`Missing keys: '${missingKeys.join('\', \'')}'.`);
				}

				if (errorList.length > 0) {
					const message = errorList.join('\n\n');
					return `The value should be a ${this.typeName}:\n${message}`;
				}
			},
		});

		return validator;
	}

	export function object<T extends ObjectLike = ObjectLike>(options?: ObjectOptions<T>): TypeValidatorObject<T> {
		const {defaultVal, optional, parser, valueType = any() as TypeValidator<T[keyof T]>} = options ?? {};
		const validator = new TypeValidatorObject<T>({
			defaultVal,
			optional,
			parser,
			valueType,
			typeName: `object<${valueType.typeName}>`,
			fail(value) {
				if (value?.constructor !== Object) {
					return `The value should be an ${this.typeName}.`;
				}

				const object = value as ObjectLike;

				const errorList: string[] = [];
				for (const key in object) {
					if (!Object.hasOwn(object, key)) {
						continue;
					}

					const value = object[key];

					if (!valueType.check(value, 0)) {
						errorList.push(`Invalid value type for the key '${key}'. Got ${format('%o', value)}.`);
						continue;
					}
				}

				if (errorList.length > 0) {
					const message = errorList.join('\n\n');
					return `The value should be an ${this.typeName}:\n${message}`;
				}
			},
		});

		return validator;
	}

	export function boolean(options?: BooleanOptions) {
		const {defaultVal, optional, parser} = options ?? {};
		return new TypeValidator<boolean>({
			defaultVal,
			optional,
			parser,
			typeName: 'boolean',
			fail(value) {
				if (typeof value === 'boolean') {
					return;
				}

				return `The value should be a ${this.typeName}.`;
			},
		});
	}

	export function string(options?: StringOptions): TypeValidator<string> {
		const {defaultVal, optional, parser, pattern} = options ?? {};
		const validator = new TypeValidator<string>({
			defaultVal,
			optional,
			parser,
			typeName: 'string',
			fail(value) {
				if (typeof value !== 'string') {
					return `Should be a ${this.typeName}. Got '${format('%o', value)}'.`;
				}

				if (pattern instanceof RegExp) {
					if (!pattern.test(value)) {
						return `Should satisfy the regex pattern: ${pattern.source}. Got '${format('%o', value)}'.`;
					}
				} else if (pattern) {
					const message = pattern(value);
					return `Should be a specific ${this.typeName}. Got '${format('%o', value)}'. ${message}`;
				}
			},
		});

		return validator;
	}

	export function date(options?: DateOptions): TypeValidator<Date> {
		const valueType = string();
		const {defaultVal, optional, parser} = options ?? {};
		const validator = new TypeValidator<Date>({
			defaultVal,
			optional,
			parser,
			typeName: `date<${valueType.typeName}>`,
			fail(value) {
				if (Number.isNaN(Date.parse(String(value)))) {
					return `Should be a ${this.typeName}. Got '${format('%o', value)}'.`;
				}
			},
			afterParse(value) {
				return new Date(String(value));
			},
		});

		return validator;
	}

	export function number(options?: NumberOptions): TypeValidator<number> {
		const {defaultVal, optional, parser, min = -Infinity, max = Infinity, pattern} = options ?? {};
		const validator = new TypeValidator<number>({
			defaultVal,
			optional,
			parser,
			typeName: 'number',
			fail(value) {
				const maximum = Math.min(max, Number.MAX_SAFE_INTEGER);
				const minimum = Math.max(min, Number.MIN_SAFE_INTEGER);
				const valueString = String(value);
				const error = `Should be a ${this.typeName}: ${minimum} - ${maximum}. Got: ${format('%o', value)}.`;

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
						return `Should satisfy the regex pattern: ${pattern.source}. Got: '${format('%o', value)}'.`;
					}
				} else if (pattern) {
					const message = pattern(value, valueString);
					return `Should be a specific ${this.typeName}. Got: '${format('%o', value)}'.${message ? ' ' + message : ''}`;
				}
			},
		});

		return validator;
	}

	export function integer(options?: NumberOptions): TypeValidator<number> {
		const {defaultVal, optional, parser, min = -Infinity, max = Infinity} = options ?? {};
		const validator = new TypeValidator<number>({
			defaultVal,
			optional,
			parser,
			typeName: 'integer',
			fail(value) {
				if (number(options).check(value, 0) && Number.isInteger(value)) {
					return;
				}

				const maximum = Math.min(max, Number.MAX_SAFE_INTEGER);
				const minimum = Math.max(min, Number.MIN_SAFE_INTEGER);
				return `The value should be an ${this.typeName}: ${minimum} - ${maximum}. Got: ${format('%o', value)}.`;
			},
		});

		return validator;
	}
}

export default Types;
