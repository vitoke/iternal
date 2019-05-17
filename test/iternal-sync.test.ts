import { Iter, iter } from '../src/lib/public/iternal'
import { addIndex, double, isEven, isOdd, less3, remove, sum } from './test-utils'

const expectIter = <T>(iter: Iter<T>) => (resIt: Iterable<T>) =>
  expect(iter.toArray()).toEqual([...resIt])

describe('Iter', () => {
  const iter0 = iter.empty<number>()
  const iter1 = iter.of(1)
  const iter3 = iter.of(1, 2, 3)
  const iterInf = iter.nats

  test('simple', () => {
    expectIter(iter0)([])
    expectIter(iter1)([1])
    expectIter(iter3)([1, 2, 3])
  })

  test('creation', () => {
    expectIter(iter.of(1, 2, 3))([1, 2, 3])
    expectIter(iter.arrayEntries([1, 2, 3]))([[0, 1], [1, 2], [2, 3]])
    expectIter(iter.mapEntries(new Map([[1, 11], [2, 12]])))([[1, 11], [2, 12]])
    expectIter(iter.mapKeys(new Map([[1, 11], [2, 12]])))([1, 2])
    expectIter(iter.mapValues(new Map([[1, 11], [2, 12]])))([11, 12])
    expectIter(iter.objectEntries({ a: 1, b: 2 }))([['a', 1], ['b', 2]])
    expectIter(iter.objectKeys({ a: 1, b: 2 }))(['a', 'b'])
    expectIter(iter.objectValues({ a: 1, b: 2 }))([1, 2])
    expectIter(iter.generate(0, v => v + 1).take(5))([0, 1, 2, 3, 4])
    expectIter(iter.unfold(0, v => [v * 2, v + 1]).take(3))([0, 2, 4])
    expectIter(iter.fromLazy(() => 1))([1])
    expectIter(iter.nats.take(3))([0, 1, 2])
    expectIter(iter.range(0, 0))([])
    expectIter(iter.range(0, 6, 2))([0, 2, 4])
    expectIter(iter.range(6, 0, -2))([6, 4, 2])
    expectIter(iter.range(0.0, 0.5, 0.2))([0.0, 0.2, 0.4])
    const [s1, s2] = iter.symbols
    expect(s1).not.toEqual(s2)
    expectIter(iter.indexedReversed('abc'))(['c', 'b', 'a'])
    expectIter(iter.indexedReversed([1, 2, 3]))([3, 2, 1])
    expectIter(iter.indexedBounce('abc'))(['a', 'b', 'c', 'b'])
    expectIter(iter.indexedBounce('abcd'))(['a', 'b', 'c', 'd', 'c', 'b'])
  })

  test('forEach', () => {
    let count = 0
    const increase = (v: number, i: number) => (count += v + i)

    iter0.forEach(increase)
    iter1.forEach(increase)
    iter3.forEach(increase)

    expect(count).toBe(10)
  })

  test('map', () => {
    expectIter(iter0.map(addIndex))([])
    expectIter(iter1.map(addIndex))([2])
    expectIter(iter3.map(addIndex))([2, 4, 6])
    expectIter(iterInf.map(addIndex).take(3))([1, 3, 5])
  })

  test('filter', () => {
    expectIter(iter0.filter(isEven))([])
    expectIter(iter1.filter(isEven))([])
    expectIter(iter.of(2).filter(isEven))([2])
    expectIter(iter3.filter(isEven))([2])
    expectIter(iterInf.filter(isEven).take(3))([0, 2, 4])
  })

  test('filterNot', () => {
    expectIter(iter0.filterNot(isEven))([])
    expectIter(iter1.filterNot(isEven))([1])
    expectIter(iter.of(2).filterNot(isEven))([])
    expectIter(iter3.filterNot(isEven))([1, 3])
    expectIter(iterInf.filterNot(isEven).take(3))([1, 3, 5])
  })

  test('filterWithLast', () => {
    let currentValues: any[] = []
    let lastValues: any[] = []
    let pushValues = (result: boolean) => (c: any, l: any) => {
      currentValues.push(c)
      lastValues.push(l)
      return result
    }
    let exp = (cvs: any[], lvs: any[]) => {
      expect(currentValues).toEqual(cvs)
      expect(lastValues).toEqual(lvs)
    }
    expectIter(iter0.filterWithPrevious(pushValues(true)))([])
    exp([], [])

    expectIter(iter1.filterWithPrevious(pushValues(true)))([1])
    exp([1], [undefined])
    expectIter(iter1.filterWithPrevious(pushValues(false)))([])

    currentValues = []
    lastValues = []
    expectIter(iter3.filterWithPrevious(pushValues(true)))([1, 2, 3])
    exp([1, 2, 3], [undefined, 1, 2])
  })

  test('filterChanged', () => {
    expectIter(iter0.filterChanged())([])
    expectIter(iter1.filterChanged())([1])
    expectIter(iter3.filterChanged())([1, 2, 3])
    expectIter(iter.of(1, 2, 2, 3, 3, 1, 3, 3, 3).filterChanged())([1, 2, 3, 1, 3])
  })

  test('flatMap', () => {
    const toIter = (v: any) => iter.of(v, v)

    expectIter(iter0.flatMap(toIter))([])
    expectIter(iter1.flatMap(toIter))([1, 1])
    expectIter(iter3.flatMap(toIter))([1, 1, 2, 2, 3, 3])
    expectIter(iterInf.flatMap(toIter).take(4))([0, 0, 1, 1])
  })

  test('concat', () => {
    expectIter(iter0.concat(iter0))([])
    expectIter(iter0.concat(iter0, iter0, iter0))([])
    expectIter(iter0.concat(iter3))([1, 2, 3])
    expectIter(iter3.concat(iter0))([1, 2, 3])
    expectIter(iter3.concat(iter3))([1, 2, 3, 1, 2, 3])
    expectIter(iter3.concat(iter3, iter3))([1, 2, 3, 1, 2, 3, 1, 2, 3])
    expectIter(iterInf.concat(iterInf).take(3))([0, 1, 2])
  })

  test('append', () => {
    expectIter(iter0.append(1))([1])
    expectIter(iter0.append(1, 2))([1, 2])
    expectIter(iter3.append(1, 2))([1, 2, 3, 1, 2])
    expectIter(iterInf.append(1, 2).take(3))([0, 1, 2])
  })

  test('prepend', () => {
    expectIter(iter0.prepend(1))([1])
    expectIter(iter0.prepend(1, 2))([1, 2])
    expectIter(iter3.prepend(1, 2))([1, 2, 1, 2, 3])
    expectIter(iterInf.prepend(1, 2).take(3))([1, 2, 0])
  })

  test('drop', () => {
    expectIter(iter0.drop(10))([])
    expectIter(iter1.drop(10))([])
    expectIter(iter1.drop(0))([1])
    expectIter(iter3.drop(10))([])
    expectIter(iter3.drop(0))([1, 2, 3])
    expectIter(iter3.drop(1))([2, 3])
    expectIter(iterInf.drop(10).take(3))([10, 11, 12])
  })

  test('dropLast', () => {
    expectIter(iter0.dropLast(0))([])
    expectIter(iter0.dropLast(3))([])
    expectIter(iter1.dropLast(0))([1])
    expectIter(iter1.dropLast(1))([])
    expectIter(iter1.dropLast(3))([])
    expectIter(iter3.dropLast(0))([1, 2, 3])
    expectIter(iter3.dropLast(1))([1, 2])
    expectIter(iter3.dropLast(2))([1])
    expectIter(iter.range(0, 10).dropLast(6))([0, 1, 2, 3])
  })

  test('take', () => {
    expectIter(iter0.take(10))([])
    expectIter(iter1.take(10))([1])
    expectIter(iter1.take(0))([])
    expectIter(iter3.take(10))([1, 2, 3])
    expectIter(iter3.take(0))([])
    expectIter(iter3.take(2))([1, 2])
    expectIter(iterInf.take(3))([0, 1, 2])
  })

  test('takeLast', () => {
    expectIter(iter0.takeLast(0))([])
    expectIter(iter0.takeLast(3))([])
    expectIter(iter1.takeLast(0))([])
    expectIter(iter1.takeLast(1))([1])
    expectIter(iter1.takeLast(3))([1])
    expectIter(iter3.takeLast(0))([])
    expectIter(iter3.takeLast(1))([3])
    expectIter(iter3.takeLast(2))([2, 3])
    expectIter(iter.range(0, 10).takeLast(6))([4, 5, 6, 7, 8, 9])
  })

  test('slice', () => {
    expectIter(iter0.slice(1, 3))([])
    expectIter(iter1.slice(1, 3))([])
    expectIter(iter1.slice(0, 3))([1])
    expectIter(iter1.slice(0, 0))([])
    expectIter(iter3.slice(0, 0))([])
    expectIter(iter3.slice(1, 1))([2])
    expectIter(iter3.slice(1, 2))([2, 3])
    expectIter(iterInf.slice(100, 3))([100, 101, 102])
  })

  test('indicesOf', () => {
    expectIter(iter0.indicesOf(0))([])
    expectIter(iter('a').indicesOf('a'))([0])
    expectIter(iter('a').indicesOf('b'))([])
    expectIter(iter('babbaab').indicesOf('a'))([1, 4, 5])
  })

  test('takeWhile', () => {
    expectIter(iter0.takeWhile(less3))([])
    expectIter(iter1.takeWhile(less3))([1])
    expectIter(iter3.takeWhile(less3))([1, 2])
    expectIter(iterInf.takeWhile(less3))([0, 1, 2])
  })

  test('dropWhile', () => {
    expectIter(iter0.dropWhile(less3))([])
    expectIter(iter1.dropWhile(less3))([])
    expectIter(iter3.dropWhile(less3))([3])
    expectIter(iterInf.dropWhile(less3).take(3))([3, 4, 5])
  })

  test('reduce', () => {
    expect(() => iter0.reduce(sum)).toThrow()
    expect(iter0.reduce(sum, 0)).toBe(0)
    expect(iter0.reduce(sum, () => 0)).toBe(0)
    expect(iter1.reduce(sum)).toBe(1)
    expect(iter3.reduce(sum)).toBe(6)
    expect(iterInf.take(1000).reduce(sum)).toBe(499500)
  })

  test('zipWith', () => {
    expectIter(iter0.zipWith(sum, iterInf))([])
    expectIter(iter1.zipWith(sum, iterInf))([1])
    expectIter(iter3.zipWith(sum, iterInf))([1, 3, 5])
    expectIter(iterInf.take(3).zipWith(sum, iterInf))([0, 2, 4])
    expectIter(iterInf.zipWith(sum, iterInf.take(3)))([0, 2, 4])
  })

  test('zip', () => {
    expectIter(iter0.zip(iter0))([])
    expectIter(iter0.zip(iter0, iter0, iter0))([])
    expectIter(iter1.zip(iter0))([])
    expectIter(iter1.zip(iter1))([[1, 1]])
    expectIter(iter1.zip(iter1, iter1))([[1, 1, 1]])
    expectIter(iter1.zip(iterInf))([[1, 0]])
    expectIter(iter3.zip(iter1))([[1, 1]])
    expectIter(iter3.zip(iterInf))([[1, 0], [2, 1], [3, 2]])
    expectIter(iterInf.zip(iter3))([[0, 1], [1, 2], [2, 3]])
    expectIter(iterInf.zip(iterInf).take(3))([[0, 0], [1, 1], [2, 2]])
    expectIter(iterInf.zip(iterInf, iter3))([[0, 0, 1], [1, 1, 2], [2, 2, 3]])
  })

  test('zipWithIndex', () => {
    expectIter(iter0.zipWithIndex())([])
    expectIter(iter1.zipWithIndex())([[1, 0]])
    expectIter(iter3.zipWithIndex())([[1, 0], [2, 1], [3, 2]])
    expectIter(iterInf.zipWithIndex().take(3))([[0, 0], [1, 1], [2, 2]])
  })

  test('zipAll', () => {
    expectIter(iter0.zipAll(iter0))([])
    expectIter(iter0.zipAll(iter0, iter0, iter0))([])
    expectIter(iter0.zipAll(iter1))([[undefined, 1]])
    expectIter(iter1.zipAll(iter0))([[1, undefined]])
    expectIter(iter1.zipAll(iter1))([[1, 1]])
    expectIter(iter1.zipAll(iter1, iter0))([[1, 1, undefined]])
    expectIter(iter3.zipAll(iter1))([[1, 1], [2, undefined], [3, undefined]])
    expectIter(iter0.zipAll(iter1, iter3))([
      [undefined, 1, 1],
      [undefined, undefined, 2],
      [undefined, undefined, 3]
    ])
  })

  test('interleave', () => {
    expectIter(iter0.interleave(iterInf))([])
    expectIter(iter1.interleave(iterInf))([1, 0])
    expectIter(iter3.interleave(iterInf))([1, 0, 2, 1, 3, 2])
    expectIter(iterInf.interleave(iter3))([0, 1, 1, 2, 2, 3])
    expectIter(iterInf.interleave(iterInf, iterInf).take(6))([0, 0, 0, 1, 1, 1])
  })

  test('interleaveAll', () => {
    expectIter(iter0.interleaveAll(iter0))([])
    expectIter(iter0.interleaveAll(iter1))([1])
    expectIter(iter0.interleaveAll(iter3))([1, 2, 3])
    expectIter(iter1.interleaveAll(iter0))([1])
    expectIter(iter1.interleaveAll(iter1))([1, 1])
    expectIter(iter1.interleaveAll(iter3))([1, 1, 2, 3])
    expectIter(iter3.interleaveAll(iter0))([1, 2, 3])
    expectIter(iter3.interleaveAll(iter1))([1, 1, 2, 3])
    expectIter(iter3.interleaveAll(iter3))([1, 1, 2, 2, 3, 3])
    expectIter(iter3.interleaveAll(iter.range(10, 15), iter.of(100)))([
      1,
      10,
      100,
      2,
      11,
      3,
      12,
      13,
      14
    ])
  })

  test('interleaveRound', () => {
    expectIter(iter0.interleaveRound(iter0))([])
    expectIter(iter0.interleaveRound(iter1))([])
    expectIter(iter1.interleaveRound(iter0))([])
    expectIter(iter1.interleaveRound(iter.of(2)).take(5))([1, 2, 1, 2, 1])
    expectIter(iter1.interleaveRound(iter3).take(8))([1, 1, 1, 2, 1, 3, 1, 1])
  })

  test('repeat', () => {
    expectIter(iter0.repeat())([])
    expectIter(iter1.repeat().take(3))([1, 1, 1])
    expectIter(iter1.repeat(3))([1, 1, 1])
    expectIter(iter3.repeat().take(4))([1, 2, 3, 1])

    expectIter(iter3.repeat(2))([1, 2, 3, 1, 2, 3])
    expectIter(iterInf.repeat().take(4))([0, 1, 2, 3])
  })

  test('join', () => {
    expect(iter0.join()).toEqual('')
    expect(iter0.join(',')).toEqual('')
    expect(iter0.join(',', '(', ')')).toEqual('()')
    expect(iter1.join()).toEqual('1')
    expect(iter1.join(',')).toEqual('1')
    expect(iter1.join(',', '(', ')')).toEqual('(1)')
    expect(iter3.join()).toEqual('123')
    expect(iter3.join(',')).toEqual('1,2,3')
    expect(iter3.join(',', '(', ')')).toEqual('(1,2,3)')
  })

  test('distinct', () => {
    expectIter(iter0.distinct())([])
    expectIter(iter1.distinct())([1])
    expectIter(iter1.repeat(10).distinct())([1])
    expectIter(iter3.distinct())([1, 2, 3])
    expectIter(iter3.repeat(10).distinct())([1, 2, 3])
  })

  test('sliding', () => {
    expectIter(iter0.sliding(2))([])
    expectIter(iter1.sliding(2))([[1]])
    expectIter(iter3.sliding(2))([[1, 2], [3]])
    expectIter(iter3.sliding(2, 1))([[1, 2], [2, 3]])
    expectIter(iter3.sliding(2, 4))([[1, 2]])
    expectIter(iterInf.sliding(2, 4).take(2))([[0, 1], [4, 5]])
  })

  test('sample', () => {
    expectIter(iter0.sample(2))([])
    expectIter(iter1.sample(2))([1])
    expectIter(iter3.sample(2))([1, 3])
    expectIter(iterInf.sample(1000).take(3))([0, 1000, 2000])
  })

  test('monitor', () => {
    let values: number[] = []
    const pushValue = (v: number) => values.push(v)

    iter0.monitor('', pushValue).forEach()
    expect(values).toEqual([])

    iter1.monitor('', pushValue).forEach()
    expect(values).toEqual([1])

    values = []
    iter3.monitor('', pushValue).forEach()
    expect(values).toEqual([1, 2, 3])

    values = []
    iter3
      .monitor('', pushValue)
      .monitor('', pushValue)
      .forEach()
    expect(values).toEqual([1, 1, 2, 2, 3, 3])
  })

  test('patchAt', () => {
    expectIter(iter0.patchAt(0, 1))([])
    expectIter(iter0.patchAt(0, 0, () => iter1))([1])
    expectIter(iter0.patchAt(0, 10, () => iter1))([1])
    expectIter(iter0.patchAt(-10, 0, () => iter1))([1])
    expectIter(iter1.patchAt(-10, 0, () => iter.of(2)))([2, 1])
    expectIter(iter1.patchAt(-10, 10, () => iter.of(2)))([2])
    expectIter(iter1.patchAt(0, 0, () => iter.of(2)))([2, 1])
    expectIter(iter1.patchAt(1, 0, () => iter.of(2)))([1, 2])
    expectIter(iter1.patchAt(10, 10, () => iter.of(2)))([1, 2])
    expectIter(iter1.patchAt(100, 0, () => iter.of(2)))([1, 2])
    expectIter(iter3.patchAt(-10, 0, () => iter.of(9)))([9, 1, 2, 3])
    expectIter(iter3.patchAt(0, 0, () => iter.of(9)))([9, 1, 2, 3])
    expectIter(iter3.patchAt(1, 0, () => iter.of(9)))([1, 9, 2, 3])
    expectIter(iter3.patchAt(100, 0, () => iter.of(9)))([1, 2, 3, 9])
    expectIter(iter3.patchAt(0, 1, () => iter.of(9)))([9, 2, 3])
    expectIter(iter3.patchAt(1, 1, () => iter.of(9)))([1, 9, 3])
    expectIter(iter3.patchAt(100, 1, () => iter.of(9)))([1, 2, 3, 9])
  })

  test('patchWhere', () => {
    expectIter(iter0.patchWhere(isEven, 1, double))([])
    expectIter(iter1.patchWhere(isEven, 1, double))([1])
    expectIter(iter1.patchWhere(isOdd, 1, double))([1, 1])
    expectIter(iter1.patchWhere(isOdd, 1, remove))([])
    expectIter(iter3.patchWhere(isEven, 1, double))([1, 2, 2, 3])
    expectIter(iter3.patchWhere(isEven, 0, double))([1, 2, 2, 2, 3])
    expectIter(iter3.patchWhere(isEven, 1, remove))([1, 3])
  })

  test('patchElem', () => {
    expectIter(iter0.patchElem(1, 1, [10, 11]))([])
    expectIter(iter1.patchElem(0, 1, [10, 11]))([1])
    expectIter(iter1.patchElem(1, 1, [10, 11]))([10, 11])
    expectIter(iter3.patchElem(1, 1, [10, 11]))([10, 11, 2, 3])
    expectIter(iter3.patchElem(2, 1))([1, 3])
  })

  test('patchWhere amount', () => {
    expectIter(iter0.patchWhere(isEven, 1, () => iter.of(10), 1))([])
    expectIter(iter1.patchWhere(isEven, 0, () => iter.of(10), 1))([1])
    expectIter(iter1.patchWhere(isOdd, 0, () => iter.of(10), 1))([10, 1])
    expectIter(iter1.patchWhere(isOdd, 1, () => iter.of(10), 1))([10])
    expectIter(iter.range(0, 5).patchWhere(isOdd, 1, () => iter.of(10), 1))([0, 10, 2, 3, 4])
    expectIter(iter.range(0, 5).patchWhere(isOdd, 0, () => iter.of(10), 1))([0, 10, 1, 2, 3, 4])
    expectIter(iter.range(0, 6).patchWhere(isOdd, 1, () => iter.of(10), 2))([0, 10, 2, 10, 4, 5])
    expectIter(iter.range(0, 6).patchWhere(isOdd, 1, undefined, 2))([0, 2, 4, 5])
  })

  test('patchElem amount', () => {
    expectIter(iter('').patchElem('a', 0, 'ab', 1))('')
    expectIter(iter('a').patchElem('a', 0, 'XX', 1))('XXa')
    expectIter(iter('a').patchElem('a', 1, 'XX', 1))('XX')
    expectIter(iter('b').patchElem('a', 0, 'XX', 1))('b')
    expectIter(iter('bac').patchElem('a', 0, 'XX', 1))('bXXac')
    expectIter(iter('bacadata').patchElem('a', 0, 'XX', 2))('bXXacXXadata')
    expectIter(iter('bacadata').patchElem('a', 1, 'XX', 2))('bXXcXXdata')
  })

  test('splitWhere', () => {
    expectIter(iter0.splitWhere(isEven))([])
    expectIter(iter1.splitWhere(isEven))([[1]])
    expectIter(iter1.splitWhere(isOdd))([[], []])
    expectIter(iter3.splitWhere(isOdd))([[], [2], []])
    expectIter(iter3.splitWhere(isEven))([[1], [3]])
  })

  test('splitOnElem', () => {
    expectIter(iter0.splitOnElem(1))([])
    expectIter(iter('po po').splitOnElem(' '))([['p', 'o'], ['p', 'o']])
    expectIter(iter('po  po').splitOnElem(' '))([['p', 'o'], [], ['p', 'o']])
    expectIter(iter(' po').splitOnElem(' '))([[], ['p', 'o']])
    expectIter(iter('po ').splitOnElem(' '))([['p', 'o'], []])
  })

  test('intersperse', () => {
    expectIter(iter0.intersperse(iter.of(-1)))([])
    expectIter(iter1.intersperse(iter.of(-1)))([1])
    expectIter(iter3.intersperse(iter.of(-1)))([1, -1, 2, -1, 3])
    expectIter(iter3.intersperse(iter.of(-1, -2)))([1, -1, -2, 2, -1, -2, 3])
    expectIter(iter('ABC').intersperse(iter.of('ab')))(['A', 'ab', 'B', 'ab', 'C'])
  })

  test('mkGroup', () => {
    expectIter(iter.empty().mkGroup('(#', ',', '#)'))(['(', '#', '#', ')'])
    expectIter(iter.of('a').mkGroup('(', ',', ')'))(['(', 'a', ')'])
    expectIter(iter('abc').mkGroup('(', ',', ')'))(['(', 'a', ',', 'b', ',', 'c', ')'])
  })

  test('toString', () => {
    expect(iter0.toString()).toEqual('[Iter]')
    expect(iter1.toString()).toEqual('[Iter]')
    expect(iter3.toString()).toEqual('[Iter]')
    expect(iterInf.toString()).toEqual('[Iter]')
  })

  test('toArray', () => {
    expect(iter0.toArray()).toEqual([])
    expect(iter1.toArray()).toEqual([1])
    expect(iter3.toArray()).toEqual([1, 2, 3])
  })

  test('toSet', () => {
    expect(iter0.toSet()).toEqual(new Set())
    expect(iter1.toSet()).toEqual(new Set([1]))
    expect(iter3.toSet()).toEqual(new Set([1, 2, 3]))
  })
})
