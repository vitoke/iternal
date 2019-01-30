import { NoValue } from '../../private/iternal-common'
import { Folds, FolderT } from '../iternal'

function* sum() {
  let state = 0
  while (true) {
    const value = yield state
    state += value
  }
}

function* prod() {
  let state = 1
  while (state !== 0) {
    const value = yield state
    state *= value
  }
}

export interface Collectable<I, O> {
  collector(): ICollector<I, O>
}

export type CollectResult<T> = { done: false; value: T } | { done: true }

export interface ICollector<I, O> {
  next(value: I): CollectResult<O>
}
export interface IC2<I, S, R> {
  next(value: I): void
  state: S
  mapToResult: (state: S) => R
}

function getCollector<I, O>(collectable: Collectable<I, O>): ICollector<I, O> {
  return collectable.collector()
}

export class Collect<I, O> implements Collectable<I, O> {
  static fromCollector<I, O>(
    initState: O,
    createCollector: () => ICollector<I, O>
  ): Collect<I, O> {
    return new Collect<I, O>(initState, {
      collector(): ICollector<I, O> {
        return createCollector()
      }
    })
  }

  static from<I, O>(
    initState: O,
    createNext: () => (input: I) => CollectResult<O>
  ): Collect<I, O> {
    return Collect.fromCollector(initState, () => {
      const f = createNext()

      return {
        next(input) {
          return f(input)
        }
      }
    })
  }

  constructor(
    private readonly initState: O,
    private readonly collectable: Collectable<I, O>
  ) {
    // if (iterable instanceof Iter) {
    //   throw error(Errors.InternalError, 'unnecessary nesting')
    // }
    // checkPureIterable(iterable)
  }

  collector(): ICollector<I, O> {
    return getCollector(this.collectable)
  }

  mapResult<O2>(mapFun: (value: O) => O2): Collect<I, O2> {
    return Collect.from(mapFun(this.initState), () => {
      const collector = getCollector(this)

      return (input: I) => {
        const result = collector.next(input)
        if (result.done) return result
        return { value: mapFun(result.value), done: false }
      }
    })
  }

  mapInput<I2>(mapFun: (value: I2) => I): Collect<I2, O> {
    return Collect.from(this.initState, () => {
      const collector = getCollector(this)

      return (input: I2) => collector.next(mapFun(input))
    })
  }

  filterInput(pred: (value: I) => boolean): Collect<I, O> {
    return Collect.from(this.initState, () => {
      const collector = getCollector(this)
      let state: CollectResult<O> = { value: this.initState, done: false }

      return (input: I) => {
        if (state.done || !pred(input)) return state

        state = collector.next(input)
        return state
      }
    })
  }

  takeInput(amount: number): Collect<I, O> {
    return Collect.from(this.initState, () => {
      const collector = getCollector(this)
      let remain = amount

      return (input: I) =>
        remain-- <= 0 ? { done: true } : collector.next(input)
    })
  }
}
// abstract class Collectable<E, R> {
//   abstract collector(): Collector<E, R>

//   mapInput<E2>(mapFun: (value: E2) => E): Collectable<E2, R> {
//     const parent = this
//     return new class extends Collectable<E2, R> {
//       collector() {
//         const parCol = parent.collector()
//         return {
//           push(value: E2) {
//             return parCol.push(mapFun(value))
//           }
//         }
//       }
//     }()
//   }
// }

// interface Collector<E, R> {
//   push(value: E): { result: R; done: boolean }
// }

// const SumCollectable: Collectable<number, number> = {
//   collector() {
//     let state = 0
//     return {
//       push(value) {
//         state += value
//         return { result: state, done: false }
//       }
//     }
//   }
// }

// const SumCollector = new class implements Collector<number, number> {
//   state = 0

//   push(value: number) {
//     this.state += value
//     return { result: this.state, done: false }
//   }
// }()
// class T<I, S, O> {
//   constructor(
//     readonly input: ICollectable<I>,
//     readonly initState: S,
//     readonly mapToResult: (state: S) => O
//   ) {}

//   collector() {
//     const self = this
//     let state = this.initState

//     return new class extends Collector<I> {
//       push(value: I) {
//         state = self.nextState(value)
//       }
//     }()
//   }

