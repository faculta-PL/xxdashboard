import assert from 'node:assert/strict'
import test from 'node:test'
import { isNearBottom, NEAR_BOTTOM_PX } from './stick.js'

test('message pane sticks only within 40px of the bottom', () => {
  assert.equal(NEAR_BOTTOM_PX, 40)
  assert.equal(isNearBottom(null), true)
  assert.equal(isNearBottom({ scrollHeight: 400, scrollTop: 200, clientHeight: 160 }), true)
  assert.equal(isNearBottom({ scrollHeight: 400, scrollTop: 199, clientHeight: 160 }), false)
})
