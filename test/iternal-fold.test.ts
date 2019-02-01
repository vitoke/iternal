import { Collectors, iter, Collector } from '../src/lib/public/iternal'
import { isEven } from './test-utils'

const ExpectThrow = Symbol()
type ExpectThrow = typeof ExpectThrow

const compare = <I, O>(collector: Collector<I, O>, ...is: [Iterable<I>, O | ExpectThrow][]) =>
  is.forEach(([i, o]) => {
    if (o === ExpectThrow) {
      return expect(() => iter(i).collect(collector)).toThrow()
    }
    expect(iter(i).collect(collector)).toEqual(o)
  })

describe('Collect', () => {
  it('mapInput', () => {
    compare(Collectors.sum.mapInput<number>(v => v * 2), [[], 0], [[1], 2], [[1, 2, 3], 12])
  })

  it('filterInput', () => {
    compare(Collectors.sum.filterInput(isEven), [[], 0], [[1], 0], [[2], 2], [[1, 2, 3, 4], 6])
  })

  it('appendInput', () => {
    compare(Collectors.sum.appendInput(100, 200), [[], 300], [[1], 301], [[1, 2, 3], 306])

    compare(Collectors.stringAppend.appendInput('abc'), ['', 'abc'], ['11', '11abc'])
  })

  it('prependInput', () => {
    compare(Collectors.sum.prependInput(100, 200), [[], 300], [[1], 301], [[1, 2, 3], 306])

    compare(Collectors.stringAppend.prependInput('abc'), ['', 'abc'], ['11', 'abc11'])
  })

  it('distinctInput', () => {
    compare(Collectors.sum.distinctInput(), [[], 0], [[1], 1], [[1, 1], 1], [[1, 3, 5, 3, 1], 9])
  })

  it('distinctByInput', () => {
    compare(
      Collectors.sum.distinctByInput(v => v % 3),
      [[], 0],
      [[1], 1],
      [[1, 4], 1],
      [[1, 3, 5, 3, 1], 9]
    )
  })

  it('dropInput', () => {
    compare(Collectors.sum.dropInput(2), [[], 0], [[1], 0], [[1, 2], 0], [[1, 2, 3, 4], 7])
  })

  it('takeInput', () => {
    compare(Collectors.sum.takeInput(2), [[], 0], [[1], 1], [[1, 2], 3], [[1, 2, 3, 4], 3])
  })

  it('dropLastInput', () => {
    compare(Collectors.sum.dropLastInput(2), [[], 0], [[1], 0], [[1, 2], 0], [[1, 2, 3, 4], 3])
  })

  it('takeLastInput', () => {
    compare(Collectors.sum.takeLastInput(2), [[], 0], [[1], 1], [[1, 2], 3], [[1, 2, 3, 4], 7])
  })

  it('slice', () => {
    compare(Collectors.sum.sliceInput(1, 2), [[], 0], [[1, 2], 2], [[1, 2, 3, 4], 5])
  })

  it('dropWhileInput', () => {
    compare(
      Collectors.sum.dropWhileInput(v => v <= 2),
      [[], 0],
      [[1], 0],
      [[1, 2], 0],
      [[1, 2, 3, 4], 7]
    )
  })

  it('takeWhileInput', () => {
    compare(
      Collectors.sum.takeWhileInput(v => v <= 2),
      [[], 0],
      [[1], 1],
      [[1, 2], 3],
      [[1, 2, 3, 4], 3]
    )
  })

  it('filterChangedInput', () => {
    compare(
      Collectors.sum.filterChangedInput(),
      [[], 0],
      [[1], 1],
      [[1, 1], 1],
      [[1, 2], 3],
      [[1, 1, 2, 2, 3, 3], 6]
    )
  })

  it('monitorInput', () => {
    let sum = 0
    const collect = Collectors.sum.monitorInput('', ([e]) => (sum += e))
    iter(new Array<number>()).collect(collect)
    expect(sum).toBe(0)
    iter([1, 2]).collect(collect)
    expect(sum).toBe(3)
  })

  it('patchWhereInput', () => {
    compare(
      Collectors.sum.patchWhereInput(v => v % 3 === 0, 1, v => [v * 2, v * 3]),
      [[], 0],
      [[0], 0],
      [[1], 1],
      [[3], 15],
      [[3, 3], 30],
      [[1, 3, 5], 21]
    )

    compare(
      Collectors.sum.patchWhereInput(v => v % 3 === 0, 1, v => [v * 2, v * 3], 1),
      [[3], 15],
      [[3, 3], 18]
    )
  })

  it('patchElemInput', () => {
    compare(
      Collectors.stringAppend.patchElemInput('a', 1, 'b'),
      ['', ''],
      ['a', 'b'],
      ['b', 'b'],
      ['ab', 'bb']
    )

    compare(
      Collectors.stringAppend.patchElemInput('a', 1, 'b', 1),
      ['', ''],
      ['a', 'b'],
      ['b', 'b'],
      ['ab', 'bb'],
      ['abab', 'bbab']
    )
  })

  it('sampleInput', () => {
    compare(
      Collectors.stringAppend.sampleInput(3),
      ['', ''],
      ['a', 'a'],
      ['ab', 'a'],
      ['abcd', 'ad']
    )
  })
})
