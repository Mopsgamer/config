# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
