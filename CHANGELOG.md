# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.3] - 2025-01-13

- Fix commander's cfg command options.
- Fix `highlight`, move it outside of `Config`.

## [3.2.2] - 2025-01-10

- Fix missing properties. Fixes optional and dynamic properties.
- Fix brackets: `should be integer: 1 () - Infinity ()`.
- Fix integer.

## [3.2.1] - 2025-01-10

- Fix config loading object-like checks.
- Allow commander adapter.
- Fix number ranges limited my safety.

## [3.2.0] - 2024-12-31

- Add `Config.setData`.
- Add `TypeValidator.isObjectLike`.
- Add `TypeValidatorStruct.hasOwn & getType`.
- Add more tests.
- Fix commander init type check.
- Allow custom validators for `Config.isObjectLike` based on `TypeValidator.isObjectLike`.
- Fix typo.
- Fix dynamicProperties.

## [3.1.1] - 2024-12-30

- Add '?' prefix for optional types.
- Fix optional types for object and array.
- Fix isObjectLike.

## [3.1.0] - 2024-12-21

- Breaking: Rename `GetPrintableOptions` to `ConfigGetPrintableOptions` and fix.
- Add exports field to 'package.json'.
- Add commander.js integration.
- Add `failString` method.
- Add `ConfigPair` typing.
- Add `Types.date` type constructor.
- Fix typings. Allow `OptionalType<undefined>`. Allow non-string keys: number and symbol.
- Fix parser option for every type.
- Improve array type name: `0|1|2[] -> array<0|1|2>`.
- Improve object type name: `object -> object<0|1|2>`.

## [3.0.0] - 2024-11-22

- Major changes:
  - Move all type-related stuff into `Types` namespace.
  - Rename `getPairString`, `ConfigRaw` and `Config.isRaw` to
    `getPrintable`, `Types.ObjectLike` and `Config.isObjectLike` respectively.
  - Remove `isConfigRaw`, `TypeValidator.failThow` and `TypeValidatorOptions.parse`.

- Minor changes:
  - Add `Types.parser`.
  - Add `getDataString`.
  - Add `TypeOptions.optional`.

- Patch changes:
  - Update dependencies.
  - Remove 'yaml' depencency and use the `Types.parser` for the type parsing instead of yaml.


## [2.0.3] - 2024-11-22

This patch contains 'object-like config'-related changes:

- Improve validation messages.
- Make methods stricter. Make error messages more respectful, not just 'not object'. Should say property issues.
- Add `isRaw` method.
- Satisfy `type` option for struct and object.
- Change results for `getPairString` if the config is an object.

Note: The 'Raw' is a bad naming for `ConfigRaw` and `isRaw`.
That means config is a struct or an object.
Should rename this things in the next v3 version to the 'ObjectLike'. `getPairString` should be renamed to `getPrintable`.

## [2.0.2] - 2024-11-22

- Fix loading.
- `struct` and `object` type checking messages now contain all problems, not just the first one.
- Improve other validation messages.

## [2.0.1] - 2024-11-22

- Delete the useless `ShowSourcesType`.
- Allow to use the `get` method without the options parameter.
- Fix JSDoc for `get` and add for `ConfigManagerGetMode` and `failThrow`.

## [2.0.0] - 2024-11-21

- Allow custom parser.
- Allow non-struct config.
- Add noDelete for the save method.
- Add failSet.
- Refactor and fix default values using new option for types.

## [1.0.0] - 2024-11-20

- Update the README.
- All types are methods.
- Now it is possible to get default values. The `real` option has been replaced by the `mode: 'real' | 'current' | 'default'`.
- Replace arguments with option object: array, literal and object.
- Add new literal ability: type validator as a choice.
- Add new type - struct.
- Add failThrow and config normal methods (e.g. unset, set, load).
- Add number and integer options: pattern, min and max.
- Add string options: pattern.

## [0.2.0] - 2024-10-18

- Fix and clarify.

## [0.1.0] - 2024-10-18

- Initial release.