//   mapInput<I2>(f: (inpput: ICollectable<I>) => ICollectable<I2>): T<I2, S, O> {
//     return new T(f(this.input), this.initState, this.mapToResult)
//   }

//   mapResult<O2>(f: (result: O) => O2): T<I, S, O2> {
//     return new T(this.input, v => f(this.mapToResult(v)))
//   }
// }

// interface ICollectable<E> {
//   collector(): Collector<E>

//   map<E2>(mapFun: (value: E2) => E): ICollectable<E2> {
//     return {
//       collector() {
//         return Collector.create(value => {
//           this.push(mapFun(value))
//         })
//     }
//   }
// }

// export class Collectable {
//   static monoFolder<T>(
//     initState: T,
//     combine: (state: T, elem: T) => T
//   ): ICollectable<T> {
//     return {
//       collector() {
//         let state = initState
//         return Collector.create(elem => combine(state, elem))
//       }
//     }
//   }

//   static folder<I, O>(
//     initState: O,
//     combine: (state: O, elem: I) => O
//   ): ICollectable<I> {
//     return {
//       collector() {
//         let state = initState
//         return Collector.create(elem => (state = combine(state, elem)))
//       }
//     }
//   }
// }

// export abstract class Collector<E> {
//   static create<T>(nextValue: (elem: T) => void): Collector<T> {
//     return new class extends Collector<T> {
//       push(value: T) {
//         nextValue(value)
//       }
//     }()
//   }

//   abstract push(value: E): void

//   map<E2>(mapFun: (value: E2) => E): Collector<E2> {
//     return Collector.create(value => {
//       this.push(mapFun(value))
//     })
//   }

//   filter(filterFun: (value: E) => boolean): Collector<E> {
//     return Collector.create(value => {
//       if (filterFun(value)) this.push(value)
//     })
//   }

//   filterNot(filterFun: (value: E) => boolean): Collector<E> {
//     return this.filter(v => !filterFun(v))
//   }

//   take(amount: number): Collector<E> {
//     // if (amount <= 0) return 'empty'
//     let remain = amount

//     return Collector.create(value => {
//       while (remain > 0) {
//         remain--
//         this.push(value)
//       }
//     })
//   }

//   drop(amount: number): Collector<E> {
//     if (amount <= 0) return this

//     let remain = amount
//     return Collector.create(value => {
//       if (remain > 0) remain--
//       else this.push(value)
//     })
//   }

//   slice(from: number, amount: number): Collector<E> {
//     return this.drop(from).take(amount)
//   }

//   takeWhile(pred: (value: E) => boolean): Collector<E> {
//     let take = true

//     return Collector.create(value => {
//       if (take) take = pred(value)
//       if (take) this.push(value)
//     })
//   }

//   dropWhile(pred: (value: E) => boolean): Collector<E> {
//     let drop = true

//     return Collector.create(value => {
//       if (drop) drop = pred(value)
//       if (!drop) this.push(value)
//     })
//   }

//   distinctBy<K>(keyFun: (value: E) => K): Collector<E> {
//     const set = new Set<K>()

//     return Collector.create(value => {
//       const key = keyFun(value)
//       if (set.has(key)) return
//       set.add(key)
//       this.push(value)
//     })
//   }

//   distinct(): Collector<E> {
//     return this.distinctBy(v => v)
//   }

//   filterChanged(): Collector<E> {
//     let lastValue: E | NoValue = NoValue
//     return Collector.create(value => {
//       if (value === lastValue) return
//       lastValue = value
//       this.push(value)
//     })
//   }

//   flatten(): Collector<E[]> {
//     return Collector.create(values => {
//       for (const value of values) this.push(value)
//     })
//   }

//   sample(nth: number): Collector<E> {
//     let index = 0
//     return Collector.create(value => {
//       if (index % nth === 0) this.push(value)
//       index++
//     })
//   }

//   monitor(effect: (value: E) => void): Collector<E> {
//     return Collector.create(value => {
//       effect(value)
//       this.push(value)
//     })
//   }
// }

// function foldPushable<S>(init: S, combine: (state: S, elem: S) => S) {
//   return Collector.create()
// }
// class SumF extends Collector<number> {
//   state = 0

//   push(value: number) {
//     this.state += value
//   }
// }

// function drive<T>(it: Iterable<T>, p: Collector<T>) {
//   for (const elem of it) p.push(elem)
// }
