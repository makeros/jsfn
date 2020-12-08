 function waitManyForOne ({ retryCount, retryConditionFn }, resultFn) {
  let refreshing
  let _maxRetries = retryCount
  const _retryConditionFn = retryConditionFn || function () { return true }
  
  return function pull () {
    if (!refreshing) {
      refreshing = resultFn()
        .then((result) => {
          refreshing = undefined
          return result
        }, (e) => {
          _maxRetries--
          refreshing = undefined
          if (_maxRetries > 0 && _retryConditionFn(e)) {
            return pull()
          }
          _maxRetries = retryCount
          throw e
        })
    }
    
    return new Promise((resolve, reject) => {
      refreshing
        .then(resolve, reject)
    })
  }
}

function withAsyncMemo (fn) {
  return function memo (...args) {
    let _result
    const _fn = fn(...args)
    return async function (forceClearCache) { // TODO: this function should pass arguments to the original resultFn (_fn) function
      if (forceClearCache) {
        _result = undefined
      }
      if (_result) {
        return _result
      }
      _result = await _fn()
      return _result
    }
  }

}
exports.waitManyForOne = waitManyForOne
exports.withAsyncMemo = withAsyncMemo
exports.waitManyForOneWithMemo = withAsyncMemo(waitManyForOne)