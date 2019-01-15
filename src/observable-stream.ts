import { Readable, ReadableOptions } from 'stream'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'

export class ObservableStream<T = Buffer> extends Readable {

  private subscription?: Subscription
  private buffer: T[] = []
  public readonly backpressure$ = new BehaviorSubject<boolean>(true)

  constructor (private stream$: Observable<T>, opts?: ReadableOptions) {
    super(opts)

    this.backpressure$.subscribe({
      next: (flowing) => flowing ? this.resume() : this.pause()
    })
  }

  _read (): void {
    if (!this.subscription) {
      this.stream$.subscribe({
        next: this.subscriptionNext,
        error: (err) => this.emit('error', err),
        complete: () => {
          this.backpressure$.complete()
          this.push(null)
        }
      })
      return
    }

    if (this.buffer.length) {
      while (this.buffer.length && !this.isPaused()) {
        setImmediate(() => this.push(this.buffer.shift()))
      }
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
