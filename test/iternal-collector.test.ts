import iter, { Op, ops } from '../src/lib/public/iternal'
import { isEven } from './test-utils'

const ExpectThrow = Symbol()
type ExpectThrow = typeof ExpectThrow

const compare = <I, O>(collector: Op<I, O>, ...is: [Iterable<I>, O | ExpectThrow][]) =>
  is.forEach(([i, o]) => {
    if (o === ExpectThrow) {
      return expect(() => iter(i).collect(collector)).toThrow()
    }
    expect(iter(i).collect(collector)).toEqual(o)
  })

describe('Collect', () => {
  it('mapInput', () => {
    compare(ops.sum.mapInput<number>(v => v * 2), [[], 0], [[1], 2], [[1, 2, 3], 12])
  })

  it('filterInput', () => {
    compare(ops.sum.filterInput(isEven), [[], 0], [[1], 0], [[2], 2], [[1, 2, 3, 4], 6])
  })

  it('appendInput', () => {
    compare(ops.sum.appendInput(100, 200), [[], 300], [[1], 301], [[1, 2, 3], 306])

    compare(ops.stringAppend.appendInput('abc'), ['', 'abc'], ['11', '11abc'])
  })

  it('prependInput', () => {
    compare(ops.sum.prependInput(100, 200), [[], 300], [[1], 301], [[1, 2, 3], 306])

    compare(ops.stringAppend.prependInput('abc'), ['', 'abc'], ['11', 'abc11'])
  })

  it('distinctInput', () => {
    compare(ops.sum.distinctInput(), [[], 0], [[1], 1], [[1, 1], 1], [[1, 3, 5, 3, 1], 9])
  })

  it('distinctByInput', () => {
    compare(
      ops.sum.distinctByInput(v => v % 3),
      [[], 0],
      [[1], 1],
      [[1, 4], 1],
      [[1, 3, 5, 3, 1], 9]
    )
  })

  it('dropInput', () => {
    compare(ops.sum.dropInput(2), [[], 0], [[1], 0], [[1, 2], 0], [[1, 2, 3, 4], 7])
  })

  it('takeInput', () => {
    compare(ops.sum.takeInput(2), [[], 0], [[1], 1], [[1, 2], 3], [[1, 2, 3, 4], 3])
  })

  it('dropLastInput', () => {
    compare(ops.sum.dropLastInput(2), [[], 0], [[1], 0], [[1, 2], 0], [[1, 2, 3, 4], 3])
  })

  it('takeLastInput', () => {
    compare(ops.sum.takeLastInput(2), [[], 0], [[1], 1], [[1, 2], 3], [[1, 2, 3, 4], 7])
  })

  it('slice', () => {
    compare(ops.sum.sliceInput(1, 2), [[], 0], [[1, 2], 2], [[1, 2, 3, 4], 5])
  })

  it('dropWhileInput', () => {
    compare(ops.sum.dropWhileInput(v => v <= 2), [[], 0], [[1], 0], [[1, 2], 0], [[1, 2, 3, 4], 7])
  })

  it('takeWhileInput', () => {
    compare(ops.sum.takeWhileInput(v => v <= 2), [[], 0], [[1], 1], [[1, 2], 3], [[1, 2, 3, 4], 3])
  })

  it('filterChangedInput', () => {
    compare(
      ops.sum.filterChangedInput(),
      [[], 0],
      [[1], 1],
      [[1, 1], 1],
      [[1, 2], 3],
      [[1, 1, 2, 2, 3, 3], 6]
    )
  })

  it('monitorInput', () => {
    let sum = 0
    const collect = ops.sum.monitorInput('', ([e]) => (sum += e))
    iter(new Array<number>()).collect(collect)
    expect(sum).toBe(0)
    iter([1, 2]).collect(collect)
    expect(sum).toBe(3)
  })

  it('patchWhereInput', () => {
    compare(
      ops.sum.patchWhereInput(v => v % 3 === 0, 1, v => [v * 2, v * 3]),
      [[], 0],
      [[0], 0],
      [[1], 1],
      [[3], 15],
      [[3, 3], 30],
      [[1, 3, 5], 21]
    )

    compare(
      ops.sum.patchWhereInput(v => v % 3 === 0, 1, v => [v * 2, v * 3], 1),
      [[3], 15],
      [[3, 3], 18]
    )
  })

  it('patchElemInput', () => {
    compare(
      ops.stringAppend.patchElemInput('a', 1, 'b'),
      ['', ''],
      ['a', 'b'],
      ['b', 'b'],
      ['ab', 'bb']
    )

    compare(
      ops.stringAppend.patchElemInput('a', 1, 'b', 1),
      ['', ''],
      ['a', 'b'],
      ['b', 'b'],
      ['ab', 'bb'],
      ['abab', 'bbab']
    )
  })

  it('sampleInput', () => {
    compare(ops.stringAppend.sampleInput(3), ['', ''], ['a', 'a'], ['ab', 'a'], ['abcd', 'ad'])
    compare(
      ops.stringAppend.sampleInput(3).dropInput(1),
      ['', ''],
      ['a', ''],
      ['ab', 'b'],
      ['abcde', 'be']
    )
  })
})
