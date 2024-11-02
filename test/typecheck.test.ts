import assert from 'node:assert';
import * as config from '../src/index.js';

it('object', () => {
	assert.ok(!config.Types.record().check(1, 0));
	assert.ok(config.Types.record().check(new Object(), 0)); // eslint-disable-line no-object-constructor
	assert.ok(config.Types.record().check({}, 0));
});

it('array', () => {
	assert.ok(config.Types.array().check(['', {}], 0));
	assert.ok(config.Types.array(config.Types.string()).check(['', ''], 0));
	assert.ok(!config.Types.array(config.Types.string()).check(['', {}], 0));
	assert.ok(config.Types.array(config.Types.literal(new Set([0, '']))).check(['', 0], 0));
	assert.ok(!config.Types.array(config.Types.literal(new Set([0, '']))).check(['', 0, {}], 0));
});

it('any', () => {
	assert.ok(config.Types.any.check({}, 0));
	assert.ok(config.Types.any.check(-1, 0));
	assert.ok(config.Types.any.check(1, 0));
	assert.ok(config.Types.any.check(0, 0));
	assert.ok(config.Types.any.check('', 0));
	assert.ok(config.Types.any.check([], 0));
	assert.ok(!config.Types.any.check(Symbol('test'), 0));
});

it('number', () => {
	assert.ok(config.Types.number().check(-1, 0));
	assert.ok(config.Types.number().check(1, 0));
	assert.ok(config.Types.number().check(1.1, 0));
	assert.ok(config.Types.number().check(0, 0));
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
	const s = new Set(['', 0, true]);
	assert.ok(!config.Types.literal(s).check(1, 0));
	assert.ok(!config.Types.literal(s).check(false, 0));
	assert.ok(!config.Types.literal(s).check('a', 0));
	assert.ok(config.Types.literal(s).check('', 0));
	assert.ok(config.Types.literal(s).check(0, 0));
	assert.ok(config.Types.literal(s).check(true, 0));
});
