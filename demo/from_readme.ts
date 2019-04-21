import iter from '..'

// Simple

console.log(
  iter
    .of(1, 3, 5)
    .map(v => v * 2)
    .toArray()
)

console.log('The min and max value: ', iter([8, 3, 6, 7], [4, 10, 6]).collect(iter.ops.range))

console.log(
  'Average word length:',
  iter(['This', 'is', 'a', 'test']).collect(iter.ops.average.mapInput(w => w.length))
)

// Advanced

// rangeBy returns the values for which the function gives the minimum and maximum value
const shortestAndLongestStringCollector = iter.ops.rangeBy<string>(w => w.length)

// mapInput converts some input type into a type the collector understands
const averageStringLengthCollector = iter.ops.average.mapInput<string>(w => w.length)

// We construct a string from the combination of the above two collectors
const verySpecificCollector = iter.collector.combineWith(
  ([shortest, longest], avgLen) =>
    `Shortest word: ${shortest}, longest word: ${longest}, average length: ${avgLen}`,
  shortestAndLongestStringCollector,
  averageStringLengthCollector
)

// We create an Iter iterable from a string split
const words = iter('This is a very normal sentence'.split(' '))

// Get the final result at once
console.log(words.collect(verySpecificCollector))

// Get the results for each new word
words.collectIter(verySpecificCollector).forEach(v => console.log(v))

const obj = { a: 1, b: 'test' }

iter.objectEntries(obj).map(result => {
  if (result[0] === 'a') {
    const r = result[1]
  }
})
