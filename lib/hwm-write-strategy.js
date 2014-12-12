export default createHWMWriteStrategy

class HWMWriteStrategy {
  constructor(committer, finish, onerror, resume, hwm, countItem) {
    this._countItem = countItem;
    this._buffer = [];
    this._byteLength = 0;
    this._committer = committer;
    this._finish = finish;
    this._onerror = onerror;
    this._resume = makeResume(this, resume);
    this._hwm = hwm;

    this._needResume = false;
    this._writing = false;
    this._ended = false;
  }

  write(item) {
    var pair = {item, size: this._countItem(item)}
    this._byteLength += pair.size;
    this._needResume = this._byteLength >= this._hwm;
    if (this._writing) {
      return bufferItem(this, pair);
    }
    return writeItem(this, pair);
  }

  end(err) {
    this._ended = true;
    if (err) {
      this._onerror(err);
    }
  }

  clear() {
    this._buffer.length = 0;
  }
}

function bufferItem(strategy, pair) {
  strategy._buffer.push(pair);
  return !strategy._needResume;
}

function writeItem(strategy, {item, size}) {
  var sync = true;
  var called = 0;
  strategy._writing = true;
  strategy._committer(item, (err) => {
    if (++called > 1) {
      err = new Error('called multiple times');
    }
    if (err) {
      return strategy._onerror(err);
    }

    strategy._byteLength -= size;
    if (!sync) {
      strategy._resume();
    } else {
      strategy._writing = false;
    }
  });

  sync = false;
  if (strategy._writing) {
    return !strategy._needResume;
  }
  return true;
}

function makeResume(strategy, baseResume) {
  return () => {
    do {
      strategy._writing = false;
      if (strategy._buffer.length == 0) {
        if (strategy._needResume) {
          strategy._needResume = false;
          baseResume();
        }
        return;
      }
      var pair = strategy._buffer.shift();
      if (!writeItem(strategy, pair)) {
        return;
      }
    } while(!strategy._writing);
  }
}

function createHWMWriteStrategy(hwm=4096, countItem=defaultCountItem) {
  return (committer, finish, onerror, resume) => {
    return new HWMWriteStrategy(committer, finish, onerror, resume, hwm, countItem);
  }
}

function defaultCountItem(xs) {
  return xs.length;
}
