import { FoldFun, OptLazy, optToLazy, Pred } from '../../constants'
import { Iter } from '../../iternal-sync'
import { Folder, MonoFolder, MonoFun, GenFolder } from '../types'
import { GenFolderImpl } from '../gen-folder'
import { optPred } from '../../../private/iternal-common'

export class Fold {
  /**
   * Creates a new Folder object from element type A to result type R
   * @typeparam A the input element type
   * @typeparam S the intermediate state type
   * @typeparam R the result type
   * @param initState the initial state of the folder, optionally lazy
   * @param nextState a function taking the current state S and the next element A and returns the next state S
   * @param stateToResult a function that takes a state S and maps it to a result R
   * @param escape a predicate over a state S indicating whether its value can still ever change
   */
  static createGen = <A, S, R>(
    initState: OptLazy<S>,
    nextState: FoldFun<A, S>,
    stateToResult: (state: S) => R,
    escape?: Pred<S>
  ): Folder<A, R> => new GenFolderImpl(optToLazy(initState), nextState, stateToResult, escape)

  /**
   * Creates a new Folder object from element type A to result type R
   * @typeparam A the input element type
   * @typeparam R the state and result type
   * @param initState the initial state of the folder, optionally lazy
   * @param nextState a function taking the current state R and the next element A and returns the next state R
   * @param escape a predicate over a state R indicating whether its value can still ever change
   */
  static create = <A, R>(
    initState: OptLazy<R>,
    nextState: FoldFun<A, R>,
    escape?: Pred<R>
  ): Folder<A, R> => new GenFolderImpl(optToLazy(initState), nextState, v => v, escape)

  /**
   * Creates a new monoid-like Folder object taking and generating elements of type A
   * @typeparam A the input and output element type
   * @param initState the initial state of the folder, optionally lazy
   * @param nextState a function taking the current state A and the next element A and returns the next state A
   * @param escape a predicate over a state A indicating whether its value can still ever change
   */
  static createMono = <A>(
    initState: OptLazy<A>,
    nextState: MonoFun<A>,
    escape?: (st: A) => boolean
  ): MonoFolder<A> => Fold.create(optToLazy(initState), nextState, escape)

  static apply<A, R>(folder: Folder<A, R>, iterable: Iterable<A>): R {
    return Iter.fromIterable(iterable).fold(folder)
  }

  static applyAllWith<A, R, R2, GR>(
    combineFun: (...results: [R, R2, ...any[]]) => GR,
    iterable: Iterable<A>,
    folder1: Folder<A, R>,
    folder2: Folder<A, R2>,
    ...otherFolders: Folder<A, any>[]
  ): GR {
    return Fold.apply(Fold.combineWith(combineFun, folder1, folder2, ...otherFolders), iterable)
  }

  static applyAll<A, R, R2>(
    iterable: Iterable<A>,
    folder1: Folder<A, R>,
    folder2: Folder<A, R2>,
    ...otherFolders: Folder<A, any>[]
  ): [R, R2, ...any[]] {
    return Fold.apply(Fold.combine(folder1, folder2, ...otherFolders), iterable)
  }

  static applyIter<A, R>(folder: Folder<A, R>, iterable: Iterable<A>): Iter<R> {
    return Iter.fromIterable(iterable).foldIter(folder)
  }

  static combineWith<A, S, R, S2, R2, GR>(
    combineFun: (...results: [R, R2, ...any[]]) => GR,
    firstFolder: GenFolder<A, S, R>,
    otherFolder: GenFolder<A, S2, R2>,
    ...otherFolders: Folder<A, any>[]
  ): Folder<A, GR> {
    return new GenFolderImpl<A, [S, S2, ...any[]], GR>(
      () => [
        firstFolder.createInitState(),
        otherFolder.createInitState(),
        ...otherFolders.map(folder => folder.createInitState())
      ],
      ([state1, state2, ...otherStates], elem, index) => [
        firstFolder.nextState(state1, elem, index),
        otherFolder.nextState(state2, elem, index),
        ...Iter.fromIterable(otherStates).zipWith(
          (state, folder) => folder.nextState(state, elem, index),
          otherFolders
        )
      ],
      ([state1, state2, ...otherStates]) =>
        combineFun(
          firstFolder.stateToResult(state1),
          otherFolder.stateToResult(state2),
          ...Iter.fromIterable(otherStates).zipWith(
            (state, folder) => folder.stateToResult(state),
            otherFolders
          )
        ),
      ([state1, state2, ...otherStates], index) =>
        optPred(state1, index, firstFolder.escape) &&
        optPred(state2, index, otherFolder.escape) &&
        Iter.fromIterable(otherStates)
          .zipWith((state, folder) => optPred(state, index, folder.escape), otherFolders)
          .fold(andFolder)
    )
  }

  static combine<A, S, R, S2, R2>(
    firstFolder: GenFolder<A, S, R>,
    otherFolder: GenFolder<A, S2, R2>,
    ...otherFolders: Folder<A, any>[]
  ): Folder<A, [R, R2, ...any[]]> {
    return Fold.combineWith((...results) => results, firstFolder, otherFolder, ...otherFolders)
  }
}

const andFolder: Folder<boolean, boolean> = new GenFolderImpl(
  () => true,
  (state, value) => state && value,
  state => state
)
