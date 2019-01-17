/**
 * Usage from command line:
 * `node read_file.js -file '../inputfile.txt' -split '|,:'`
 * all options are optional
 */

const fs = require('fs')
const { Iter, AsyncIter, Fold, Folds } = require('../../dist/iternal.umd.js')

// Process command line arguments
const { file = 'README.md', split = '\n ' } = Iter.fromIterable(process.argv)
  .drop(2)
  .sliding(2)
  .map(([opt, value]) => [opt.slice(1), value])
  .fold(Folds.toObject())

const fileIter = AsyncIter.fromSingleCallback(emit => fs.readFile(file, emit))
  .map(([_, result]) => result)
  .map(String)

async function run() {
  const splitChars = new Set(split)

  const result = await AsyncIter.flatten(fileIter)
    .splitWhere(v => splitChars.has(v))
    .map(v => ''.concat(...v))
    .fold(Fold.combine(Folds.histogram('TOP', 5), Folds.average.mapInput(v => v.length)))

  console.log(result)
}

run()
