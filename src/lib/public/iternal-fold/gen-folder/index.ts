import { optPred } from '../../../private/iternal-common'
import { FoldFun, Pred } from '../../constants'
import { Iter } from '../../iternal-sync'
import { GenFolder, Folder } from '../types'

/**
 * Generic Folder type
 * Represents a generic foldable computation
 * @typeparam A the input element type
 * @typeparam S the intermediate state type
 * @typeparam R the output value type
 */
export class GenFolderImpl<A, S, R> implements GenFolder<A, S, R> {
  /**
   * Constructs a new GenFolder instance
   * @param createInitState a lazy value generating the initial state for the fold function
   * @param nextState a function taking the current state S and the next element A and its index, and returning the next state
   * @param stateToResult a function that maps a state S to an output value R
   * @param escape an optional function indicating that the output value will never change no matter what input is offered further
   */
  constructor(
    readonly createInitState: () => S,
    readonly nextState: FoldFun<A, S>,
    readonly stateToResult: (state: S) => R,
    readonly escape?: Pred<S>
  ) {}

  /**
   * Returns a GenFolder where the output value(s) are mapped using the given `mapFun`
   * @typeparam R2 the new output type
   * @param mapFun a function from current output type R to new output type R2
   */
  mapResult<R2>(mapFun: (result: R) => R2): GenFolder<A, S, R2> {
    return new GenFolderImpl(
      this.createInitState,
      this.nextState,
      result => mapFun(this.stateToResult(result)),
      this.escape
    )
  }

  /**
   * Returns a GenFolder where this GenFolder and the provided GenFolders are run in parallel.
   * The given `combineFun` is applied to the array of results.
   * Note: due to type system limitations only the type of the first other folder is kept
   * @typeparam S2 the state type of the provided `otherFolder`
   * @typeparam R2 the output type of the provided `otherFolder`
   * @typeparam GR the result type of the `combineFun` function
   * @param combineFun a function that takes the simultaneous output of all provided folders, and combines them into one result value
   * @param otherFolder a GenFolder taking the same type of elements as this GenFolder
   * @param otherFolders a number of Genfolders taking the same type of elements as this GenFolder
   */
  combineWith<S2, R2, GR>(
    combineFun: (...results: [R, R2, ...any[]]) => GR,
    otherFolder: GenFolder<A, S2, R2>,
    ...otherFolders: Folder<A, any>[]
  ): Folder<A, GR> {
    return new GenFolderImpl<A, [S, S2, ...any[]], GR>(
      () => [
        this.createInitState(),
        otherFolder.createInitState(),
        ...otherFolders.map(folder => folder.createInitState())
      ],
      ([state1, state2, ...otherStates], elem, index) => [
        this.nextState(state1, elem, index),
        otherFolder.nextState(state2, elem, index),
        ...Iter.fromIterable(otherStates).zipWith(
          (state, folder) => folder.nextState(state, elem, index),
          otherFolders
        )
      ],
      ([state1, state2, ...otherStates]) =>
        combineFun(
          this.stateToResult(state1),
          otherFolder.stateToResult(state2),
          ...Iter.fromIterable(otherStates).zipWith(
            (state, folder) => folder.stateToResult(state),
            otherFolders
          )
        ),
      ([state1, state2, ...otherStates], index) =>
        optPred(state1, index, this.escape) &&
        optPred(state2, index, otherFolder.escape) &&
        Iter.fromIterable(otherStates)
          .zipWith((state, folder) => optPred(state, index, folder.escape), otherFolders)
          .fold(andFolder)
    )
  }

  /**
   * Returns a GenFolder where this GenFolder and the provided GenFolders are run in parallel.
   * The results are collected into an array.
   * Note: due to type system limitations only the type of the first other folder is kept
   * @typeparam S2 the state type of the provided `otherFolder`
   * @typeparam R2 the output type of the provided `otherFolder`
   * @param otherFolder a GenFolder taking the same type of elements as this GenFolder
   * @param otherFolders a number of Genfolders taking the same type of elements as this GenFolder
   */
  combine<S2, R2>(
    otherFolder: GenFolder<A, S2, R2>,
    ...otherFolders: Folder<A, any>[]
  ): Folder<A, [R, R2, ...any[]]> {
    return this.combineWith((...results) => results, otherFolder, ...otherFolders)
  }
}

const andFolder: Folder<boolean, boolean> = new GenFolderImpl(
  () => true,
  (state, value) => state && value,
  state => state
)
