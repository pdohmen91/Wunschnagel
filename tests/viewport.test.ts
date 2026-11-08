import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visibleContentWidth, visibleVerticalBounds } from '../src/viewport.ts'

test('uses the measured visible width when the host window extends past the display', () => {
  assert.equal(visibleContentWidth({ viewportWidth: 2190, windowWidth: 2560, windowLeft: 0, screenLeft: 0, screenWidth: 2056 }), 1686)
})

test('normal windows keep their complete content width', () => {
  assert.equal(visibleContentWidth({ viewportWidth: 1440, windowWidth: 1440, windowLeft: 0, screenLeft: 0, screenWidth: 2056 }), 1440)
  assert.equal(visibleContentWidth({ viewportWidth: 390, windowWidth: 390, windowLeft: 0, screenLeft: 0, screenWidth: 390 }), 390)
  assert.equal(visibleContentWidth({ viewportWidth: 320, windowWidth: 500, windowLeft: 218, screenLeft: 0, screenWidth: 320 }), 320)
})

test('a display with a negative origin uses its own right edge', () => {
  assert.equal(visibleContentWidth({ viewportWidth: 2190, windowWidth: 2560, windowLeft: -2056, screenLeft: -2056, screenWidth: 2056 }), 1686)
})

test('unavailable screen data and windows on a different display do not impose a guessed width', () => {
  assert.equal(visibleContentWidth({ viewportWidth: 1440, windowWidth: 1600, windowLeft: 0, screenLeft: 0, screenWidth: 0 }), 1440)
  assert.equal(visibleContentWidth({ viewportWidth: 1440, windowWidth: 2560, windowLeft: -2560, screenLeft: 0, screenWidth: 2056 }), 1440)
})


test('a keyboard bounds the usable height without changing the layout viewport', () => {
  assert.deepEqual(visibleVerticalBounds(844, { height: 344, offsetTop: 0, scale: 1 }), { height: 344, top: 0 })
  assert.deepEqual(visibleVerticalBounds(844, { height: 344, offsetTop: 40, scale: 1 }), { height: 344, top: 40 })
})

test('pinch zoom preserves layout size instead of reflowing the dialog', () => {
  assert.deepEqual(visibleVerticalBounds(844, { height: 300, offsetTop: 100, scale: 2 }), { height: 844, top: 0 })
})

test('missing or transient invalid viewport measurements preserve a usable height', () => {
  assert.deepEqual(visibleVerticalBounds(844, null), { height: 844, top: 0 })
  assert.deepEqual(visibleVerticalBounds(844, { height: 0, offsetTop: 0, scale: 1 }), { height: 844, top: 0 })
  assert.deepEqual(visibleVerticalBounds(844, { height: NaN, offsetTop: 0, scale: 1 }), { height: 844, top: 0 })
})

test('overscroll and viewport offsets cannot place the usable area outside the page', () => {
  assert.deepEqual(visibleVerticalBounds(600, { height: 700, offsetTop: -10, scale: 1 }), { height: 600, top: 0 })
  assert.deepEqual(visibleVerticalBounds(600, { height: 400, offsetTop: 500, scale: 1 }), { height: 400, top: 200 })
})
