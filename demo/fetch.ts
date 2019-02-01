import { iter, Collect, Collectors, asyncIter } from '..'

// Simple

console.log(
  iter
    .of(1, 3, 5)
    .map(v => v * 2)
    .toArray()
)

console.log('The min and max value: ', iter.of(8, 3, 6, 7).collect(Collectors.range))

console.log(
  'Average word length:',
  iter.of('This', 'is', 'a', 'test').collect(Collectors.average.mapInput(w => w.length))
)

// Advanced

// rangeBy returns the values for which the function gives the minimum and maximum value
const shortestAndLongestStringCollector = Collectors.rangeBy<string>(w => w.length)

// mapInput converts some input type into a type the collecter understands
const averageStringLengthCollector = Collectors.average.mapInput<string>(w => w.length)

// We construct a string from the combination of the above two collecters
const verySpecificCollecter = Collect.combineWith(
  ([shortest, longest], avgLen) =>
    `Shortest word: ${shortest}, longest word: ${longest}, average length: ${avgLen}`,
  shortestAndLongestStringCollector,
  averageStringLengthCollector
)

// We create an Iter iterable from a string split
const words = iter('This is a very normal sentence'.split(' '))

// Get the final result at once
console.log(words.collect(verySpecificCollecter))

// Get the results for each new word
words.collectIter(verySpecificCollecter).forEach(v => console.log(v))
