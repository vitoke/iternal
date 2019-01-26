import { Folder, Folds, Fold } from '../src/lib/public/iternal'
import { isEven } from './test-utils'

const ExpectThrow = Symbol()
type ExpectThrow = typeof ExpectThrow

const compare = <I, O>(
  folder: Folder<I, O>,
  ...is: [Iterable<I>, O | ExpectThrow][]
) =>
  is.forEach(([i, o]) => {
    if (o === ExpectThrow) {
      return expect(() => Fold.fold(i, folder)).toThrow()
    }
    expect(Fold.fold(i, folder)).toEqual(o)
  })

describe('Fold', () => {
  it('mapInput', () => {
    compare(
      Folds.sum.mapInput<number>(v => v * 2),
      [[], 0],
      [[1], 2],
      [[1, 2, 3], 12]
    )
  })

  it('filterInput', () => {
    compare(
      Folds.sum.filterInput(isEven),
      [[], 0],
      [[1], 0],
      [[2], 2],
      [[1, 2, 3, 4], 6]
    )
  })

  it('appendInput', () => {
    compare(
      Folds.sum.appendInput(100, 200),
      [[], 300],
      [[1], 301],
      [[1, 2, 3], 306]
    )

    compare(Folds.stringAppend.appendInput('abc'), ['', 'abc'], ['11', '11abc'])
  })

  it('prependInput', () => {
    compare(
      Folds.sum.prependInput(100, 200),
      [[], 300],
      [[1], 301],
      [[1, 2, 3], 306]
    )

    compare(
      Folds.stringAppend.prependInput('abc'),
      ['', 'abc'],
      ['11', 'abc11']
    )
  })

  it('distinctInput', () => {
    compare(
      Folds.sum.distinctInput(),
      [[], 0],
      [[1], 1],
      [[1, 1], 1],
      [[1, 3, 5, 3, 1], 9]
    )
  })

  it('distinctByInput', () => {
    compare(
      Folds.sum.distinctByInput(v => v % 3),
      [[], 0],
      [[1], 1],
      [[1, 4], 1],
      [[1, 3, 5, 3, 1], 9]
    )
  })

  it('dropInput', () => {
    compare(
      Folds.sum.dropInput(2),
      [[], 0],
      [[1], 0],
      [[1, 2], 0],
      [[1, 2, 3, 4], 7]
    )
  })

  it('takeInput', () => {
    compare(
      Folds.sum.takeInput(2),
      [[], 0],
      [[1], 1],
      [[1, 2], 3],
      [[1, 2, 3, 4], 3]
    )
  })

  it('slice', () => {
    compare(Folds.sum.sliceInput(1, 2), [[], 0], [[1, 2], 2], [[1, 2, 3, 4], 5])
  })

  it('dropWhileInput', () => {
    compare(
      Folds.sum.dropWhileInput(v => v <= 2),
      [[], 0],
      [[1], 0],
      [[1, 2], 0],
      [[1, 2, 3, 4], 7]
    )
  })

  it('takeWhileInput', () => {
    compare(
      Folds.sum.takeWhileInput(v => v <= 2),
      [[], 0],
      [[1], 1],
      [[1, 2], 3],
      [[1, 2, 3, 4], 3]
    )
  })

  it('filterChangedInput', () => {
    compare(
      Folds.sum.filterChangedInput(),
      [[], 0],
      [[1], 1],
      [[1, 1], 1],
      [[1, 2], 3],
      [[1, 1, 2, 2, 3, 3], 6]
    )
  })

  it('monitorInput', () => {
    let sum = 0
    const fold = Folds.sum.monitorInput('', ([e]) => (sum += e))
    Fold.fold([], fold)
    expect(sum).toBe(0)
    Fold.fold([1, 2], fold)
    expect(sum).toBe(3)
  })

  it('patchWhereInput', () => {
    compare(
      Folds.sum.patchWhereInput(v => v % 3 === 0, 1, v => [v * 2, v * 3]),
      [[], 0],
      [[0], 0],
      [[1], 1],
      [[3], 15],
      [[3, 3], 30],
      [[1, 3, 5], 21]
    )

    compare(
      Folds.sum.patchWhereInput(v => v % 3 === 0, 1, v => [v * 2, v * 3], 1),
      [[3], 15],
      [[3, 3], 18]
    )
  })

  it('patchElemInput', () => {
    compare(
      Folds.stringAppend.patchElemInput('a', 1, 'b'),
      ['', ''],
      ['a', 'b'],
      ['b', 'b'],
      ['ab', 'bb']
    )

    compare(
      Folds.stringAppend.patchElemInput('a', 1, 'b', 1),
      ['', ''],
      ['a', 'b'],
      ['b', 'b'],
      ['ab', 'bb'],
      ['abab', 'bbab']
    )
  })

  it('sampleInput', () => {
    compare(
      Folds.stringAppend.sampleInput(3),
      ['', ''],
      ['a', 'a'],
      ['ab', 'a'],
      ['abcd', 'ad']
    )
  })
})
