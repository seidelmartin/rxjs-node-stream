import { range } from 'rxjs'
import { map } from 'rxjs/operators'
import { ObservableStream } from './observable-stream'
import * as sinon from 'sinon'
import * as assert from 'assert'

describe('Observable stream', () => {
  let sandbox: sinon.SinonSandbox

  before(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.verifyAndRestore()
  })

  it('should put the observable values to read stream', (done) => {
    const dataSpy = sandbox.spy()

    const range$ = range(0, 10)
      .pipe(map((value) => Buffer.from(String(value))))

    const stream = new ObservableStream(range$)

    stream.on('data', dataSpy)
    stream.on('end', () => {
      sinon.assert.callCount(dataSpy, 10)
      sinon.assert.alwaysCalledWith(dataSpy, sinon.match.instanceOf(Buffer))
      done()
    })
  })

  it(`should put the values of observable to buffer in case the stream is paused`, (done) => {
    const dataSpy = sandbox.spy()

    const range$ = range(0, 10)
      .pipe(map((value) => Buffer.from(String(value))))

    const stream = new ObservableStream(range$)

    const pausedSpy = sandbox.spy(stream, 'isPaused')

    stream.on('data', (value: Buffer) => {
      dataSpy(value)

      if (value.toString() === '5') {
        stream.pause()
        setTimeout(() => stream.resume(), 30)
        setTimeout(() => pausedSpy.call(stream), 10)
      }
    })
    stream.on('end', () => {
      sinon.assert.callCount(dataSpy, 10)
      assert(dataSpy.getCall(6).calledAfter(pausedSpy.getCall(0)))
      done()
    })
  })
})
