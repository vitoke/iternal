// import { StateCollector, Collector } from '../../public/iternal-fold/gen-folder'
// import { Iter } from '../../public/iternal-sync'
// import { optPred } from '../iternal-common'

// export function combineWith<A, S, R, S2, R2, GR>(
//   combineFun: (...results: [R, R2, ...any[]]) => GR,
//   col1: StateCollector<A, S, R>,
//   col2: StateCollector<A, S2, R2>,
//   ...otherCollectors: Collector<A, any>[]
// ): Collector<A, GR> {
//   return StateCollector.create<A, [S, S2, ...any[]], GR>(
//     () => [
//       col1.createInitState(),
//       col2.createInitState(),
//       ...otherCollectors.map(folder => folder.createInitState())
//     ],
//     ([state1, state2, ...otherStates], elem, index) => [
//       col1.nextState(state1, elem, index),
//       col2.nextState(state2, elem, index),
//       ...Iter.fromIterable(otherStates).zipWith(
//         (state, folder) => folder.nextState(state, elem, index),
//         otherCollectors
//       )
//     ],
//     ([state1, state2, ...otherStates], index) =>
//       combineFun(
//         col1.stateToResult(state1, index),
//         col2.stateToResult(state2, index),
//         ...Iter.fromIterable(otherStates).zipWith(
//           (state, folder) => folder.stateToResult(state, index),
//           otherCollectors
//         )
//       ),
//     ([state1, state2, ...otherStates], index) =>
//       optPred(state1, index, col1.escape) &&
//       optPred(state2, index, col2.escape) &&
//       Iter.fromIterable(otherStates)
//         .zipWith(
//           (state, folder) => optPred(state, index, folder.escape),
//           otherCollectors
//         )
//         .collect(andFolder)
//   )
// }

// export function combine<A, R, R2, GR extends [R, R2, ...unknown[]]>(
//   col1: Collector<A, R>,
//   col: Collector<A, R2>,
//   ...otherCollectors: Collector<A, unknown>[]
// ): Collector<A, GR> {
//   return combineWith<A, any, R, any, R2, GR>(
//     (...results) => results as GR,
//     col1,
//     col,
//     ...otherCollectors
//   )
// }

// export const andFolder: Collector<boolean, boolean> = StateCollector.create<
//   boolean,
//   boolean,
//   boolean
// >(() => true, (state, value) => state && value, state => state)
