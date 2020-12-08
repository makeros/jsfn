const { waitManyForOneWithMemo } = require('./index')

describe('many-to-one-curry-async', () => {
  let resultFn
  beforeEach(() => {
    resultFn = jest.fn()
  })

  it('should return the result for all clients', () => {
    resultFn.mockResolvedValue('valid result')
    const fn = waitManyForOneWithMemo({ retryCount : 1}, resultFn)

    expect.assertions(2)
    return Promise.all([fn(), fn(), fn()])
      .then(results => {
        expect(resultFn.mock.calls.length).toEqual(1)
        expect(results).toEqual(['valid result', 'valid result', 'valid result'])
      })
  })

  it('shuld return the value for one client', async () => {
    resultFn.mockResolvedValue('valid result')
    const fn = waitManyForOneWithMemo({ retryCount : 1}, resultFn)

    fn()
    fn()
    const result = await fn()
    expect(result).toEqual('valid result')
    expect(resultFn.mock.calls.length).toEqual(1)
  })

  it('should retry when the result function is failing for all clients', (done) => {
    resultFn
      .mockImplementationOnce(() => new Promise((resolve, reject) => reject()))
      .mockImplementationOnce(() => new Promise((resolve, reject) => reject()))
      .mockResolvedValue('valid result')
    const fn = waitManyForOneWithMemo({ retryCount : 3}, resultFn)

    Promise.all([fn(), fn(), fn()])
      .then(results => {
        expect(results).toEqual(['valid result', 'valid result', 'valid result'])
        expect(resultFn.mock.calls.length).toEqual(3)
        done()
      })
  })

  it('should retry when the result function is failing for one client', async () => {
    resultFn
      .mockImplementationOnce(() => new Promise((resolve, reject) => reject()))
      .mockImplementationOnce(() => new Promise((resolve, reject) => reject()))
      .mockResolvedValue('valid result')
    
    const fn = waitManyForOneWithMemo({ retryCount : 3}, resultFn)
    const result = await fn()
    expect(result).toEqual('valid result')
    expect(resultFn.mock.calls.length).toEqual(3)
  })

  it('should throw error when all retries failed', () => {
    resultFn
      .mockImplementation(() => new Promise((resolve, reject) => reject(Error('Retries exceeded.'))))
    const fn = waitManyForOneWithMemo({ retryCount : 3}, resultFn)

    expect.assertions(2)
    return fn().catch((e) => {
      expect(e.message).toEqual('Retries exceeded.')
      expect(resultFn.mock.calls.length).toEqual(3)
    })
  })

  it('should reset the retries counter after previous fetching failed', async () => {
    resultFn
      .mockImplementation(() => new Promise((resolve, reject) => reject(Error('Undefined error.'))))

    const fn = waitManyForOneWithMemo({ retryCount : 3}, resultFn)

    expect.assertions(4)
    try {
      await fn()
    } catch (e) {
      expect(resultFn.mock.calls.length).toEqual(3)
      expect(e.message).toEqual('Undefined error.')
    }

    try {
      await fn()
    } catch (e) {
      expect(resultFn.mock.calls.length).toEqual(6)
      expect(e.message).toEqual('Undefined error.')
    }
  })

  it('should return the same error to each client when the resultFn fails and retries are exceeded', () => {
    resultFn
      .mockImplementation(() => new Promise((resolve, reject) => reject(Error('Ultimate fail.'))))

    const fn = waitManyForOneWithMemo({ retryCount : 3}, resultFn)
    expect.assertions(3)
    return Promise.all([new Promise ((resolve) => {
      fn().catch(e => {
        expect(e.message).toEqual('Ultimate fail.')
        resolve()
      })
    }), new Promise ((resolve) => {
      fn().catch(e => {
        expect(e.message).toEqual('Ultimate fail.')
        resolve()
      })
    }), new Promise ((resolve) => {
      fn().catch(e => {
        expect(e.message).toEqual('Ultimate fail.')
        resolve()
      })
    })])
  })

  it('should return cached data when it was loaded before', async () => {
    resultFn.mockResolvedValue('valid result')
    const fn = waitManyForOneWithMemo({ retryCount : 1}, resultFn)

    expect.assertions(4)

    const result1 = await fn()
    expect(result1).toEqual('valid result')

    const result2 = await fn()
    expect(result2).toEqual('valid result')

    const result3 = await fn()
    expect(result3).toEqual('valid result')

    expect(resultFn.mock.calls.length).toEqual(1)
  })

  it('should stop retry under additional conditions', async () => {
    resultFn
      .mockImplementation(() => new Promise((resolve, reject) => reject(Error('Ultimate fail.'))))

    const fn = waitManyForOneWithMemo({
      retryCount : 3,
      retryConditionFn: function () { return false }
    }, resultFn)

    expect.assertions(1)

    try {
      await fn()
    } catch (e) {
      expect(resultFn.mock.calls.length).toEqual(1)
    }
  })

  it('should retry under specific conditions', async () => {
    resultFn
    .mockImplementation(() => new Promise((resolve, reject) => reject(Error('retry_condition'))))

    const fn = waitManyForOneWithMemo({
      retryCount : 3,
      retryConditionFn: function (e) { return e.message === 'retry_condition' }
    }, resultFn)

    expect.assertions(1)

    try {
      await fn()
    } catch (e) {
      expect(resultFn.mock.calls.length).toEqual(3)
    }
  })

  it('should refetch the result when clearCache was called', (done) => {
    resultFn
      .mockImplementationOnce(() => new Promise((r) => r('valid result 1')))
      .mockImplementationOnce(() => new Promise((r) => r('valid result 2')))
      .mockImplementationOnce(() => new Promise((r) => r('valid result 3')))

    const fn = waitManyForOneWithMemo({ retryCount : 2}, resultFn)

    expect.assertions(4)
    Promise.all([fn(), fn(true), fn()])
    .then((results) => {
      expect(resultFn.mock.calls.length).toEqual(1)
      expect(results).toEqual(['valid result 1', 'valid result 1', 'valid result 1'])
      return Promise.all([fn(), fn(true), fn()])
    })
    .then(results => {
      expect(resultFn.mock.calls.length).toEqual(2)
      expect(results).toEqual(['valid result 1', 'valid result 2', 'valid result 2'])
      done()
    })
  })
})