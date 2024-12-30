import assert from 'node:assert';
import * as config from '../src/index.js';

it('optional', () => {
	assert.ok(config.Types.number({optional: false}).check(1, 0));
	assert.ok(!config.Types.number({optional: false}).check(undefined, 0));

	assert.ok(config.Types.number({optional: true}).check(1, 0));
	assert.ok(config.Types.number({optional: true}).check(undefined, 0));
});

it('object', () => {
	assert.ok(!config.Types.object().check(1, 0));
	assert.ok(config.Types.object().check(new Object(), 0)); // eslint-disable-line no-object-constructor
	assert.ok(config.Types.object().check({}, 0));

	// Bad type props
	assert.ok(config.Types.object({valueType: config.Types.number()}).check({data: 1}, 0));
	assert.ok(!config.Types.object({valueType: config.Types.string()}).check({data: 1}, 0));
});

it('struct', () => {
	assert.ok(!config.Types.struct({properties: {}}).check(1, 0));
	assert.ok(config.Types.struct({properties: {}}).check(new Object(), 0)); // eslint-disable-line no-object-constructor
	assert.ok(config.Types.struct({properties: {}}).check({}, 0));

	// Bad type props
	assert.ok(config.Types.struct({properties: {data: config.Types.number()}}).check({data: 1}, 0));
	assert.ok(!config.Types.struct({properties: {data: config.Types.string()}}).check({data: 1}, 0));

	// Too many props
	assert.ok(!config.Types.struct({properties: {}}).check({data: 1}, 0));

	// Missing props
	assert.ok(!config.Types.struct({properties: {data: config.Types.string()}}).check({}, 0));
});

it('array', () => {
	assert.ok(config.Types.array().check(['', {}], 0));
	assert.ok(config.Types.array({elementType: config.Types.string()}).check(['', ''], 0));
	assert.ok(!config.Types.array({elementType: config.Types.string()}).check(['', {}], 0));
	assert.ok(config.Types.array({elementType: config.Types.literal({choices: new Set([0, ''])})}).check(['', 0], 0));
	assert.ok(!config.Types.array({elementType: config.Types.literal({choices: new Set([0, ''])})}).check(['', 0, {}], 0));
});

it('any', () => {
	assert.ok(config.Types.any().check({}, 0));
	assert.ok(config.Types.any().check(-1, 0));
	assert.ok(config.Types.any().check(1, 0));
	assert.ok(config.Types.any().check(0, 0));
	assert.ok(config.Types.any().check('', 0));
	assert.ok(config.Types.any().check([], 0));
	assert.ok(!config.Types.any().check(Symbol('test'), 0));
});

it('number', () => {
	assert.ok(config.Types.number().check(-1, 0));
	assert.ok(config.Types.number().check(1, 0));
	assert.ok(config.Types.number().check(1.1, 0));
	assert.ok(config.Types.number().check(0, 0));

	assert.ok(!config.Types.number({max: 100}).check(101, 0));
	assert.ok(config.Types.number({max: 100}).check(99, 0));
	assert.ok(config.Types.number({max: 100}).check(100, 0));
});

it('integer', () => {
	assert.ok(config.Types.integer().check(-1, 0));
	assert.ok(config.Types.integer().check(1, 0));
	assert.ok(!config.Types.integer().check(1.1, 0));
	assert.ok(config.Types.integer().check(0, 0));
});

it('string', () => {
	assert.ok(!config.Types.string().check(0, 0));
	assert.ok(config.Types.string().check('', 0));
	assert.ok(config.Types.string().check('str', 0));
});

it('literal', () => {
	const choices = new Set(['', 0, true]);
	assert.ok(!config.Types.literal({choices}).check(1, 0));
	assert.ok(!config.Types.literal({choices}).check(false, 0));
	assert.ok(!config.Types.literal({choices}).check('a', 0));
	assert.ok(config.Types.literal({choices}).check('', 0));
	assert.ok(config.Types.literal({choices}).check(0, 0));
	assert.ok(config.Types.literal({choices}).check(true, 0));
});

it('date string', () => {
	assert.strictEqual(config.Types.date().parse('50').getTime(), new Date(Date.parse('50')).getTime());
});
