import {
  Collect,
  ICollector,
  CollectResult
} from '../src/lib/public/iternal-collect'

const prod: Collect<number, number> = Collect.from(1, () => {
  let state = 1

  return (value): CollectResult<number> => {
    if (state === 0) return { done: true }
    state *= value
    return { value: state, done: false }
  }
})

// class Prod implements ICollector<number, number> {
//   state = 1

//   next(value: number) {
//     this.state *= value
//     return { value: this.state, done: false }
//   }
// }

describe('it does something', () => {
  test('does something', () => {
    const c = prod.mapResult(v => v * 2).takeInput(2)
    const col = c.collector()
    // console.log(col.next((undefined as any) as number))
    console.log(10, col.next(10))
    console.log(0, col.next(0))
    console.log(20, col.next(20))
  })
})
