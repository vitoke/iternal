import { addIndex, isEven, isOdd, isPositive, less3, sum } from './test-utils'
import { Iter, Fold } from '../src/lib/public/iternal'
import { Option } from 'better-option'

const expectIter = <T>(iter: Iter<T>) => (arr: T[]) => expect(iter.toArray()).toEqual(arr)

describe('Iter', () => {
  const iter0 = Iter.empty
  const iter1 = Iter.of(1)
  const iter3 = Iter.of(1, 2, 3)
  const iterInf = Iter.nats()

  test('simple', () => {
    expectIter(iter0)([])
    expectIter(iter1)([1])
    expectIter(iter3)([1, 2, 3])
  })

  test('creation', () => {
    expectIter(Iter.of(1, 2, 3))([1, 2, 3])
    expectIter(Iter.arrayEntries([1, 2, 3]))([[0, 1], [1, 2], [2, 3]])
    expectIter(Iter.mapEntries(new Map([[1, 11], [2, 12]])))([[1, 11], [2, 12]])
    expectIter(Iter.mapKeys(new Map([[1, 11], [2, 12]])))([1, 2])
    expectIter(Iter.mapValues(new Map([[1, 11], [2, 12]])))([11, 12])
    expectIter(Iter.objectEntries({ a: 1, b: 2 }))([['a', 1], ['b', 2]])
    expectIter(Iter.objectKeys({ a: 1, b: 2 }))(['a', 'b'])
    expectIter(Iter.objectValues({ a: 1, b: 2 }))([1, 2])
    expectIter(Iter.sequence(0, v => v + 1).take(5))([0, 1, 2, 3, 4])
    expectIter(Iter.unfold(0, v => [v * 2, v + 1]).take(3))([0, 2, 4])
    expectIter(Iter.fromLazy(() => 1))([1])
    expectIter(Iter.nats().take(3))([0, 1, 2])
    expectIter(Iter.range(0, 6, 2))([0, 2, 4])
    expectIter(Iter.range(6, 0, -2))([6, 4, 2])
    expectIter(Iter.range(0.0, 0.5, 0.2))([0.0, 0.2, 0.4])
    const [s1, s2] = Iter.symbols()
    expect(s1).not.toEqual(s2)
    expectIter(Iter.indexedReversed('abc'))(['c', 'b', 'a'])
    expectIter(Iter.indexedReversed([1, 2, 3]))([3, 2, 1])
    expectIter(Iter.indexedBounce('abc'))(['a', 'b', 'c', 'b'])
    expectIter(Iter.indexedBounce('abcd'))(['a', 'b', 'c', 'd', 'c', 'b'])
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
    expectIter(Iter.of(2).filter(isEven))([2])
    expectIter(iter3.filter(isEven))([2])
    expectIter(iterInf.filter(isEven).take(3))([0, 2, 4])
  })

  test('filterNot', () => {
    expectIter(iter0.filterNot(isEven))([])
    expectIter(iter1.filterNot(isEven))([1])
    expectIter(Iter.of(2).filterNot(isEven))([])
    expectIter(iter3.filterNot(isEven))([1, 3])
    expectIter(iterInf.filterNot(isEven).take(3))([1, 3, 5])
  })

  test('flatMap', () => {
    const toIter = (v: any) => Iter.of(v, v)

    expectIter(iter0.flatMap(toIter))([])
    expectIter(iter1.flatMap(toIter))([1, 1])
    expectIter(iter3.flatMap(toIter))([1, 1, 2, 2, 3, 3])
    expectIter(iterInf.flatMap(toIter).take(4))([0, 0, 1, 1])
  })

  test('collect', () => {
    const evenToString = (v: number) => (isEven(v) ? '' + v : Option.none)

    expectIter(iter0.collect(evenToString))([])
    expectIter(iter1.collect(evenToString))([])
    expectIter(Iter.of(2).collect(evenToString))(['2'])
    expectIter(iter3.collect(evenToString))(['2'])
    expectIter(iterInf.collect(evenToString).take(3))(['0', '2', '4'])
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

  test('firstOpt', () => {
    expect(iter0.fold(Fold.findOpt())).toBe(Option.none)
    expect(iter1.fold(Fold.findOpt())).toBe(1)
    expect(iter3.fold(Fold.findOpt())).toBe(1)
    expect(iterInf.fold(Fold.findOpt())).toBe(0)
  })

  test('firstOrValue', () => {
    expect(iter0.foldOr(undefined, Fold.findOpt())).toBe(undefined)
    expect(iter0.foldOr('a', Fold.findOpt())).toBe('a')
    expect(iter1.foldOr('a', Fold.findOpt())).toBe(1)
    expect(iter3.foldOr('a', Fold.findOpt())).toBe(1)
    expect(iterInf.foldOr('a', Fold.findOpt())).toBe(0)
  })

  test('hasValue', () => {
    expect(iter0.fold(Fold.hasValue)).toBe(false)
    expect(iter1.fold(Fold.hasValue)).toBe(true)
    expect(iter3.fold(Fold.hasValue)).toBe(true)
    expect(iterInf.fold(Fold.hasValue)).toBe(true)
  })

  test('noValue', () => {
    expect(iter0.fold(Fold.noValue)).toBe(true)
    expect(iter1.fold(Fold.noValue)).toBe(false)
    expect(iter3.fold(Fold.noValue)).toBe(false)
    expect(iterInf.fold(Fold.noValue)).toBe(false)
  })

  test('count', () => {
    expect(iter0.fold(Fold.count)).toBe(0)
    expect(iter1.fold(Fold.count)).toBe(1)
    expect(iter3.fold(Fold.count)).toBe(3)
    expect(iterInf.take(100).fold(Fold.count)).toBe(100)
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

  test('take', () => {
    expectIter(iter0.take(10))([])
    expectIter(iter1.take(10))([1])
    expectIter(iter1.take(0))([])
    expectIter(iter3.take(10))([1, 2, 3])
    expectIter(iter3.take(0))([])
    expectIter(iter3.take(2))([1, 2])
    expectIter(iterInf.take(3))([0, 1, 2])
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

  test('findOpt', () => {
    expect(iter0.fold(Fold.findOpt(isEven))).toBe(Option.none)
    expect(iter1.fold(Fold.findOpt(isEven))).toBe(Option.none)
    expect(iter1.fold(Fold.findOpt(isOdd))).toBe(1)
    expect(iter3.fold(Fold.findOpt(isEven))).toBe(2)
    expect(iterInf.fold(Fold.findOpt(isOdd))).toBe(1)
  })

  test('findOrValue', () => {
    expect(iter0.foldOr(undefined, Fold.findOpt(isEven))).toBe(undefined)
    expect(iter0.foldOr('a', Fold.findOpt(isEven))).toBe('a')
    expect(iter1.foldOr('a', Fold.findOpt(isEven))).toBe('a')
    expect(iter1.foldOr('a', Fold.findOpt(isOdd))).toBe(1)
    expect(iter3.foldOr('a', Fold.findOpt(isEven))).toBe(2)
    expect(iterInf.foldOr('a', Fold.findOpt(isOdd))).toBe(1)
  })

  test('some', () => {
    expect(iter0.fold(Fold.some(isEven))).toBe(false)
    expect(iter1.fold(Fold.some(isEven))).toBe(false)
    expect(iter1.fold(Fold.some(isOdd))).toBe(true)
    expect(iter3.fold(Fold.some(isOdd))).toBe(true)
    expect(iterInf.fold(Fold.some(isOdd))).toBe(true)
  })

  test('every', () => {
    expect(iter0.fold(Fold.every(isEven))).toBe(true)
    expect(iter1.fold(Fold.every(isEven))).toBe(false)
    expect(iter1.fold(Fold.every(isOdd))).toBe(true)
    expect(iter3.fold(Fold.every(isOdd))).toBe(false)
    expect(iter3.fold(Fold.every(isOdd))).toBe(false)
    expect(iter3.fold(Fold.every(isPositive))).toBe(true)
    expect(iterInf.fold(Fold.every(isOdd))).toBe(false)
    expect(iterInf.take(1000).fold(Fold.every(isPositive))).toBe(true)
  })

  test('contains', () => {
    expect(iter0.fold(Fold.contains(1))).toBe(false)
    expect(iter1.fold(Fold.contains(1))).toBe(true)
    expect(iter1.fold(Fold.contains(0))).toBe(false)
    expect(iter3.fold(Fold.contains(2))).toBe(true)
    expect(iter3.fold(Fold.contains(5))).toBe(false)
    expect(iterInf.fold(Fold.contains(1000))).toBe(true)
    expect(iterInf.take(1000).fold(Fold.contains(-1))).toBe(false)
  })

  test('fold parallel', () => {
    const sumProduct = Fold.parallel(Fold.sum, Fold.product)

    expect(iter0.fold(sumProduct)).toEqual([0, 1])
    expect(iter1.fold(sumProduct)).toEqual([1, 1])
    expect(iter3.fold(sumProduct)).toEqual([6, 6])
    expect(
      iterInf
        .drop(1)
        .take(10)
        .fold(sumProduct)
    ).toEqual([55, 3628800])
  })

  test('reduceOpt', () => {
    expect(iter0.reduceOpt(sum)).toBe(Option.none)
    expect(iter0.reduceOpt(sum)).toBe(Option.none)
    expect(iter1.reduceOpt(sum)).toBe(1)
    expect(iter3.reduceOpt(sum)).toBe(6)
    expect(iterInf.take(1000).reduceOpt(sum)).toBe(499500)
  })

  test('foldIter', () => {
    expectIter(iter0.foldIter(Fold.sum))([])
    expectIter(iter1.foldIter(Fold.sum))([1])
    expectIter(iter3.foldIter(Fold.sum))([1, 3, 6])
    expectIter(iterInf.foldIter(Fold.sum).take(4))([0, 1, 3, 6])
  })

  test('groupBy', () => {
    expect(iter0.fold(Fold.groupBy(isEven))).toEqual(new Map())
    expect(iter1.fold(Fold.groupBy(isEven))).toEqual(new Map([[false, [1]]]))
    expect(iter3.fold(Fold.groupBy(isEven))).toEqual(new Map([[false, [1, 3]], [true, [2]]]))
    expect(iterInf.take(3).fold(Fold.groupBy(v => v))).toEqual(
      new Map([[0, [0]], [1, [1]], [2, [2]]])
    )
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

  test('repeat', () => {
    expectIter(iter0.repeat())([])
    expectIter(iter1.repeat().take(3))([1, 1, 1])
    expectIter(iter1.repeat(3))([1, 1, 1])
    expectIter(iter3.repeat().take(4))([1, 2, 3, 1])
    expectIter(iter3.repeat(2))([1, 2, 3, 1, 2, 3])
    expectIter(iterInf.repeat().take(4))([0, 1, 2, 3])
  })

  test('sum', () => {
    expect(iter0.fold(Fold.sum)).toBe(0)
    expect(iter1.fold(Fold.sum)).toBe(1)
    expect(iter3.fold(Fold.sum)).toBe(6)
    expect(iterInf.take(3).fold(Fold.sum)).toBe(3)
    expect(iterInf.take(1000).fold(Fold.sum)).toBe(499500)
  })

  test('product', () => {
    expect(iter0.fold(Fold.product)).toBe(1)
    expect(iter1.fold(Fold.product)).toBe(1)
    expect(iter3.fold(Fold.product)).toBe(6)
    expect(
      iterInf
        .map(v => v + 1)
        .take(3)
        .fold(Fold.product)
    ).toBe(6)
    expect(
      iterInf
        .map(v => v + 1)
        .take(10)
        .fold(Fold.product)
    ).toBe(3628800)
  })

  test('average', () => {
    expect(iter0.fold(Fold.average())).toBe(0.0)
    expect(iter1.fold(Fold.average())).toBe(1.0)
    expect(iter3.fold(Fold.average())).toBe(2.0)
    expect(iterInf.take(101).fold(Fold.average())).toBe(50.0)
  })

  test('average iter', () => {
    expectIter(iter0.foldIter(Fold.average()))([])
    expectIter(iter1.foldIter(Fold.average()))([1.0])
    expectIter(iter3.foldIter(Fold.average()))([1.0, 1.5, 2])
    expectIter(iterInf.take(3).foldIter(Fold.average()))([0.0, 0.5, 1.0])
  })

  test('maxOpt', () => {
    expect(iter0.fold(Fold.maxOpt)).toBe(Option.none)
    expect(iter1.fold(Fold.maxOpt)).toBe(1)
    expect(iter3.fold(Fold.maxOpt)).toBe(3)
    expect(iterInf.take(1000).fold(Fold.maxOpt)).toBe(999)
  })

  test('minOpt', () => {
    expect(iter0.fold(Fold.minOpt)).toBe(Option.none)
    expect(iter1.fold(Fold.minOpt)).toBe(1)
    expect(iter3.fold(Fold.minOpt)).toBe(1)
    expect(iterInf.take(1000).fold(Fold.minOpt)).toBe(0)
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

  test('span', () => {
    expect(iter0.fold(Fold.partition(isEven))).toEqual([[], []])
    expect(iter1.fold(Fold.partition(isEven))).toEqual([[], [1]])
    expect(iter3.fold(Fold.partition(isEven))).toEqual([[2], [1, 3]])
  })

  test('monitor', () => {
    let values: number[] = []
    const pushValue = (v: number) => values.push(v)

    iter0.monitor(pushValue).forEach()
    expect(values).toEqual([])

    iter1.monitor(pushValue).forEach()
    expect(values).toEqual([1])

    values = []
    iter3.monitor(pushValue).forEach()
    expect(values).toEqual([1, 2, 3])
  })

  test('substituteWhere', () => {
    const double = (v: any) => [v, v]
    const remove = (v: any) => []

    expectIter(iter0.substituteWhere(isEven, double))([])
    expectIter(iter1.substituteWhere(isEven, double))([1])
    expectIter(iter1.substituteWhere(isOdd, double))([1, 1])
    expectIter(iter1.substituteWhere(isOdd, remove))([])
    expectIter(iter3.substituteWhere(isEven, double))([1, 2, 2, 3])
    expectIter(iter3.substituteWhere(isEven, remove))([1, 3])
  })

  test('substituteElem', () => {
    expectIter(iter0.substituteElem(1, [10, 11]))([])
    expectIter(iter1.substituteElem(0, [10, 11]))([1])
    expectIter(iter1.substituteElem(1, [10, 11]))([10, 11])
    expectIter(iter3.substituteElem(1, [10, 11]))([10, 11, 2, 3])
    expectIter(iter3.substituteElem(2))([1, 3])
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
    expectIter(Iter.fromIterable('po po').splitOnElem(' '))([['p', 'o'], ['p', 'o']])
    expectIter(Iter.fromIterable('po  po').splitOnElem(' '))([['p', 'o'], [], ['p', 'o']])
    expectIter(Iter.fromIterable(' po').splitOnElem(' '))([[], ['p', 'o']])
    expectIter(Iter.fromIterable('po ').splitOnElem(' '))([['p', 'o'], []])
  })

  test('intersperse', () => {
    expectIter(iter0.intersperse(Iter.of(-1)))([])
    expectIter(iter1.intersperse(Iter.of(-1)))([1])
    expectIter(iter3.intersperse(Iter.of(-1)))([1, -1, 2, -1, 3])
    expectIter(iter3.intersperse(Iter.of(-1, -2)))([1, -1, -2, 2, -1, -2, 3])
    expectIter(Iter.fromIterable('ABC').intersperse(Iter.of('ab')))(['A', 'ab', 'B', 'ab', 'C'])
  })

  test('mkGroup', () => {
    expectIter(Iter.empty.mkGroup('(#', ',', '#)'))(['(', '#', '#', ')'])
    expectIter(Iter.of('a').mkGroup('(', ',', ')'))(['(', 'a', ')'])
    expectIter(Iter.fromIterable('abc').mkGroup('(', ',', ')'))(['(', 'a', ',', 'b', ',', 'c', ')'])
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

  test('can process twice', () => {
    const it = iter3.map(addIndex)
    expect(it.fold(Fold.sum)).toBe(12)
    expect(it.fold(Fold.sum)).toBe(12)
  })

  test('can process many', () => {
    expect(
      iterInf.fold(
        Fold.parallelMany<number>(
          Fold.hasValue,
          Fold.noValue,
          Fold.product,
          Fold.findOpt(v => v > 100),
          Fold.some(v => v > 200),
          Fold.every(v => v < 300),
          Fold.findOpt()
        )
      )
    ).toEqual([true, false, 0, 101, true, false, 0])
  })
})
