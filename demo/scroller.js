/**
 * Usage from command line:
 * `node scroller.js -chars '-AB' -width 60 -shift 5 -delay 40`
 * all options are optional
 */

const { Iter, Fold, Folds } = require('../../dist/iternal.umd.js')

// Process command line arguments

if (Fold.fold(process.argv, Folds.containsAny('-h', '-?', '-help'))) {
  console.log(
    `\
Usage from command line:
node scroller.js -chars '-AB' -width 60 -shift 5 -delay 40
all options are optional`
  )
  return
}

const { chars = ' X', width = 80, shift = 10, delay = 30 } = Iter.fromIterable(process.argv)
  .drop(2)
  .sliding(2)
  .map(([opt, value]) => [opt.slice(1), value])
  .fold(Folds.toObject())

// Draw patterns

Iter.randomInt(0, chars.length)
  .repeat()
  .map(i => chars[i])
  .sliding(width, shift)
  .map(arr => arr.join(''))
  .toAsync()
  .delay(delay)
  .forEach(console.log)
