export default createHWMReadStrategy

class HWMReadStrategy {
  constructor(readFn, hwm, countItem) {
    this._buffer = [];
    this._hwm = hwm;
    this._countItem = countItem;
    this._byteLength = 0;
    this._fillScheduled = false;
    this._read = readFn;
    this._ended = false;
  }

  push(item) {
    var size = this._countItem(item);
    this._byteLength += size;
    var shouldFlush = this._hwm <= this._byteLength;
    this._buffer.push({
      size: size,
      item: item
    })
    if (!this._fillScheduled && !shouldFlush) {
      this.scheduleFill();
    }
    return shouldFlush;
  }

  setEOF() {
    this._ended = true;
  }

  scheduleFill() {
    if (this._fillScheduled) return;
    this._fillScheduled = true;
    process.nextTick(() => {
      this._fillScheduled = false;
      this.fill();
    })
  }

  fill() {
    var len = this._buffer.length;
    while (!this._ended && this._byteLength < this._hwm) {
      this._read();
      if (len === this._buffer.length) break;
    }
  }

  shift() {
    var pair = this._buffer.shift();
    this._byteLength -= pair.size;
    return pair.item;
  }
  get length() {
    return this._buffer.length;
  }
}

function createHWMReadStrategy(hwm=4096, countItem=defaultCountItem) {
  return (readFn) => {
    return new HWMReadStrategy(readFn, hwm, countItem);
  }
}

function defaultCountItem(xs) {
  return xs.length;
}
