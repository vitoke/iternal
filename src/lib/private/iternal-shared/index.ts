import { GenFolder, Folder } from '../../public/iternal-fold/gen-folder'
import { Iter } from '../../public/iternal-sync'
import { optPred } from '../iternal-common'

export function combineWith<A, S, R, S2, R2, GR>(
  combineFun: (...results: [R, R2, ...any[]]) => GR,
  folder1: GenFolder<A, S, R>,
  folder2: GenFolder<A, S2, R2>,
  ...otherFolders: Folder<A, any>[]
): Folder<A, GR> {
  return GenFolder.create<A, [S, S2, ...any[]], GR>(
    () => [
      folder1.createInitState(),
      folder2.createInitState(),
      ...otherFolders.map(folder => folder.createInitState())
    ],
    ([state1, state2, ...otherStates], elem, index) => [
      folder1.nextState(state1, elem, index),
      folder2.nextState(state2, elem, index),
      ...Iter.fromIterable(otherStates).zipWith(
        (state, folder) => folder.nextState(state, elem, index),
        otherFolders
      )
    ],
    ([state1, state2, ...otherStates], index) =>
      combineFun(
        folder1.stateToResult(state1, index),
        folder2.stateToResult(state2, index),
        ...Iter.fromIterable(otherStates).zipWith(
          (state, folder) => folder.stateToResult(state, index),
          otherFolders
        )
      ),
    ([state1, state2, ...otherStates], index) =>
      optPred(state1, index, folder1.escape) &&
      optPred(state2, index, folder2.escape) &&
      Iter.fromIterable(otherStates)
        .zipWith(
          (state, folder) => optPred(state, index, folder.escape),
          otherFolders
        )
        .fold(andFolder)
  )
}

export function combine<A, R, R2, GR extends [R, R2, ...unknown[]]>(
  folder1: Folder<A, R>,
  folder2: Folder<A, R2>,
  ...otherFolders: Folder<A, unknown>[]
): Folder<A, GR> {
  return combineWith<A, any, R, any, R2, GR>(
    (...results) => results as GR,
    folder1,
    folder2,
    ...otherFolders
  )
}

export const andFolder: Folder<boolean, boolean> = GenFolder.create<
  boolean,
  boolean,
  boolean
>(() => true, (state, value) => state && value, state => state)
