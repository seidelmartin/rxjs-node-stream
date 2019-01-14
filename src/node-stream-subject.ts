import { Readable } from 'stream'
import { BehaviorSubject, combineLatest, Observable, Subject, Subscription } from 'rxjs'
import { PartialObserver } from 'rxjs/src/internal/types'
import { map } from 'rxjs/operators'

export class NodeStreamSubject<T = Buffer> extends Subject<T> {
  private initialBackpressure$ = new BehaviorSubject(false)
  private backpressure$: Observable<boolean> = this.initialBackpressure$

  constructor (private readableStream: Readable) {
    super()
    readableStream.pause()

    readableStream.on('data', (data: T) => this.next(data))
    readableStream.on('error', (err) => this.error(err))
    readableStream.on('end', () => this.complete())

    this.backpressure$.subscribe(this.backpressureObserver)
  }

  private backpressureObserver = (flowing: boolean) => flowing
    ? this.readableStream.resume() : this.readableStream.pause()

  registerBackpressure (backpressure$: Observable<boolean>) {
    this.backpressure$ = combineLatest(this.backpressure$, backpressure$)
      .pipe(map((flowing) => flowing[0] && flowing[1]))

    this.backpressure$.subscribe(this.backpressureObserver)
  }

  subscribe (observerOrNext?: PartialObserver<T> | ((value: T) => void),
    error?: (error: any) => void,
    complete?: () => void): Subscription {
    // @ts-ignore fix typings
    const subscription = super.subscribe(observerOrNext, error, complete)
    this.initialBackpressure$.next(true)

    return subscription
  }

  unsubscribe (): void {
    super.unsubscribe()
    if (!this.observers || !this.observers.length) {
      this.initialBackpressure$.next(false)
    }
  }
}
