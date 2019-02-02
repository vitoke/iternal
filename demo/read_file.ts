/**
 * Usage from command line:
 * `node read_file.js -file '../inputfile.txt' -split '|,:'`
 * all options are optional
 */

import { asyncIter, Collector, Collectors, iter } from '..'

const fs = require('fs')

// Process command line arguments
const { file = 'README.md', split = '\n ' } = iter(process.argv)
  .drop(2)
  .sliding(2)
  .map(([opt, value]): [string, string] => [opt.slice(1), value])
  .collect(Collectors.toObject())

// Read file into string
const fileIter = asyncIter
  .fromSingleCallback(emit => fs.readFile(file, emit))
  .map(([_, result]) => result)
  .map(String)

async function run() {
  // Split text into words, and perform single pass calculations
  const result = await fileIter
    .flatMap<string>(text => text.split(new RegExp(`[${split}]`)))
    .filter(word => word.length > 1)
    .collect(
      Collector.combine(
        Collectors.histogram('TOP', 5),
        Collectors.average.mapInput(word => word.length),
        Collectors.rangeBy(word => word.length)
      )
    )

  console.log(result)
}

run()
