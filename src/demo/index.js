const { Iter, AsyncIter, Fold } = require('../../dist/iternal.umd.js')

// const valueIter = Iter.range(0, 10).patchFirstWhere(v => v > 1, 1)

// valueIter.foreach(console.log)
// console.log(Iter.range(0, 10).fold(Fold.findLastOpt(v => v < 0)))
// Iter.range(0, 10)
//   .interleaveAll(Iter.range(0, 5), Iter.range(10, 18))
//   .take(100)
//   .forEach(v => console.log(v))

// Iter.range(0, 10)
//   .foldIter(Fold.partition(v => v % 2 === 0))
//   .forEach(v => console.log(v))

// Iter.of(1, 2, 2, 3, 5, 4, 4, 1, 1, 1, 6)
//   .filterChanged()
//   .forEach(v => console.log(v))

// console.log(
//   Iter.fromIterable('This is a test a string')
//     .patchAt(10, 0, () => ' hello ')
//     .splitOnElem(' ')
//     .map(v => v.join(''))
//     .fold(Fold.inverseFrequencies())
// )

const r = Fold.sum.combine(Fold.count).mapResult(([sum, count]) => sum / count)

// console.log(r.apply(Iter.of(1, 3, 5, 3, 4)))

// Iter.of(1, 3, 5, 3, 4)
//   .foldIter(r)
//   .monitor()
// Iter.of(1, 3, 5, 3, 4)
//   .foldIter(Fold.average)
//   .monitor()
// console.log(
//   Fold.findOr('X', e => e === 'b')
//     .combine(Fold.findOr('Y', e => e === 'c'))
//     .apply(
//       Iter.fromIterable('abcdef')
//         .monitor()
//         .monitor()
//     )
// )
// console.log(Fold.findLastOr(undefined).apply('abc'))
Iter.fromIterable(Fold.findOr(undefined).applyIter('abc'))
  .monitor()
  .map(a => true)
  .monitor()
  .forEach(console.log)
