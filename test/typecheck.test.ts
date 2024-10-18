import assert from 'node:assert';
import * as config from '../src/index.js';

it('object', () => {
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
	assert.ok(config.Types.number().check(0, 0));
});
