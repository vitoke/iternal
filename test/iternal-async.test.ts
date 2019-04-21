import iter, { asyncIter, AsyncIter, ops } from '../src/lib/public/iternal'
import { addIndex, double, isEven, isOdd, less3, remove, sum } from './test-utils'

const expectAsyncIter = <T>(iter: AsyncIter<T>) => async (resultIt: Iterable<T>) =>
  expect(await iter.collect(ops.toArray())).toEqual(
    await asyncIter(resultIt).collect(ops.toArray())
  )

const expectAsyncToThrow = async (f: () => void) => {
  let succeeded = false

  try {
    await f()
    succeeded = true
  } catch (e) {
    //
  }

  if (succeeded) throw new Error('should have thrown')
}

describe('AsyncIter', () => {
  const iter0 = asyncIter.empty<number>()
  const iter1 = asyncIter.fromIterator<number>(async function*() {
    yield 1
  })
  const iter3 = asyncIter.fromIterator<number>(async function*() {
    yield 1
    yield 2
    yield 3
  })
  const iterInf = asyncIter.fromIterator<number>(async function*() {
    yield* iter.nats
  })

  test('simple', async () => {
    await expectAsyncIter(iter0)([])
    await expectAsyncIter(iter1)([1])
    await expectAsyncIter(iter3)([1, 2, 3])
  })

  test('creation', async () => {
    await expectAsyncIter(iter.of(1, 2, 3).toAsync())([1, 2, 3])
    await expectAsyncIter(
      asyncIter.generate(Promise.resolve(0), v => Promise.resolve(v + 1)).take(5)
    )([0, 1, 2, 3, 4])
    await expectAsyncIter(asyncIter.unfold(Promise.resolve(0), async v => [v * 2, v + 1]).take(3))([
      0,
      2,
      4
    ])
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
    await expectAsyncIter(
      iter
        .of(2)
        .toAsync()
        .filter(isEven)
    )([2])
    await expectAsyncIter(iter3.filter(isEven))([2])
    await expectAsyncIter(iterInf.filter(isEven).take(3))([0, 2, 4])
  })

  test('filterNot', async () => {
    await expectAsyncIter(iter0.filterNot(isEven))([])
    await expectAsyncIter(iter1.filterNot(isEven))([1])
    await expectAsyncIter(
      iter
        .of(2)
        .toAsync()
        .filterNot(isEven)
    )([])
    await expectAsyncIter(iter3.filterNot(isEven))([1, 3])
    await expectAsyncIter(iterInf.filterNot(isEven).take(3))([1, 3, 5])
  })

  test('filterWithLast', async () => {
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
    await expectAsyncIter(iter0.filterWithPrevious(pushValues(true)))([])
    exp([], [])

    await expectAsyncIter(iter1.filterWithPrevious(pushValues(true)))([1])
    exp([1], [undefined])
    await expectAsyncIter(iter1.filterWithPrevious(pushValues(false)))([])

    currentValues = []
    lastValues = []
    await expectAsyncIter(iter3.filterWithPrevious(pushValues(true)))([1, 2, 3])
    exp([1, 2, 3], [undefined, 1, 2])
  })

  test('filterChanged', async () => {
    await expectAsyncIter(iter0.filterChanged())([])
    await expectAsyncIter(iter1.filterChanged())([1])
    await expectAsyncIter(iter3.filterChanged())([1, 2, 3])
    await expectAsyncIter(
      iter
        .of(1, 2, 2, 3, 3, 1, 3, 3, 3)
        .toAsync()
        .filterChanged()
    )([1, 2, 3, 1, 3])
  })

  test('flatMap', async () => {
    const toIter = (v: any) => iter.of(v, v).toAsync()

    await expectAsyncIter(iter0.flatMap(toIter))([])
    await expectAsyncIter(iter1.flatMap(toIter))([1, 1])
    await expectAsyncIter(iter3.flatMap(toIter))([1, 1, 2, 2, 3, 3])
    await expectAsyncIter(iterInf.flatMap(toIter).take(4))([0, 0, 1, 1])
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

  test('drop', async () => {
    await expectAsyncIter(iter0.drop(10))([])
    await expectAsyncIter(iter1.drop(10))([])
    await expectAsyncIter(iter1.drop(0))([1])
    await expectAsyncIter(iter3.drop(10))([])
    await expectAsyncIter(iter3.drop(0))([1, 2, 3])
    await expectAsyncIter(iter3.drop(1))([2, 3])
    await expectAsyncIter(iterInf.drop(10).take(3))([10, 11, 12])
  })

  test('dropLast', async () => {
    await expectAsyncIter(iter0.dropLast(0))([])
    await expectAsyncIter(iter0.dropLast(3))([])
    await expectAsyncIter(iter1.dropLast(0))([1])
    await expectAsyncIter(iter1.dropLast(1))([])
    await expectAsyncIter(iter1.dropLast(3))([])
    await expectAsyncIter(iter3.dropLast(0))([1, 2, 3])
    await expectAsyncIter(iter3.dropLast(1))([1, 2])
    await expectAsyncIter(iter3.dropLast(2))([1])
    await expectAsyncIter(
      iter
        .range(0, 10)
        .toAsync()
        .dropLast(6)
    )([0, 1, 2, 3])
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

  test('indicesOf', async () => {
    await expectAsyncIter(iter0.indicesOf(0))([])
    await expectAsyncIter(
      iter('a')
        .toAsync()
        .indicesOf('a')
    )([0])
    await expectAsyncIter(
      iter('a')
        .toAsync()
        .indicesOf('b')
    )([])
    await expectAsyncIter(
      iter('babbaab')
        .toAsync()
        .indicesOf('a')
    )([1, 4, 5])
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

  test('reduce', async () => {
    expectAsyncToThrow(() => iter0.reduce(sum))
    expect(await iter0.reduce(sum, 0)).toBe(0)
    expect(await iter0.reduce(sum, () => 0)).toBe(0)
    expect(await iter1.reduce(sum)).toBe(1)
    expect(await iter3.reduce(sum)).toBe(6)
    expect(await iterInf.take(1000).reduce(sum)).toBe(499500)
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

  test('interleaveAll', async () => {
    await expectAsyncIter(iter0.interleaveAll(iter0))([])
    await expectAsyncIter(iter0.interleaveAll(iter1))([1])
    await expectAsyncIter(iter0.interleaveAll(iter3))([1, 2, 3])
    await expectAsyncIter(iter1.interleaveAll(iter0))([1])
    await expectAsyncIter(iter1.interleaveAll(iter1))([1, 1])
    await expectAsyncIter(iter1.interleaveAll(iter3))([1, 1, 2, 3])
    await expectAsyncIter(iter3.interleaveAll(iter0))([1, 2, 3])
    await expectAsyncIter(iter3.interleaveAll(iter1))([1, 1, 2, 3])
    await expectAsyncIter(iter3.interleaveAll(iter3))([1, 1, 2, 2, 3, 3])
    await expectAsyncIter(iter3.interleaveAll(iter.range(10, 15), iter.of(100)))([
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

  test('interleaveRound', async () => {
    await expectAsyncIter(iter0.interleaveRound(iter0))([])
    await expectAsyncIter(iter0.interleaveRound(iter1))([])
    await expectAsyncIter(iter1.interleaveRound(iter0))([])
    await expectAsyncIter(iter1.interleaveRound(iter.of(2)).take(5))([1, 2, 1, 2, 1])
    await expectAsyncIter(iter1.interleaveRound(iter3).take(8))([1, 1, 1, 2, 1, 3, 1, 1])
  })

  test('repeat', async () => {
    await expectAsyncIter(iter0.repeat())([])
    await expectAsyncIter(iter1.repeat().take(3))([1, 1, 1])
    await expectAsyncIter(iter1.repeat(3))([1, 1, 1])
    await expectAsyncIter(iter3.repeat().take(4))([1, 2, 3, 1])
    await expectAsyncIter(iter3.repeat(2))([1, 2, 3, 1, 2, 3])
    await expectAsyncIter(iterInf.repeat().take(4))([0, 1, 2, 3])
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

  test('monitor', async () => {
    let values: number[] = []
    const pushValue = (v: number) => values.push(v)

    await iter0.monitor('', pushValue).forEach()
    expect(values).toEqual([])

    await iter1.monitor('', pushValue).forEach()
    expect(values).toEqual([1])

    values = []
    await iter3.monitor('', pushValue).forEach()
    expect(values).toEqual([1, 2, 3])

    values = []
    await iter3
      .monitor('', pushValue)
      .monitor('', pushValue)
      .forEach()
    expect(values).toEqual([1, 1, 2, 2, 3, 3])
  })

  test('patchAt', async () => {
    await expectAsyncIter(iter0.patchAt(0, 1))([])
    await expectAsyncIter(iter0.patchAt(0, 0, () => iter1))([1])
    await expectAsyncIter(iter0.patchAt(0, 10, () => iter1))([1])
    await expectAsyncIter(iter0.patchAt(-10, 0, () => iter1))([1])
    await expectAsyncIter(iter1.patchAt(-10, 0, () => iter.of(2)))([2, 1])
    await expectAsyncIter(iter1.patchAt(-10, 10, () => iter.of(2)))([2])
    await expectAsyncIter(iter1.patchAt(0, 0, () => iter.of(2)))([2, 1])
    await expectAsyncIter(iter1.patchAt(1, 0, () => iter.of(2)))([1, 2])
    await expectAsyncIter(iter1.patchAt(10, 10, () => iter.of(2)))([1, 2])
    await expectAsyncIter(iter1.patchAt(100, 0, () => iter.of(2)))([1, 2])
    await expectAsyncIter(iter3.patchAt(-10, 0, () => iter.of(9)))([9, 1, 2, 3])
    await expectAsyncIter(iter3.patchAt(0, 0, () => iter.of(9)))([9, 1, 2, 3])
    await expectAsyncIter(iter3.patchAt(1, 0, () => iter.of(9)))([1, 9, 2, 3])
    await expectAsyncIter(iter3.patchAt(100, 0, () => iter.of(9)))([1, 2, 3, 9])
    await expectAsyncIter(iter3.patchAt(0, 1, () => iter.of(9)))([9, 2, 3])
    await expectAsyncIter(iter3.patchAt(1, 1, () => iter.of(9)))([1, 9, 3])
    await expectAsyncIter(iter3.patchAt(100, 1, () => iter.of(9)))([1, 2, 3, 9])
  })

  test('patchWhere', async () => {
    await expectAsyncIter(iter0.patchWhere(isEven, 1, double))([])
    await expectAsyncIter(iter1.patchWhere(isEven, 1, double))([1])
    await expectAsyncIter(iter1.patchWhere(isOdd, 1, double))([1, 1])
    await expectAsyncIter(iter1.patchWhere(isOdd, 1, remove))([])
    await expectAsyncIter(iter3.patchWhere(isEven, 1, double))([1, 2, 2, 3])
    await expectAsyncIter(iter3.patchWhere(isEven, 0, double))([1, 2, 2, 2, 3])
    await expectAsyncIter(iter3.patchWhere(isEven, 1, remove))([1, 3])
  })

  test('patchElem', async () => {
    const subst = iter.of(-1, -2).toAsync()

    await expectAsyncIter(iter0.patchElem(1, 1, subst))([])
    await expectAsyncIter(iter1.patchElem(0, 1, subst))([1])
    await expectAsyncIter(iter1.patchElem(1, 1, subst))([-1, -2])
    await expectAsyncIter(iter3.patchElem(1, 1, subst))([-1, -2, 2, 3])
    await expectAsyncIter(iter3.patchElem(2, 1))([1, 3])
  })

  test('patchWhere amount', async () => {
    await expectAsyncIter(iter0.patchWhere(isEven, 1, () => iter.of(10), 1))([])
    await expectAsyncIter(iter1.patchWhere(isEven, 0, () => iter.of(10), 1))([1])
    await expectAsyncIter(iter1.patchWhere(isOdd, 0, () => iter.of(10), 1))([10, 1])
    await expectAsyncIter(iter1.patchWhere(isOdd, 1, () => iter.of(10), 1))([10])
    await expectAsyncIter(
      iter
        .range(0, 5)
        .toAsync()
        .patchWhere(isOdd, 1, () => iter.of(10), 1)
    )([0, 10, 2, 3, 4])
    await expectAsyncIter(
      iter
        .range(0, 5)
        .toAsync()
        .patchWhere(isOdd, 0, () => iter.of(10), 1)
    )([0, 10, 1, 2, 3, 4])
    await expectAsyncIter(
      iter
        .range(0, 6)
        .toAsync()
        .patchWhere(isOdd, 1, () => iter.of(10), 2)
    )([0, 10, 2, 10, 4, 5])
    await expectAsyncIter(
      iter
        .range(0, 6)
        .toAsync()
        .patchWhere(isOdd, 1, undefined, 2)
    )([0, 2, 4, 5])
  })

  test('patchElem amount', async () => {
    await expectAsyncIter(
      iter('')
        .toAsync()
        .patchElem('a', 0, 'ab', 1)
    )('')
    await expectAsyncIter(
      iter('a')
        .toAsync()
        .patchElem('a', 0, 'XX', 1)
    )('XXa')
    await expectAsyncIter(
      iter('a')
        .toAsync()
        .patchElem('a', 1, 'XX', 1)
    )('XX')
    await expectAsyncIter(
      iter('b')
        .toAsync()
        .patchElem('a', 0, 'XX', 1)
    )('b')
    await expectAsyncIter(
      iter('bac')
        .toAsync()
        .patchElem('a', 0, 'XX', 1)
    )('bXXac')
    await expectAsyncIter(
      iter('bacadata')
        .toAsync()
        .patchElem('a', 0, 'XX', 2)
    )('bXXacXXadata')
    await expectAsyncIter(
      iter('bacadata')
        .toAsync()
        .patchElem('a', 1, 'XX', 2)
    )('bXXcXXdata')
  })

  test('splitWhere', async () => {
    await expectAsyncIter(iter0.splitWhere(isEven))([])
    await expectAsyncIter(iter1.splitWhere(isEven))([[1]])
    await expectAsyncIter(iter1.splitWhere(isOdd))([[], []])
    await expectAsyncIter(iter3.splitWhere(isOdd))([[], [2], []])
    await expectAsyncIter(iter3.splitWhere(isEven))([[1], [3]])
  })

  test('splitOnElem', async () => {
    await expectAsyncIter(asyncIter.empty().splitOnElem(' '))([])
    await expectAsyncIter(
      iter('po po')
        .toAsync()
        .splitOnElem(' ')
    )([['p', 'o'], ['p', 'o']])
    await expectAsyncIter(
      iter('po  po')
        .toAsync()
        .splitOnElem(' ')
    )([['p', 'o'], [], ['p', 'o']])
    await expectAsyncIter(
      iter(' po')
        .toAsync()
        .splitOnElem(' ')
    )([[], ['p', 'o']])
    await expectAsyncIter(
      iter('po ')
        .toAsync()
        .splitOnElem(' ')
    )([['p', 'o'], []])
  })

  test('intersperse', async () => {
    await expectAsyncIter(iter0.intersperse(iter.of(-1)))([])
    await expectAsyncIter(iter1.intersperse(iter.of(-1)))([1])
    await expectAsyncIter(iter3.intersperse(iter.of(-1)))([1, -1, 2, -1, 3])
    await expectAsyncIter(iter3.intersperse(iter.of(-1, -2)))([1, -1, -2, 2, -1, -2, 3])
    await expectAsyncIter(
      iter('ABC')
        .toAsync()
        .intersperse(iter.of('ab'))
    )(['A', 'ab', 'B', 'ab', 'C'])
  })

  test('mkGroup', async () => {
    await expectAsyncIter(asyncIter.empty().mkGroup('(#', ',', '#)'))(['(', '#', '#', ')'])
    await expectAsyncIter(
      iter
        .of('A')
        .toAsync()
        .mkGroup('(', ',', ')')
    )(['(', 'A', ')'])
    await expectAsyncIter(
      iter('ABC')
        .toAsync()
        .mkGroup('(', ',', ')')
    )(['(', 'A', ',', 'B', ',', 'C', ')'])
  })

  test('toString', () => {
    expect(iter0.toString()).toEqual('[AsyncIter]')
    expect(iter1.toString()).toEqual('[AsyncIter]')
    expect(iter3.toString()).toEqual('[AsyncIter]')
    expect(iterInf.toString()).toEqual('[AsyncIter]')
  })

  // test('join to string', async () => {
  //   expect(await iter0.join()).toEqual('')
  //   expect(await iter1.join()).toEqual('1')
  //   expect(await iter3.join()).toEqual('123')
  // })
})
