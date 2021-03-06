import { Readable } from 'stream'
import { BehaviorSubject, combineLatest, Observable, Subject, Subscription, PartialObserver } from 'rxjs'
import { map } from 'rxjs/operators'

export class NodeStreamSubject<T = Buffer> extends Subject<T> {
  private defaultBackpressure$ = new BehaviorSubject(false)
  private backpressureObservables: Observable<boolean>[] = [this.defaultBackpressure$]
  private backpressureSubscription?: Subscription

  constructor (private readableStream: Readable) {
    super()
    readableStream.pause()

    readableStream.on('data', (data: T) => this.next(data))
    readableStream.on('error', (err) => this.error(err))
    readableStream.on('end', () => !this.closed && this.complete())
    readableStream.on('close', () => !this.closed && this.complete())

    this.subscribeToBackpressureStreams()
  }

  private subscribeToBackpressureStreams () {
    if (this.backpressureSubscription) {
      this.backpressureSubscription.unsubscribe()
    }

    this.backpressureSubscription = combineLatest(this.backpressureObservables)
      .pipe(
        map((flowing: boolean[]) => flowing.every((flowing) => flowing))
      )
      .subscribe(this.backpressureObserver)
  }

  private backpressureObserver = (flowing: boolean) => flowing
    ? this.readableStream.resume() : this.readableStream.pause()

  registerBackpressure (backpressure$: Observable<boolean>) {
    const backpressureIndex = this.backpressureObservables.push(backpressure$)

    backpressure$.subscribe({
      complete: this.backpressureCompleteSubscriber(backpressureIndex)
    })

    this.subscribeToBackpressureStreams()
  }

  private backpressureCompleteSubscriber = (backpressureIndex: number) => () => {
    this.backpressureObservables.splice(backpressureIndex - 1, 1)
    this.subscribeToBackpressureStreams()
  }

  subscribe (
    observerOrNext?: PartialObserver<T> | ((value: T) => void),
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription {
    // @ts-ignore fix typings
    const subscription = super.subscribe(observerOrNext, error, complete)
    setImmediate(() => this.defaultBackpressure$.next(true))

    return subscription
  }

  unsubscribe (): void {
    super.unsubscribe()
    if (!this.observers || !this.observers.length) {
      this.defaultBackpressure$.next(false)
    }
  }
}
