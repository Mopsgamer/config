import assert from 'node:assert';
import * as config from '../src/index.js';

it('object', () => {
	assert.ok(!config.Types.object().check(1, 0));
	assert.ok(config.Types.object().check(new Object(), 0)); // eslint-disable-line no-object-constructor
	assert.ok(config.Types.object().check({}, 0));
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
