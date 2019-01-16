import { Readable, ReadableOptions } from 'stream'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'

export class ObservableStream<T = Buffer> extends Readable {

  private subscription?: Subscription
  private buffer: T[] & [null?] = []
  public readonly backpressure$ = new BehaviorSubject<boolean>(true)

  constructor (private stream$: Observable<T>, opts?: ReadableOptions) {
    super(opts)

    this.backpressure$.subscribe({
      next: (flowing) => flowing ? this.resume() : this.pause()
    })

    this.once('end', this.endHandler)
    this.once('close', this.endHandler)
  }

  private endHandler = () => {
    !this.backpressure$.closed && this.backpressure$.complete()
    this.subscription && this.subscription.unsubscribe()
  }

  _read (): void {
    if (!this.subscription) {
      this.subscription = this.stream$.subscribe({
        next: this.subscriptionNext,
        error: (err) => this.emit('error', err),
        complete: () => {
          this.buffer.length ? this.buffer.push(null) : this.push(null)
        }
      })
      return
    }

    while (this.buffer.length) {
      this.push(this.buffer.shift())
    }
  }

  pause (): this {
    this.backpressure$.value && this.backpressure$.next(false)
    return super.pause()
  }

  resume (): this {
    !this.backpressure$.value && this.backpressure$.next(true)
    return super.resume()
  }

  private subscriptionNext = (value: T) => {
    if (this.isPaused() || this.buffer.length) {
      return this.buffer.push(value)
    }

    this.push(value)
  }
}
