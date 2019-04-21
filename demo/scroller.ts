/**
 * Usage from command line:
 * `node scroller.js -chars '-AB' -width 60 -shift 5 -delay 40`
 * all options are optional
 */

import iter from '../src/lib/public/iternal'

// Process command line arguments

if (iter(process.argv).collect(iter.ops.containsAny('-h', '-?', '-help'))) {
  console.log(
    `\
Usage from command line:
node scroller.js -chars '-AB' -width 60 -shift 5 -delay 40
all options are optional`
  )

  process.exit(0)
}

const { chars = ' X', width = 80, shift = 10, delay = 30 } = iter(process.argv)
  .drop(2)
  .sliding(2)
  .map(([opt, value]): [string, string] => [opt.slice(1), value])
  .collect(iter.ops.toObject())

// Draw patterns

iter
  .randomInt(0, chars.length)
  .repeat()
  .map(i => chars[i])
  .sliding(Number(width), Number(shift))
  .map(arr => arr.join(''))
  .toAsync()
  .delay(Number(delay))
  .forEach(console.log)
