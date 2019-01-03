import { addIndex, isEven, isOdd, isPositive, less3, sum } from './test-utils'
import { Iter, AsyncIter, Fold } from '../src/lib/public/iternal'
import { Option } from 'better-option'

const expectAsyncIter = <T>(iter: AsyncIter<T>) => async (arr: T[]) =>
  expect(await iter.fold(Fold.toArray())).toEqual(arr)

const expectAsyncToThrow = async (f: () => void) => {
  let succeeded = false

  try {
    await f()
    succeeded = true
    // tslint:disable-next-line:no-empty
  } catch (e) {}

  if (succeeded) throw new Error('should have thrown')
}

describe('AsyncIter', () => {
  const iter0 = AsyncIter.empty
  const iter1 = AsyncIter.fromIterator<number>(async function*() {
    yield 1
  })
  const iter3 = AsyncIter.fromIterator<number>(async function*() {
    yield 1
    yield 2
    yield 3
  })
  const iterInf = AsyncIter.fromIterator<number>(async function*() {
    yield* Iter.nats()
  })

  test('simple', async () => {
    await expectAsyncIter(iter0)([])
    await expectAsyncIter(iter1)([1])
    await expectAsyncIter(iter3)([1, 2, 3])
  })

  test('forEach', async () => {
    let count = 0
    const increase = (v: number, i: number) => (count += v + i)

    await iter0.forEach(increase)
    await iter1.forEach(increase)
    await iter3.forEach(increase)

    expect(count).toBe(10)
  })

  test('map', async () => {
    await expectAsyncIter(iter0.map(addIndex))([])
    await expectAsyncIter(iter1.map(addIndex))([2])
    await expectAsyncIter(iter3.map(addIndex))([2, 4, 6])
    await expectAsyncIter(iterInf.map(addIndex).take(3))([1, 3, 5])
  })

  test('filter', async () => {
    await expectAsyncIter(iter0.filter(isEven))([])
    await expectAsyncIter(iter1.filter(isEven))([])
    await expectAsyncIter(AsyncIter.of(2).filter(isEven))([2])
    await expectAsyncIter(iter3.filter(isEven))([2])
    await expectAsyncIter(iterInf.filter(isEven).take(3))([0, 2, 4])
  })

  test('filterNot', async () => {
    await expectAsyncIter(iter0.filterNot(isEven))([])
    await expectAsyncIter(iter1.filterNot(isEven))([1])
    await expectAsyncIter(AsyncIter.of(2).filterNot(isEven))([])
    await expectAsyncIter(iter3.filterNot(isEven))([1, 3])
    await expectAsyncIter(iterInf.filterNot(isEven).take(3))([1, 3, 5])
  })

  test('flatMap', async () => {
    const toIter = (v: any) => AsyncIter.of(v, v)

    await expectAsyncIter(iter0.flatMap(toIter))([])
    await expectAsyncIter(iter1.flatMap(toIter))([1, 1])
    await expectAsyncIter(iter3.flatMap(toIter))([1, 1, 2, 2, 3, 3])
    await expectAsyncIter(iterInf.flatMap(toIter).take(4))([0, 0, 1, 1])
  })

  test('collect', async () => {
    const evenToString = (v: number) => (isEven(v) ? '' + v : Option.none)

    await expectAsyncIter(iter0.collect(evenToString))([])
    await expectAsyncIter(iter1.collect(evenToString))([])
    await expectAsyncIter(AsyncIter.of(2).collect(evenToString))(['2'])
    await expectAsyncIter(iter3.collect(evenToString))(['2'])
    await expectAsyncIter(iterInf.collect(evenToString).take(3))(['0', '2', '4'])
  })

  test('concat', async () => {
    await expectAsyncIter(iter0.concat(iter0))([])
    await expectAsyncIter(iter0.concat(iter0, iter0, iter0))([])
    await expectAsyncIter(iter0.concat(iter3))([1, 2, 3])
    await expectAsyncIter(iter3.concat(iter0))([1, 2, 3])
    await expectAsyncIter(iter3.concat(iter3))([1, 2, 3, 1, 2, 3])
    await expectAsyncIter(iter3.concat(iter3, iter3))([1, 2, 3, 1, 2, 3, 1, 2, 3])
    await expectAsyncIter(iterInf.concat(iterInf).take(3))([0, 1, 2])
  })

  test('append', async () => {
    await expectAsyncIter(iter0.append(1))([1])
    await expectAsyncIter(iter0.append(1, 2))([1, 2])
    await expectAsyncIter(iter3.append(1, 2))([1, 2, 3, 1, 2])
    await expectAsyncIter(iterInf.append(1, 2).take(3))([0, 1, 2])
  })

  test('prepend', async () => {
    await expectAsyncIter(iter0.prepend(1))([1])
    await expectAsyncIter(iter0.prepend(1, 2))([1, 2])
    await expectAsyncIter(iter3.prepend(1, 2))([1, 2, 1, 2, 3])
    await expectAsyncIter(iterInf.prepend(1, 2).take(3))([1, 2, 0])
  })

  test('firstOrThrow', async () => {
    await expectAsyncToThrow(() => iter0.foldOrThrow(Fold.findOpt()))
    expect(await iter1.foldOrThrow(Fold.findOpt())).toBe(1)
  })

  test('firstOrValue', async () => {
    expect(await iter0.foldOr(undefined, Fold.findOpt())).toBe(undefined)
    expect(await iter1.foldOr('a', Fold.findOpt())).toBe(1)
  })

  test('hasValue', async () => {
    expect(await iter0.fold(Fold.hasValue)).toBe(false)
    expect(await iter1.fold(Fold.hasValue)).toBe(true)
    expect(await iter3.fold(Fold.hasValue)).toBe(true)
    expect(await iterInf.fold(Fold.hasValue)).toBe(true)
  })

  test('noValue', async () => {
    expect(await iter0.fold(Fold.noValue)).toBe(true)
    expect(await iter1.fold(Fold.noValue)).toBe(false)
    expect(await iter3.fold(Fold.noValue)).toBe(false)
    expect(await iterInf.fold(Fold.noValue)).toBe(false)
  })

  test('count', async () => {
    expect(await iter0.fold(Fold.count)).toBe(0)
    expect(await iter1.fold(Fold.count)).toBe(1)
    expect(await iter3.fold(Fold.count)).toBe(3)
    expect(await iterInf.take(100).fold(Fold.count)).toBe(100)
  })

  test('drop', async () => {
    await expectAsyncIter(iter0.drop(10))([])
    await expectAsyncIter(iter1.drop(10))([])
    await expectAsyncIter(iter1.drop(0))([1])
    await expectAsyncIter(iter3.drop(10))([])
    await expectAsyncIter(iter3.drop(0))([1, 2, 3])
    await expectAsyncIter(iter3.drop(1))([2, 3])
    await expectAsyncIter(iterInf.drop(10).take(3))([10, 11, 12])
  })

  test('take', async () => {
    await expectAsyncIter(iter0.take(10))([])
    await expectAsyncIter(iter1.take(10))([1])
    await expectAsyncIter(iter1.take(0))([])
    await expectAsyncIter(iter3.take(10))([1, 2, 3])
    await expectAsyncIter(iter3.take(0))([])
    await expectAsyncIter(iter3.take(2))([1, 2])
    await expectAsyncIter(iterInf.take(3))([0, 1, 2])
  })

  test('slice', async () => {
    await expectAsyncIter(iter0.slice(1, 3))([])
    await expectAsyncIter(iter1.slice(1, 3))([])
    await expectAsyncIter(iter1.slice(0, 3))([1])
    await expectAsyncIter(iter1.slice(0, 0))([])
    await expectAsyncIter(iter3.slice(0, 0))([])
    await expectAsyncIter(iter3.slice(1, 1))([2])
    await expectAsyncIter(iter3.slice(1, 2))([2, 3])
    await expectAsyncIter(iterInf.slice(100, 3))([100, 101, 102])
  })

  test('takeWhile', async () => {
    await expectAsyncIter(iter0.takeWhile(less3))([])
    await expectAsyncIter(iter1.takeWhile(less3))([1])
    await expectAsyncIter(iter3.takeWhile(less3))([1, 2])
    await expectAsyncIter(iterInf.takeWhile(less3))([0, 1, 2])
  })

  test('dropWhile', async () => {
    await expectAsyncIter(iter0.dropWhile(less3))([])
    await expectAsyncIter(iter1.dropWhile(less3))([])
    await expectAsyncIter(iter3.dropWhile(less3))([3])
    await expectAsyncIter(iterInf.dropWhile(less3).take(3))([3, 4, 5])
  })

  test('findOrThrow', async () => {
    await expectAsyncToThrow(() => iter0.foldOrThrow(Fold.findOpt(isEven)))
    await expectAsyncToThrow(() => iter1.foldOrThrow(Fold.findOpt(isEven)))
    expect(await iter1.foldOrThrow(Fold.findOpt(isOdd))).toBe(1)
    expect(await iter3.foldOrThrow(Fold.findOpt(isEven))).toBe(2)
    expect(await iterInf.foldOrThrow(Fold.findOpt(isOdd))).toBe(1)
  })

  test('some', async () => {
    expect(await iter0.fold(Fold.some(isEven))).toBe(false)
    expect(await iter1.fold(Fold.some(isEven))).toBe(false)
    expect(await iter1.fold(Fold.some(isOdd))).toBe(true)
    expect(await iter3.fold(Fold.some(isOdd))).toBe(true)
    expect(await iterInf.fold(Fold.some(isOdd))).toBe(true)
  })

  test('every', async () => {
    expect(await iter0.fold(Fold.every(isEven))).toBe(true)
    expect(await iter1.fold(Fold.every(isEven))).toBe(false)
    expect(await iter1.fold(Fold.every(isOdd))).toBe(true)
    expect(await iter3.fold(Fold.every(isOdd))).toBe(false)
    expect(await iter3.fold(Fold.every(isOdd))).toBe(false)
    expect(await iter3.fold(Fold.every(isPositive))).toBe(true)
    expect(await iterInf.fold(Fold.every(isOdd))).toBe(false)
    expect(await iterInf.take(1000).fold(Fold.every(isPositive))).toBe(true)
  })

  test('contains', async () => {
    expect(await iter0.fold(Fold.contains(1))).toBe(false)
    expect(await iter1.fold(Fold.contains(1))).toBe(true)
    expect(await iter1.fold(Fold.contains(0))).toBe(false)
    expect(await iter3.fold(Fold.contains(2))).toBe(true)
    expect(await iter3.fold(Fold.contains(5))).toBe(false)
    expect(await iterInf.fold(Fold.contains(1000))).toBe(true)
    expect(await iterInf.take(1000).fold(Fold.contains(-1))).toBe(false)
  })

  test('fold', async () => {
    expect(await iter0.fold(Fold.sum)).toBe(0)
    expect(await iter1.fold(Fold.sum)).toBe(1)
    expect(await iter3.fold(Fold.sum)).toBe(6)
    expect(await iterInf.take(1000).fold(Fold.sum)).toBe(499500)
  })

  test('reduceOpt', async () => {
    expect(await iter0.reduceOpt(sum)).toBe(Option.none)
    expect(await iter1.reduceOpt(sum)).toBe(1)
    expect(await iter3.reduceOpt(sum)).toBe(6)
    expect(await iterInf.take(1000).reduceOpt(sum)).toBe(499500)
  })

  test('reduceOrValue', async () => {
    expect(await iter0.reduceOrValue(sum, undefined)).toBe(undefined)
    expect(await iter0.reduceOrValue(sum, 'a')).toBe('a')
    expect(await iter1.reduceOrValue(sum, undefined)).toBe(1)
    expect(await iter3.reduceOrValue(sum, undefined)).toBe(6)
    expect(await iterInf.take(1000).reduceOrValue(sum, undefined)).toBe(499500)
  })

  test('foldIter', async () => {
    await expectAsyncIter(iter0.foldIter(Fold.sum))([])
    await expectAsyncIter(iter1.foldIter(Fold.sum))([1])
    await expectAsyncIter(iter3.foldIter(Fold.sum))([1, 3, 6])
    await expectAsyncIter(iterInf.foldIter(Fold.sum).take(4))([0, 1, 3, 6])
  })

  test('groupBy', async () => {
    expect(await iter0.fold(Fold.groupBy(isEven))).toEqual(new Map())
    expect(await iter1.fold(Fold.groupBy(isEven))).toEqual(new Map([[false, [1]]]))
    expect(await iter3.fold(Fold.groupBy(isEven))).toEqual(new Map([[false, [1, 3]], [true, [2]]]))
    expect(await iterInf.take(3).fold(Fold.groupBy(v => v))).toEqual(
      new Map([[0, [0]], [1, [1]], [2, [2]]])
    )
  })

  test('zipWith', async () => {
    await expectAsyncIter(iter0.zipWith(sum, iterInf))([])
    await expectAsyncIter(iter1.zipWith(sum, iterInf))([1])
    await expectAsyncIter(iter3.zipWith(sum, iterInf))([1, 3, 5])
    await expectAsyncIter(iterInf.take(3).zipWith(sum, iterInf))([0, 2, 4])
    await expectAsyncIter(iterInf.zipWith(sum, iterInf.take(3)))([0, 2, 4])
  })

  test('zip', async () => {
    await expectAsyncIter(iter0.zip(iter0))([])
    await expectAsyncIter(iter0.zip(iter0, iter0, iter0))([])
    await expectAsyncIter(iter1.zip(iter0))([])
    await expectAsyncIter(iter1.zip(iter1))([[1, 1]])
    await expectAsyncIter(iter1.zip(iter1, iter1))([[1, 1, 1]])
    await expectAsyncIter(iter1.zip(iterInf))([[1, 0]])
    await expectAsyncIter(iter3.zip(iter1))([[1, 1]])
    await expectAsyncIter(iter3.zip(iterInf))([[1, 0], [2, 1], [3, 2]])
    await expectAsyncIter(iterInf.zip(iter3))([[0, 1], [1, 2], [2, 3]])
    await expectAsyncIter(iterInf.zip(iterInf).take(3))([[0, 0], [1, 1], [2, 2]])
    await expectAsyncIter(iterInf.zip(iterInf, iter3))([[0, 0, 1], [1, 1, 2], [2, 2, 3]])
  })

  test('zipWithIndex', async () => {
    await expectAsyncIter(iter0.zipWithIndex())([])
    await expectAsyncIter(iter1.zipWithIndex())([[1, 0]])
    await expectAsyncIter(iter3.zipWithIndex())([[1, 0], [2, 1], [3, 2]])
    await expectAsyncIter(iterInf.zipWithIndex().take(3))([[0, 0], [1, 1], [2, 2]])
  })

  test('zipAll', async () => {
    await expectAsyncIter(iter0.zipAll(iter0))([])
    await expectAsyncIter(iter0.zipAll(iter0, iter0, iter0))([])
    await expectAsyncIter(iter0.zipAll(iter1))([[undefined, 1]])
    await expectAsyncIter(iter1.zipAll(iter0))([[1, undefined]])
    await expectAsyncIter(iter1.zipAll(iter1))([[1, 1]])
    await expectAsyncIter(iter1.zipAll(iter1, iter0))([[1, 1, undefined]])
    await expectAsyncIter(iter3.zipAll(iter1))([[1, 1], [2, undefined], [3, undefined]])
    await expectAsyncIter(iter0.zipAll(iter1, iter3))([
      [undefined, 1, 1],
      [undefined, undefined, 2],
      [undefined, undefined, 3]
    ])
  })

  test('interleave', async () => {
    await expectAsyncIter(iter0.interleave(iterInf))([])
    await expectAsyncIter(iter1.interleave(iterInf))([1, 0])
    await expectAsyncIter(iter3.interleave(iterInf))([1, 0, 2, 1, 3, 2])
    await expectAsyncIter(iterInf.interleave(iter3))([0, 1, 1, 2, 2, 3])
    await expectAsyncIter(iterInf.interleave(iterInf, iterInf).take(6))([0, 0, 0, 1, 1, 1])
  })

  test('repeat', async () => {
    await expectAsyncIter(iter0.repeat())([])
    await expectAsyncIter(iter1.repeat().take(3))([1, 1, 1])
    await expectAsyncIter(iter1.repeat(3))([1, 1, 1])
    await expectAsyncIter(iter3.repeat().take(4))([1, 2, 3, 1])
    await expectAsyncIter(iter3.repeat(2))([1, 2, 3, 1, 2, 3])
    await expectAsyncIter(iterInf.repeat().take(4))([0, 1, 2, 3])
  })

  test('sum', async () => {
    expect(await iter0.fold(Fold.sum)).toBe(0)
    expect(await iter1.fold(Fold.sum)).toBe(1)
    expect(await iter3.fold(Fold.sum)).toBe(6)
    expect(await iterInf.take(3).fold(Fold.sum)).toBe(3)
    expect(await iterInf.take(1000).fold(Fold.sum)).toBe(499500)
  })

  test('product', async () => {
    expect(await iter0.fold(Fold.product)).toBe(1)
    expect(await iter1.fold(Fold.product)).toBe(1)
    expect(await iter3.fold(Fold.product)).toBe(6)
    expect(
      await iterInf
        .map(v => v + 1)
        .take(3)
        .fold(Fold.product)
    ).toBe(6)
    expect(
      await iterInf
        .map(v => v + 1)
        .take(10)
        .fold(Fold.product)
    ).toBe(3628800)
  })

  test('average', async () => {
    expect(await iter0.fold(Fold.average())).toBe(0.0)
    expect(await iter1.fold(Fold.average())).toBe(1.0)
    expect(await iter3.fold(Fold.average())).toBe(2.0)
    expect(await iterInf.take(101).fold(Fold.average())).toBe(50.0)
  })

  test('averageScan', async () => {
    await expectAsyncIter(iter0.foldIter(Fold.average()))([])
    await expectAsyncIter(iter1.foldIter(Fold.average()))([1.0])
    await expectAsyncIter(iter3.foldIter(Fold.average()))([1.0, 1.5, 2])
    await expectAsyncIter(iterInf.take(3).foldIter(Fold.average()))([0.0, 0.5, 1.0])
  })

  test('join', async () => {
    expect(await iter0.join()).toEqual('')
    expect(await iter0.join(',')).toEqual('')
    expect(await iter0.join(',', '(', ')')).toEqual('()')
    expect(await iter1.join()).toEqual('1')
    expect(await iter1.join(',')).toEqual('1')
    expect(await iter1.join(',', '(', ')')).toEqual('(1)')
    expect(await iter3.join()).toEqual('123')
    expect(await iter3.join(',')).toEqual('1,2,3')
    expect(await iter3.join(',', '(', ')')).toEqual('(1,2,3)')
  })

  test('distinct', async () => {
    await expectAsyncIter(iter0.distinct())([])
    await expectAsyncIter(iter1.distinct())([1])
    await expectAsyncIter(iter1.repeat(10).distinct())([1])
    await expectAsyncIter(iter3.distinct())([1, 2, 3])
    await expectAsyncIter(iter3.repeat(10).distinct())([1, 2, 3])
  })

  test('sliding', async () => {
    await expectAsyncIter(iter0.sliding(2))([])
    await expectAsyncIter(iter1.sliding(2))([[1]])
    await expectAsyncIter(iter3.sliding(2))([[1, 2], [3]])
    await expectAsyncIter(iter3.sliding(2, 1))([[1, 2], [2, 3]])
    await expectAsyncIter(iter3.sliding(2, 4))([[1, 2]])
    await expectAsyncIter(iterInf.sliding(2, 4).take(2))([[0, 1], [4, 5]])
  })

  test('sample', async () => {
    await expectAsyncIter(iter0.sample(2))([])
    await expectAsyncIter(iter1.sample(2))([1])
    await expectAsyncIter(iter3.sample(2))([1, 3])
    await expectAsyncIter(iterInf.sample(1000).take(3))([0, 1000, 2000])
  })

  test('span', async () => {
    expect(await iter0.fold(Fold.partition(isEven))).toEqual([[], []])
    expect(await iter1.fold(Fold.partition(isEven))).toEqual([[], [1]])
    expect(await iter3.fold(Fold.partition(isEven))).toEqual([[2], [1, 3]])
  })

  test('monitor', async () => {
    let values: number[] = []
    const pushValue = (v: number) => values.push(v)

    await iter0.monitor(pushValue).forEach()
    expect(values).toEqual([])

    await iter1.monitor(pushValue).forEach()
    expect(values).toEqual([1])

    values = []
    await iter3.monitor(pushValue).forEach()
    expect(values).toEqual([1, 2, 3])
  })

  test('substituteWhere', async () => {
    const double = (v: any) => AsyncIter.fromIterable([v, v])
    const remove = <T>(v: T) => AsyncIter.empty

    await expectAsyncIter(iter0.substituteWhere(isEven, double))([])
    await expectAsyncIter(iter1.substituteWhere(isEven, double))([1])
    await expectAsyncIter(iter1.substituteWhere(isOdd, double))([1, 1])
    await expectAsyncIter(iter1.substituteWhere(isOdd, remove))([])
    await expectAsyncIter(iter3.substituteWhere(isEven, double))([1, 2, 2, 3])
    await expectAsyncIter(iter3.substituteWhere(isEven, remove))([1, 3])
  })

  test('substituteElem', async () => {
    const subst = AsyncIter.of(-1, -2)

    await expectAsyncIter(iter0.substituteElem(1, subst))([])
    await expectAsyncIter(iter1.substituteElem(0, subst))([1])
    await expectAsyncIter(iter1.substituteElem(1, subst))([-1, -2])
    await expectAsyncIter(iter3.substituteElem(1, subst))([-1, -2, 2, 3])
    await expectAsyncIter(iter3.substituteElem(2))([1, 3])
  })

  test('splitWhere', async () => {
    await expectAsyncIter(iter0.splitWhere(isEven))([])
    await expectAsyncIter(iter1.splitWhere(isEven))([[1]])
    await expectAsyncIter(iter1.splitWhere(isOdd))([[], []])
    await expectAsyncIter(iter3.splitWhere(isOdd))([[], [2], []])
    await expectAsyncIter(iter3.splitWhere(isEven))([[1], [3]])
  })

  test('splitOnElem', async () => {
    await expectAsyncIter(AsyncIter.empty.splitOnElem(' '))([])
    await expectAsyncIter(AsyncIter.fromIterable('po po').splitOnElem(' '))([
      ['p', 'o'],
      ['p', 'o']
    ])
    await expectAsyncIter(AsyncIter.fromIterable('po  po').splitOnElem(' '))([
      ['p', 'o'],
      [],
      ['p', 'o']
    ])
    await expectAsyncIter(AsyncIter.fromIterable(' po').splitOnElem(' '))([[], ['p', 'o']])
    await expectAsyncIter(AsyncIter.fromIterable('po ').splitOnElem(' '))([['p', 'o'], []])
  })

  test('intersperse', async () => {
    await expectAsyncIter(iter0.intersperse(AsyncIter.of(-1)))([])
    await expectAsyncIter(iter1.intersperse(AsyncIter.of(-1)))([1])
    await expectAsyncIter(iter3.intersperse(AsyncIter.of(-1)))([1, -1, 2, -1, 3])
    await expectAsyncIter(iter3.intersperse(AsyncIter.of(-1, -2)))([1, -1, -2, 2, -1, -2, 3])
    await expectAsyncIter(iter3.intersperse(Iter.of(-1, -2)))([1, -1, -2, 2, -1, -2, 3])
  })

  test('mkGroup', async () => {
    await expectAsyncIter(AsyncIter.empty.mkGroup('(#', ',', '#)'))(['(', '#', '#', ')'])
    await expectAsyncIter(AsyncIter.of('A').mkGroup('(', ',', ')'))(['(', 'A', ')'])
    await expectAsyncIter(AsyncIter.fromIterable('ABC').mkGroup('(', ',', ')'))([
      '(',
      'A',
      ',',
      'B',
      ',',
      'C',
      ')'
    ])
  })

  test('toString', () => {
    expect(iter0.toString()).toEqual('[AsyncIter]')
    expect(iter1.toString()).toEqual('[AsyncIter]')
    expect(iter3.toString()).toEqual('[AsyncIter]')
    expect(iterInf.toString()).toEqual('[AsyncIter]')
  })

  test('join to string', async () => {
    expect(await iter0.join()).toEqual('')
    expect(await iter1.join()).toEqual('1')
    expect(await iter3.join()).toEqual('123')
  })

  test('toArray', async () => {
    expect(await iter0.fold(Fold.toArray())).toEqual([])
    expect(await iter1.fold(Fold.toArray())).toEqual([1])
    expect(await iter3.fold(Fold.toArray())).toEqual([1, 2, 3])
  })

  test('toSet', async () => {
    expect(await iter0.fold(Fold.toSet())).toEqual(new Set())
    expect(await iter1.fold(Fold.toSet())).toEqual(new Set([1]))
    expect(await iter3.fold(Fold.toSet())).toEqual(new Set([1, 2, 3]))
  })

  test('toMap', async () => {
    const double = <T>(v: T): [T, T] => [v, v]

    expect(await iter0.map(double).fold(Fold.toMap())).toEqual(new Map())
    expect(await iter1.map(double).fold(Fold.toMap())).toEqual(new Map([[1, 1]]))
    expect(await iter3.map(double).fold(Fold.toMap())).toEqual(new Map([[1, 1], [2, 2], [3, 3]]))
  })
})
