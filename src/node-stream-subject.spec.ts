import { NodeStreamSubject } from './node-stream-subject'
import { Readable } from 'stream'
import * as sinon from 'sinon'
import { Subject } from 'rxjs'
import * as assert from 'assert'

describe('Node stream subject', () => {
  let sandbox: sinon.SinonSandbox

  before(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.verifyAndRestore()
  })

  it('should create Subject observable from node stream and publish all messages to subscriber', (done) => {
    const nextSpy = sandbox.spy()

    const stream = new Readable({
      read () {
        let i = 0
        while (i++ < 1000) {
          this.push(Buffer.from(i.toString()))
        }
        this.push(null)
      }
    })

    const stream$ = new NodeStreamSubject(stream)

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

  it('should allow to pause stream by registering backpressure observable', (done) => {
    const stream = new Readable({
      read () {
        let i = 0
        while (i++ < 1000) {
          this.push(Buffer.from(i.toString()))
        }
        this.push(null)
      }
    })

    const nextSpyBeforePause = sandbox.spy()
    const nextSpyAfterPause = sandbox.spy()
    const pausedSpy = sandbox.spy(() => stream.isPaused())

    const stream$ = new NodeStreamSubject(stream)
    const backpressure$ = new Subject<boolean>()
    stream$.registerBackpressure(backpressure$)

    stream$
      .subscribe({
        next: (value: Buffer) => {
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
})
