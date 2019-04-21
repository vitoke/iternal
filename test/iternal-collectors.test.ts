import iter, { Op, ops } from '../src/lib/public/iternal'
import { isEven } from './test-utils'

const ExpectThrow = Symbol()
type ExpectThrow = typeof ExpectThrow

const compare = <I, O>(op: Op<I, O>, ...is: [Iterable<I>, O | ExpectThrow][]) =>
  is.forEach(([i, o]) => {
    if (o === ExpectThrow) {
      return expect(() => iter(i).collect(op)).toThrow()
    }
    expect(iter(i).collect(op)).toEqual(o)
  })

describe('Collect', () => {
  test('and', () => {
    compare(
      ops.and,
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
      ops.or,
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
      ops.sum,
      [[], 0],
      [[0], 0],
      [[10], 10],
      [[10, 20], 30],
      [[-10.5, 10.5], 0],
      [iter.range(1, 50), 1225]
    )
  })

  test('product', () => {
    compare(
      ops.product,
      [[], 1],
      [[0], 0],
      [[10], 10],
      [[10, 20], 200],
      [[-10, 10], -100],
      [iter.range(1, 10), 362880],
      [iter.nats, 0]
    )
  })

  test('average', () => {
    compare(
      ops.average,
      [[], 0],
      [[0], 0],
      [[10], 10],
      [[10, 20], 15],
      [[-10.5, 10.5], 0],
      [iter.range(1, 50), 25]
    )
  })

  test('contains', () => {
    compare(
      ops.contains('#'),
      ['', false],
      ['a', false],
      ['#', true],
      ['ab', false],
      ['ab#a', true]
    )
  })

  test('count', () => {
    compare<any, number>(ops.count, ['', 0], ['a', 1], [iter.range(0, 50), 50])
  })

  test('elemAt', () => {
    compare<any, any>(
      ops.elemAt(1),
      ['', ExpectThrow],
      ['a', ExpectThrow],
      ['ab', 'b'],
      ['abc', 'b']
    )
    compare(ops.elemAt(1, 'X'), ['', 'X'], ['a', 'X'], ['ab', 'b'], ['abc', 'b'])
    compare(ops.elemAt(1, () => 'X'), ['', 'X'], ['a', 'X'], ['ab', 'b'], ['abc', 'b'])
  })

  test('every', () => {
    compare(
      ops.every(isEven),
      [[], true],
      [[0], true],
      [[1], false],
      [[0, 2, 4], true],
      [[0, 2, 5], false],
      [iter.range(0, 100, 2), true]
    )
  })

  test('some', () => {
    compare(
      ops.some(isEven),
      [[], false],
      [[0], true],
      [[1], false],
      [[1, 3, 5], false],
      [[1, 2, 6], true],
      [iter.range(0, 100, 2), true],
      [iter.range(1, 100, 2), false]
    )
  })

  test('first', () => {
    compare(ops.first(), ['', ExpectThrow], ['a', 'a'], ['abc', 'a'])
    compare(ops.first('X'), ['', 'X'], ['a', 'a'], ['abc', 'a'])
    compare(ops.first(() => 'X'), ['', 'X'], ['a', 'a'], ['abc', 'a'])
  })

  test('last', () => {
    compare(ops.last(), ['', ExpectThrow], ['a', 'a'], ['abc', 'c'])
    compare(ops.last('X'), ['', 'X'], ['a', 'a'], ['abc', 'c'])
    compare(ops.last(() => 'X'), ['', 'X'], ['a', 'a'], ['abc', 'c'])
  })

  test('find', () => {
    compare(ops.find(isEven), [[], ExpectThrow], [[1], ExpectThrow], [[0], 0], [[1, 3, 4], 4])
    compare(ops.find(isEven, -10), [[], -10], [[1], -10], [[0], 0], [[1, 3, 4], 4])
    compare(ops.find(isEven, () => -10), [[], -10], [[1], -10], [[0], 0], [[1, 3, 4], 4])
  })

  test('findLast', () => {
    compare(
      ops.findLast(isEven),
      [[], ExpectThrow],
      [[1], ExpectThrow],
      [[0], 0],
      [[0, 2, 3, 4], 4]
    )
    compare(ops.findLast(isEven, -10), [[], -10], [[1], -10], [[0], 0], [[0, 2, 3, 4], 4])
    compare(ops.findLast(isEven, () => -10), [[], -10], [[1], -10], [[0], 0], [[0, 2, 3, 4], 4])
  })

  test('histogram', () => {
    compare(
      ops.histogram(),
      ['', new Map()],
      ['a', new Map([['a', 1]])],
      ['ab', new Map([['a', 1], ['b', 1]])],
      ['abcb', new Map([['a', 1], ['b', 2], ['c', 1]])]
    )
  })

  // test('elementsByFreq', () => {
  //   compare(
  //     Collectors.elementsByFreq<string>(),
  //     ['', new Map()],
  //     ['a', new Map([[1, new Set(['a'])]])],
  //     ['aa', new Map([[2, new Set(['a'])]])],
  //     ['aba', new Map([[2, new Set(['a'])], [1, new Set(['b'])]])]
  //   )
  // })

  test('groupBy', () => {
    compare(
      ops.groupBy((v: number) => v % 3),
      [[], new Map()],
      [[1], new Map([[1, [1]]])],
      [[1, 5], new Map([[1, [1]], [2, [5]]])],
      [[1, 4], new Map([[1, [1, 4]]])],
      [[1, 4, 1], new Map([[1, [1, 4, 1]]])]
    )
  })

  test('groupByUnique', () => {
    compare(
      ops.groupByUnique((v: number) => v % 3),
      [[], new Map()],
      [[1], new Map([[1, new Set([1])]])],
      [[1, 5], new Map([[1, new Set([1])], [2, new Set([5])]])],
      [[1, 4], new Map([[1, new Set([1, 4])]])],
      [[1, 4, 1], new Map([[1, new Set([1, 4])]])]
    )
  })

  test('hasValue', () => {
    compare(ops.hasValue, [[], false], [[1], true], [[1, 2, 3], true])
  })

  test('noValue', () => {
    compare(ops.noValue, [[], true], [[1], false], [[1, 2, 3], false])
  })

  test('stringAppend', () => {
    compare(ops.stringAppend, ['', ''], ['a', 'a'], ['abc', 'abc'])
  })

  test('stringPrepend', () => {
    compare(ops.stringPrepend, ['', ''], ['a', 'a'], ['abc', 'cba'])
  })

  test('choose', () => {
    compare(
      ops.choose<number>((chosen, next) => isEven(chosen + next)),
      [[], ExpectThrow],
      [[0], 0],
      [[0, 1], 0],
      [[0, 2], 2],
      [[0, 2, 3], 2],
      [[1, 3, 4, 7, 2], 7]
    )
  })

  test('min', () => {
    compare(ops.min(), [[], ExpectThrow], [[0], 0], [[5, 3], 3], [[5, 4, 3], 3], [[5, 3, 4], 3])
  })

  test('max', () => {
    compare(ops.max(), [[], ExpectThrow], [[0], 0], [[5, 3], 5], [[5, 4, 3], 5], [[3, 5, 4], 5])
  })

  test('minBy', () => {
    compare(
      ops.minBy((v: string) => v.length),
      [[], ExpectThrow],
      [[''], ''],
      [['ta', 't'], 't'],
      [['taa', 'ta', 't'], 't'],
      [['ta', 't', 'taa'], 't']
    )
  })

  test('maxBy', () => {
    compare(
      ops.maxBy((v: string) => v.length),
      [[], ExpectThrow],
      [[''], ''],
      [['ta', 't'], 'ta'],
      [['taa', 'ta', 't'], 'taa'],
      [['ta', 't', 'taa'], 'taa']
    )
  })

  test('range', () => {
    compare(ops.range, [[], ExpectThrow], [[0], [0, 0]], [[1, 0], [0, 1]], [[4, 1, 3], [1, 4]])
  })

  test('toObject', () => {
    compare(
      ops.toObject(),
      [[], {}],
      [[['a', 1]], { a: 1 }],
      [[['b', 2]], { b: 2 }],
      [[['a', 1], ['b', 2]], { a: 1, b: 2 }]
    )
  })

  test('toSet', () => {
    compare(
      ops.toSet(),
      [[], new Set()],
      [[1], new Set([1])],
      [[1, 2], new Set([1, 2])],
      [[1, 2, 1], new Set([1, 2])]
    )
  })

  test('toMap', () => {
    compare(
      ops.toMap(),
      [[], new Map()],
      [[[1, 1]], new Map([[1, 1]])],
      [[[1, 1], [2, 2]], new Map([[1, 1], [2, 2]])]
    )
  })

  test('toArray', () => {
    compare(ops.toArray(), [[], []], [[1], [1]], [[1, 2], [1, 2]])
  })

  test('partition', () => {
    compare(
      ops.partition(isEven),
      [[], [[], []]],
      [[1], [[], [1]]],
      [[2], [[2], []]],
      [[1, 2], [[2], [1]]]
    )
  })

  test('combine', () => {
    compare(
      Op.combine(ops.sum, ops.product),
      [[], [0, 1]],
      [[1], [1, 1]],
      [[2, 3], [5, 6]],
      [[3, 0, 9], [12, 0]]
    )
  })
})

describe('CollectIter', () => {
  test('sum', () => {
    expect([...iter(new Array<number>()).collectIter(ops.sum)]).toEqual([])
    expect([...iter([1]).collectIter(ops.sum)]).toEqual([1])
    expect([...iter([1, 3, 6]).collectIter(ops.sum)]).toEqual([1, 4, 10])
  })
})
