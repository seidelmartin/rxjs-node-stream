import { NodeStreamSubject } from './node-stream-subject'
import { Readable } from 'stream'
import * as sinon from 'sinon'
import { BehaviorSubject } from 'rxjs'
import * as assert from 'assert'

describe('Node stream subject', () => {
  let sandbox: sinon.SinonSandbox
  let sampleNodeStream: Readable

  before(() => {
    sandbox = sinon.createSandbox()
  })

  beforeEach(() => {
    sampleNodeStream = new Readable({
      read () {
        let i = 0
        while (i++ < 1000) {
          this.push(Buffer.from(i.toString()))
        }
        this.push(null)
      }
    })
  })

  afterEach(() => {
    sandbox.verifyAndRestore()
  })

  it('should create Subject observable from node stream and publish all messages to subscriber', (done) => {
    const nextSpy = sandbox.spy()
    const stream$ = new NodeStreamSubject(sampleNodeStream)

    stream$
      .subscribe({
        next: nextSpy,
        complete () {
          sinon.assert.callCount(nextSpy, 1000)
          sinon.assert.alwaysCalledWith(nextSpy, sinon.match.instanceOf(Buffer))
          done()
        }
      })
  })

  it('should emit error to error branch', (done) => {
    const nextSpy = sandbox.spy()

    const stream = new Readable({
      read () {
        let i = 0
        while (i++ < 100) {
          this.push(Buffer.from(i.toString()))
        }

        this.destroy(new Error('Fatal error reading'))
      }
    })

    const stream$ = new NodeStreamSubject(stream)

    stream$
      .subscribe({
        next: nextSpy,
        error (err) {
          assert.strictEqual(err.message, 'Fatal error reading')
          sinon.assert.callCount(nextSpy, 100)
          done()
        }
      })
  })

  it('should allow to pause stream by registering backpressure observable', (done) => {
    const nextSpyBeforePause = sandbox.spy()
    const nextSpyAfterPause = sandbox.spy()
    const pausedSpy = sandbox.spy(() => sampleNodeStream.isPaused())

    const stream$ = new NodeStreamSubject(sampleNodeStream)
    const backpressure$ = new BehaviorSubject<boolean>(true)
    stream$.registerBackpressure(backpressure$)

    stream$
      .subscribe({
        next (value: Buffer) {
          const index = Number(value.toString())

          if (index <= 400) {
            nextSpyBeforePause(value)
          } else {
            nextSpyAfterPause(value)
          }

          if (index === 400) {
            backpressure$.next(false)
            setTimeout(() => backpressure$.next(true), 30)
            setTimeout(pausedSpy, 10)
          }
        },
        complete () {
          sinon.assert.callCount(nextSpyBeforePause, 400)
          sinon.assert.callCount(nextSpyAfterPause, 600)
          assert(nextSpyBeforePause.calledBefore(nextSpyAfterPause))
          assert(pausedSpy.alwaysReturned(true))
          assert(pausedSpy.calledBefore(nextSpyAfterPause))
          done()
        }
      })
  })

  it('should allow multiple backpressure observables to be registered and if on of them says the stream should stop it stops', (done) => {
    const nextSpy = sandbox.spy()
    const pausedSpy = sandbox.spy(() => sampleNodeStream.isPaused())

    const stream$ = new NodeStreamSubject(sampleNodeStream)
    const backpressure$ = new BehaviorSubject<boolean>(true)
    const backpressure2$ = new BehaviorSubject<boolean>(true)
    stream$.registerBackpressure(backpressure$)
    stream$.registerBackpressure(backpressure2$)

    stream$
      .subscribe({
        next (value: Buffer) {
          const index = Number(value.toString())
          nextSpy()

          if (index === 200) {
            backpressure$.next(false)
            setTimeout(() => backpressure$.next(true), 30)
            setTimeout(pausedSpy, 10)
          }

          if (index === 400) {
            backpressure2$.next(false)
            setTimeout(() => backpressure2$.next(true), 30)
            setTimeout(pausedSpy, 10)
          }

          if (index === 600) {
            backpressure$.next(false)
            backpressure2$.next(false)
            setTimeout(() => (backpressure$.next(true), backpressure2$.next(true)), 30)
            setTimeout(pausedSpy, 10)
          }
        },
        complete () {
          sinon.assert.callCount(nextSpy, 1000)
          assert(pausedSpy.getCall(0).calledAfter(nextSpy.getCall(199)))
          assert(nextSpy.getCall(200).calledAfter(pausedSpy.getCall(0)))
          assert(pausedSpy.getCall(1).calledAfter(nextSpy.getCall(399)))
          assert(nextSpy.getCall(400).calledAfter(pausedSpy.getCall(1)))
          assert(pausedSpy.getCall(2).calledAfter(nextSpy.getCall(599)))
          assert(nextSpy.getCall(600).calledAfter(pausedSpy.getCall(2)))
          assert(pausedSpy.alwaysReturned(true))
          done()
        }
      })
  })

  it('should automatically remove completed backpressure observables from list', (done) => {
    const nextSpy = sandbox.spy()
    const pausedSpy = sandbox.spy(() => sampleNodeStream.isPaused())

    const stream$ = new NodeStreamSubject(sampleNodeStream)
    const backpressure$ = new BehaviorSubject<boolean>(true)
    stream$.registerBackpressure(backpressure$)

    stream$
      .subscribe({
        next (value: Buffer) {
          const index = Number(value.toString())
          nextSpy()

          if (index === 200) {
            backpressure$.next(false)
            setTimeout(() => backpressure$.complete(), 30)
            setTimeout(pausedSpy, 10)
          }
        },
        complete () {
          sinon.assert.callCount(nextSpy, 1000)
          assert(pausedSpy.getCall(0).calledAfter(nextSpy.getCall(199)))
          assert(nextSpy.getCall(200).calledAfter(pausedSpy.getCall(0)))
          done()
        }
      })
  })
})
