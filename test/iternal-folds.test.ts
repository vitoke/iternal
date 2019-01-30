import { isEven } from './test-utils'
import { FolderT, Iter, Folds, Fold } from '../src/lib/public/iternal'

const ExpectThrow = Symbol()
type ExpectThrow = typeof ExpectThrow

const compare = <I, O>(
  folder: FolderT<I, O>,
  ...is: [Iterable<I>, O | ExpectThrow][]
) =>
  is.forEach(([i, o]) => {
    if (o === ExpectThrow) {
      return expect(() => Fold.fold(i, folder)).toThrow()
    }
    expect(Fold.fold(i, folder)).toEqual(o)
  })

describe('Fold', () => {
  test('and', () => {
    compare(
      Folds.and,
      [[], true],
      [[true], true],
      [[false], false],
      [[false, false], false],
      [[false, true], false],
      [[true, false], false],
      [[true, true], true]
    )
  })

  test('or', () => {
    compare(
      Folds.or,
      [[], false],
      [[true], true],
      [[false], false],
      [[false, false], false],
      [[false, true], true],
      [[true, false], true],
      [[true, true], true]
    )
  })

  test('sum', () => {
    compare(
      Folds.sum,
      [[], 0],
      [[0], 0],
      [[10], 10],
      [[10, 20], 30],
      [[-10.5, 10.5], 0],
      [Iter.range(1, 50), 1225]
    )
  })

  test('product', () => {
    compare(
      Folds.product,
      [[], 1],
      [[0], 0],
      [[10], 10],
      [[10, 20], 200],
      [[-10, 10], -100],
      [Iter.range(1, 10), 362880],
      [Iter.nats, 0]
    )
  })

  test('average', () => {
    compare(
      Folds.average,
      [[], 0],
      [[0], 0],
      [[10], 10],
      [[10, 20], 15],
      [[-10.5, 10.5], 0],
      [Iter.range(1, 50), 25]
    )
  })

  test('contains', () => {
    compare(
      Folds.contains('#'),
      ['', false],
      ['a', false],
      ['#', true],
      ['ab', false],
      ['ab#a', true]
    )
  })

  test('count', () => {
    compare<any, number>(
      Folds.count,
      ['', 0],
      ['a', 1],
      [Iter.range(0, 50), 50]
    )
  })

  test('elemAt', () => {
    compare<any, any>(
      Folds.elemAt(1),
      ['', ExpectThrow],
      ['a', ExpectThrow],
      ['ab', 'b'],
      ['abc', 'b']
    )
    compare(
      Folds.elemAt(1, 'X'),
      ['', 'X'],
      ['a', 'X'],
      ['ab', 'b'],
      ['abc', 'b']
    )
    compare(
      Folds.elemAt(1, () => 'X'),
      ['', 'X'],
      ['a', 'X'],
      ['ab', 'b'],
      ['abc', 'b']
    )
  })

  test('every', () => {
    compare(
      Folds.every(isEven),
      [[], true],
      [[0], true],
      [[1], false],
      [[0, 2, 4], true],
      [[0, 2, 5], false],
      [Iter.range(0, 100, 2), true]
    )
  })

  test('some', () => {
    compare(
      Folds.some(isEven),
      [[], false],
      [[0], true],
      [[1], false],
      [[1, 3, 5], false],
      [[1, 2, 6], true],
      [Iter.range(0, 100, 2), true],
      [Iter.range(1, 100, 2), false]
    )
  })

  test('first', () => {
    compare(Folds.first(), ['', ExpectThrow], ['a', 'a'], ['abc', 'a'])
    compare(Folds.first('X'), ['', 'X'], ['a', 'a'], ['abc', 'a'])
    compare(Folds.first(() => 'X'), ['', 'X'], ['a', 'a'], ['abc', 'a'])
  })

  test('last', () => {
    compare(Folds.last(), ['', ExpectThrow], ['a', 'a'], ['abc', 'c'])
    compare(Folds.last('X'), ['', 'X'], ['a', 'a'], ['abc', 'c'])
    compare(Folds.last(() => 'X'), ['', 'X'], ['a', 'a'], ['abc', 'c'])
  })

  test('find', () => {
    compare(
      Folds.find(isEven),
      [[], ExpectThrow],
      [[1], ExpectThrow],
      [[0], 0],
      [[1, 3, 4], 4]
    )
    compare(
      Folds.find(isEven, -10),
      [[], -10],
      [[1], -10],
      [[0], 0],
      [[1, 3, 4], 4]
    )
    compare(
      Folds.find(isEven, () => -10),
      [[], -10],
      [[1], -10],
      [[0], 0],
      [[1, 3, 4], 4]
    )
  })

  test('findLast', () => {
    compare(
      Folds.findLast(isEven),
      [[], ExpectThrow],
      [[1], ExpectThrow],
      [[0], 0],
      [[0, 2, 3, 4], 4]
    )
    compare(
      Folds.findLast(isEven, -10),
      [[], -10],
      [[1], -10],
      [[0], 0],
      [[0, 2, 3, 4], 4]
    )
    compare(
      Folds.findLast(isEven, () => -10),
      [[], -10],
      [[1], -10],
      [[0], 0],
      [[0, 2, 3, 4], 4]
    )
  })

  test('histogram', () => {
    compare(
      Folds.histogram(),
      ['', new Map()],
      ['a', new Map([['a', 1]])],
      ['ab', new Map([['a', 1], ['b', 1]])],
      ['abcb', new Map([['a', 1], ['b', 2], ['c', 1]])]
    )
  })

  // test('elementsByFreq', () => {
  //   compare(
  //     Folds.elementsByFreq<string>(),
  //     ['', new Map()],
  //     ['a', new Map([[1, new Set(['a'])]])],
  //     ['aa', new Map([[2, new Set(['a'])]])],
  //     ['aba', new Map([[2, new Set(['a'])], [1, new Set(['b'])]])]
  //   )
  // })

  test('groupBy', () => {
    compare(
      Folds.groupBy((v: number) => v % 3),
      [[], new Map()],
      [[1], new Map([[1, [1]]])],
      [[1, 5], new Map([[1, [1]], [2, [5]]])],
      [[1, 4], new Map([[1, [1, 4]]])],
      [[1, 4, 1], new Map([[1, [1, 4, 1]]])]
    )
  })

  test('groupByUnique', () => {
    compare(
      Folds.groupByUnique((v: number) => v % 3),
      [[], new Map()],
      [[1], new Map([[1, new Set([1])]])],
      [[1, 5], new Map([[1, new Set([1])], [2, new Set([5])]])],
      [[1, 4], new Map([[1, new Set([1, 4])]])],
      [[1, 4, 1], new Map([[1, new Set([1, 4])]])]
    )
  })

  test('hasValue', () => {
    compare(Folds.hasValue, [[], false], [[1], true], [[1, 2, 3], true])
  })

  test('noValue', () => {
    compare(Folds.noValue, [[], true], [[1], false], [[1, 2, 3], false])
  })

  test('stringAppend', () => {
    compare(Folds.stringAppend, ['', ''], ['a', 'a'], ['abc', 'abc'])
  })

  test('stringPrepend', () => {
    compare(Folds.stringPrepend, ['', ''], ['a', 'a'], ['abc', 'cba'])
  })

  test('choose', () => {
    compare(
      Folds.choose((chosen, next) => isEven(chosen + next)),
      [[], ExpectThrow],
      [[0], 0],
      [[0, 1], 0],
      [[0, 2], 2],
      [[0, 2, 3], 2],
      [[1, 3, 4, 7, 2], 7]
    )
  })

  test('min', () => {
    compare(
      Folds.min(),
      [[], ExpectThrow],
      [[0], 0],
      [[5, 3], 3],
      [[5, 4, 3], 3],
      [[5, 3, 4], 3]
    )
  })

  test('max', () => {
    compare(
      Folds.max(),
      [[], ExpectThrow],
      [[0], 0],
      [[5, 3], 5],
      [[5, 4, 3], 5],
      [[3, 5, 4], 5]
    )
  })

  test('minBy', () => {
    compare(
      Folds.minBy((v: string) => v.length),
      [[], ExpectThrow],
      [[''], ''],
      [['ta', 't'], 't'],
      [['taa', 'ta', 't'], 't'],
      [['ta', 't', 'taa'], 't']
    )
  })

  test('maxBy', () => {
    compare(
      Folds.maxBy((v: string) => v.length),
      [[], ExpectThrow],
      [[''], ''],
      [['ta', 't'], 'ta'],
      [['taa', 'ta', 't'], 'taa'],
      [['ta', 't', 'taa'], 'taa']
    )
  })

  test('range', () => {
    compare(
      Folds.range,
      [[], ExpectThrow],
      [[0], [0, 0]],
      [[1, 0], [0, 1]],
      [[4, 1, 3], [1, 4]]
    )
  })

  test('toObject', () => {
    compare(
      Folds.toObject(),
      [[], {}],
      [[['a', 1]], { a: 1 }],
      [[['b', 2]], { b: 2 }],
      [[['a', 1], ['b', 2]], { a: 1, b: 2 }]
    )
  })

  test('toSet', () => {
    compare(
      Folds.toSet(),
      [[], new Set()],
      [[1], new Set([1])],
      [[1, 2], new Set([1, 2])],
      [[1, 2, 1], new Set([1, 2])]
    )
  })

  test('toMap', () => {
    compare(
      Folds.toMap(),
      [[], new Map()],
      [[[1, 1]], new Map([[1, 1]])],
      [[[1, 1], [2, 2]], new Map([[1, 1], [2, 2]])]
    )
  })

  test('toArray', () => {
    compare(Folds.toArray(), [[], []], [[1], [1]], [[1, 2], [1, 2]])
  })

  test('partition', () => {
    compare(
      Folds.partition(isEven),
      [[], [[], []]],
      [[1], [[], [1]]],
      [[2], [[2], []]],
      [[1, 2], [[2], [1]]]
    )
  })

  test('combine', () => {
    compare(
      Fold.combine(Folds.sum, Folds.product),
      [[], [0, 1]],
      [[1], [1, 1]],
      [[2, 3], [5, 6]],
      [[3, 0, 9], [12, 0]]
    )
  })
})

describe('FoldIter', () => {
  test('sum', () => {
    expect([...Fold.foldIter([], Folds.sum)]).toEqual([])
    expect([...Fold.foldIter([1], Folds.sum)]).toEqual([1])
    expect([...Fold.foldIter([1, 3, 6], Folds.sum)]).toEqual([1, 4, 10])
  })
})
