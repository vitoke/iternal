import { _NO_VALUE, NoValue } from '../private/iternal-common'
import { Opt, Option } from 'better-option'

export const Errors = {
  NotAnIterator: 'NotAnIterator',
  NotIterable: 'NotIterable',
  InternalError: 'InternalError',
  NotAsyncIterable: 'NotAsyncIterable',
  NonEmptyExpected: 'NonEmptyExpected'
}

export type Pred<E> = (elem: E, index: number) => boolean
export type Effect<E> = (elem: E, index: number) => void
export type MapFun<A, B> = (elem: A, index: number) => B
export type CollectFun<A, B> = (elem: A, index: number) => Opt<B>
export type ReduceFun<E, S> = (state: S, elem: E) => S
export type AnyIterable<E> = Iterable<E> | AsyncIterable<E>
export type AnyIterator<E> = Iterator<E> | AsyncIterator<E>
export type Indexed<E> = Iterable<E> & { [key: number]: E; length: number }
export type Folder<A, S> = {
  init: S
  combine: ReduceFun<A, S>
  escape?: (st: S) => boolean
}

export type MonoFun<A> = ReduceFun<A, A>
export type MonoFolder<A> = Folder<A, A>

export type Dict<K, V> = Map<K, V[]>

function addToDict<K, V>(dict: Dict<K, V>, key: K, value: V) {
  const entries = dict.get(key)
  if (entries === undefined) dict.set(key, [value])
  else entries.push(value)
  return dict
}

const optPred = <E>(value: E, pred?: (value: E) => boolean): boolean =>
  pred !== undefined && pred(value)

export class Fold {
  static foldIterable = <E, R>(iterable: Iterable<E>, folder: Folder<E, R>): R => {
    let result = folder.init
    if (optPred(result, folder.escape)) return result

    for (const e of iterable) {
      result = folder.combine(result, e)
      if (optPred(result, folder.escape)) return result
    }
    return result
  }

  static foldAsyncIterable = async <E, R>(
    asyncIterable: AsyncIterable<E>,
    folder: Folder<E, R>
  ): Promise<R> => {
    let result = folder.init
    if (folder.escape && folder.escape(result)) return result

    for await (const e of asyncIterable) {
      result = folder.combine(result, e)
      if (folder.escape && folder.escape(result)) return result
    }
    return result
  }

  static create = <A, R>(
    init: R,
    combine: ReduceFun<A, R>,
    escape?: (st: R) => boolean
  ): Folder<A, R> => ({
    init,
    combine,
    escape
  })

  static createMono = <A>(
    init: A,
    combine: MonoFun<A>,
    escape?: (st: A) => boolean
  ): MonoFolder<A> => Fold.create(init, combine, escape)

  static stringAppend: Folder<any, string> = Fold.create('', (state, elem) =>
    state.concat(String(elem))
  )

  static stringPrepend: Folder<any, string> = Fold.create('', (state, elem) =>
    String(elem).concat(state)
  )

  static count: Folder<any, number> = Fold.create(0, (c, _) => c + 1)

  static toObject = <V>(target = {}): Folder<[string, V], { [key: string]: V }> =>
    Fold.create<[string, V], { [key: string]: V }>(target, (o, [name, value]) => {
      o[name] = value
      return o
    })

  static findOpt = <E>(pred: (value: E) => boolean = () => true): Folder<E, Opt<E>> =>
    Fold.create<E, Opt<E>>(
      Option.none,
      (foundOpt, v) => Option.getOpt(foundOpt, Option.findOpt(pred, v)),
      st => Option.hasValue(st)
    )

  static some = <E>(pred: (value: E) => boolean): Folder<E, boolean> =>
    Fold.create(false, (st, v) => st || pred(v), st => st)

  static every = <E>(pred: (value: E) => boolean): Folder<E, boolean> =>
    Fold.create(true, (st, v) => st && pred(v), st => !st)

  static contains = <E>(elem: E): Folder<E, boolean> => Fold.some(e => e === elem)

  static hasValue: Folder<any, boolean> = Fold.some(() => true)

  static noValue: Folder<any, boolean> = Fold.every(() => false)

  static average = (): MonoFolder<number> => {
    let t = 1
    return Fold.createMono(0, (a, v) => a + (v - a) / t++)
  }

  static toArray = <E>(target: E[] = []): Folder<E, E[]> =>
    Fold.create(target, (arr, e) => {
      arr.push(e)
      return arr
    })

  static toMap = <K, V>(target = new Map<K, V>()): Folder<[K, V], Map<K, V>> =>
    Fold.create(target, (map, [k, v]) => map.set(k, v))

  static toSet = <E>(target = new Set<E>()): Folder<E, Set<E>> =>
    Fold.create(target, (set, v) => set.add(v))

  static groupBy = <K, V>(keyFun: (value: V) => K): Folder<V, Dict<K, V>> =>
    Fold.create(new Map(), (dict, v) => addToDict(dict, keyFun(v), v))

  static partition = <E>(pred: (value: E) => boolean): Folder<E, [E[], E[]]> =>
    Fold.create<E, [E[], E[]]>([[], []], (state, value) => {
      if (pred(value)) state[0].push(value)
      else state[1].push(value)
      return state
    })

  static sum: MonoFolder<number> = Fold.createMono(0, (state, num) => state + num)

  static product: MonoFolder<number> = Fold.createMono(
    1,
    (state, num) => state * num,
    st => st === 0
  )

  static minOpt: Folder<number, Opt<number>> = Fold.create<number, Opt<number>>(
    Option.none,
    (stateOpt, num) => {
      if (Option.hasValue(stateOpt)) return Math.min(stateOpt, num)
      return num
    }
  )

  static maxOpt: Folder<number, Opt<number>> = Fold.create<number, Opt<number>>(
    Option.none,
    (stateOpt, num) => {
      if (Option.hasValue(stateOpt)) return Math.max(stateOpt, num)
      return num
    }
  )

  static parallel = <A, R1, R2>(
    folder1: Folder<A, R1>,
    folder2: Folder<A, R2>
  ): Folder<A, [R1, R2]> =>
    Fold.create<A, [R1, R2]>(
      [folder1.init, folder2.init],
      ([state1, state2], a) => [folder1.combine(state1, a), folder2.combine(state2, a)],
      ([r1, r2]) => optPred(r1, folder1.escape) && optPred(r2, folder2.escape)
    )

  static parallelMany = <A>(...folders: Folder<A, any>[]): Folder<A, any[]> =>
    Fold.create(
      folders.map(f => f.init),
      (states, a) => {
        const result = []
        for (let i = 0; i < folders.length; i++) {
          result.push(folders[i].combine(states[i], a))
        }
        return result
      },
      states => {
        let allEscape = true
        for (let i = 0; i < folders.length; i++) {
          allEscape = allEscape && optPred(states[i], folders[i].escape)
        }
        return allEscape
      }
    )
}
