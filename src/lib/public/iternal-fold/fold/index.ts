// /**
//  * @module iternal
//  */

// import { AnyIterable } from '../../constants'
// import { Iter, AsyncIter } from '../../iternal-sync'
// import { Collector, StateCollector } from '../gen-folder'

// export namespace Collect {
//   /**
//    * Returns the result of applying the given `collector` to each element yielded by the given `iterable`
//    * @typeparam the iterable element type
//    * @typeparam R the collector result type
//    * @param iterable an iterable yielding elements of type A
//    * @param collector a collector taking elements of type A and returning a result of type R
//    */
//   export function collect<A, R>(iterable: Iterable<A>, collector: Collector<A, R>): R {
//     return Iter.fromIterable(iterable).collect(collector)
//   }

//   /**
//    * Returns an Iter yielding the results of applying the given `collector` to each element yielded by the given `iterable`
//    * @typeparam the iterable element type
//    * @typeparam R the collector result type
//    * @param iterable an iterable yielding elements of type A
//    * @param collector a collector taking elements of type A and returning a result of type R
//    */
//   export function collectIter<A, R>(iterable: Iterable<A>, collector: Collector<A, R>): Iter<R> {
//     return Iter.fromIterable(iterable).collectIter(collector)
//   }

//   /**
//    * Returns the result of applying the given `collector` to each element yielded by the given `iterable`
//    * @typeparam the iterable element type
//    * @typeparam R the collector result type
//    * @param iterable an async iterable yielding elements of type A
//    * @param collector a collector taking elements of type A and returning a result of type R
//    */
//   export function collectAsync<A, R>(
//     iterable: AnyIterable<A>,
//     collector: Collector<A, R>
//   ): Promise<R> {
//     return AsyncIter.fromIterable(iterable).collect(collector)
//   }

//   /**
//    * Returns an Iter yielding the results of applying the given `collector` to each element yielded by the given `iterable`
//    * @typeparam the iterable element type
//    * @typeparam R the collector result type
//    * @param iterable an async iterable yielding elements of type A
//    * @param collector a collector taking elements of type A and returning a result of type R
//    */
//   export function collectAsyncIter<A, R>(
//     iterable: AnyIterable<A>,
//     collector: Collector<A, R>
//   ): AsyncIter<R> {
//     return AsyncIter.fromIterable(iterable).collectIter(collector)
//   }

//   // /**
//   //  * Returns a Collector where the provided GenCollectors are run in parallel.
//   //  * The given `combineFun` is applied to the array of results.
//   //  * Note: due to type system limitations only the type of the first other collector is kept
//   //  * @typeparam A the input element type
//   //  * @typeparam S the state type of the provided `col1`
//   //  * @typeparam R the output type of the provided `col1`
//   //  * @typeparam S2 the state type of the provided `col2`
//   //  * @typeparam R2 the output type of the provided `col2`
//   //  * @typeparam GR the result type of the `combineFun` function
//   //  * @param combineFun a function that takes the tupled output of all provided collectors, and combines them into one result value
//   //  * @param col1 a Collector taking the same type of elements
//   //  * @param col2 a Collector taking the same type of elements
//   //  * @param otherCollectors a number of Collectors taking the same type of elements
//   //  */
//   // export function combineWith<A, S, R, S2, R2, GR>(
//   //   combineFun: (...results: [R, R2, ...any[]]) => GR,
//   //   col1: StateCollector<A, S, R>,
//   //   col2: StateCollector<A, S2, R2>,
//   //   ...otherCollectors: Collector<A, any>[]
//   // ): Collector<A, GR> {
//   //   return _combineWith(combineFun, col1, col2, ...otherCollectors)
//   // }

//   // /**
//   //  * Returns a Collector running the provided Collectors are run in parallel.
//   //  * The results are collected into an array.
//   //  * Note: due to type system limitations only the type of the first other collector is kept
//   //  * @typeparam A the input element type
//   //  * @typeparam R the output type of the provided `col1`
//   //  * @typeparam R2 the output type of the provided `col2`
//   //  * @param col1 a Collector taking the same type of elements
//   //  * @param col2 a Collector taking the same type of elements
//   //  * @param otherCollectors a number of Collectors taking the same type of elements
//   //  */
//   // export function combine<A, R, R2, GR extends [R, R2, ...unknown[]]>(
//   //   col1: Collector<A, R>,
//   //   col2: Collector<A, R2>,
//   //   ...otherCollectors: Collector<A, unknown>[]
//   // ): Collector<A, GR> {
//   //   return _combine(col1, col2, ...otherCollectors)
//   // }

//   /**
//    * Returns a collector that feeds all input to the first `col1` collector, and for each input element takes the output value
//    * from `col1` and feeds this value to `col2`. The output value is the value resulting from `col2`.
//    * @typeparam A the input element type
//    * @typeparam R the result type of `col1`
//    * @typeparam R2 the result type of `col2`
//    * @param col1 the collector that receives the input
//    * @param col2 the collector that produces the output
//    */
//   export function pipe<A, R, R2>(col1: Collector<A, R>, col2: Collector<R, R2>): Collector<A, R2> {
//     return StateCollector.create(
//       () => ({
//         state1: col1.createInitState(),
//         state2: col2.createInitState()
//       }),
//       (states, elem, index) => {
//         states.state1 = col1.nextState(states.state1, elem, index)
//         states.state2 = col2.nextState(
//           states.state2,
//           col1.stateToResult(states.state1, index),
//           index
//         )
//         return states
//       },
//       ({ state2 }, index) => col2.stateToResult(state2, index),
//       ({ state1, state2 }, index) =>
//         (col1.escape !== undefined && col1.escape(state1, index)) ||
//         (col2.escape !== undefined && col2.escape(state2, index))
//     )
//   }
// }
