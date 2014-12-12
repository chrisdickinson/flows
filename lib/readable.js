import { read, write, die, end } from "./symbols.js";
import createTopic from "./topic.js";

// 0000 0abc
// a = flowing / waiting
// b = open / ended
// c = ok / error
const STATE_ENDED = 0x01;
const STATE_ERRORED = 0x02;
const STATE_PIPED = 0x04;

var enqueueSym = Symbol('enqueue')
var closeSym = Symbol('close')
var sendReadableSym = Symbol('send-readable');
var sendErrorSym = Symbol('send-error');
var bufferStrategySym = Symbol('buffer-strategy');

class DefaultStrategy {
  constructor(readFn) {
    this._buffer = [];
  }

  push(item) {
    this._buffer.push(item);
    return true;
  }

  clear() {
    this._buffer.length = 0;
  }

  shift() {
    return this._buffer.shift();
  }

  get length() {
    return this._buffer.length;
  }
}

// strategies are the way to go because we need access to `pump` to see how much
// data we're emitting
export default class Readable {
  constructor(generator, createStrategy=createDefaultStrategy) {
    this._state = 0;  // not flowing, not ended, not errored

    this[enqueueSym] = makeEnqueue(this);
    this[closeSym] = makeClose(this);
    this[read] = () => {
      generator(this[enqueueSym], this[closeSym])
    };

    var strategy = createStrategy(this[read]);
    this[bufferStrategySym] = strategy;
    [this[sendReadableSym], this.onreadable] = createTopic(this);
    [this[sendErrorSym], this.onerror] = createTopic(this);
    this[sendReadableSym] = makeSendReadable(this[sendReadableSym]);
  }

  pipeTo(writable) {
    if (this._state) throw new Error('cannot pipe while stream is whatever.');
    pipeTo(this, writable);
    return writable;
  }

  pipeThrough(pair) {
    pipeTo(this. pair.writable);
    return pair.readable;
  }
}

function makeEnqueue(src) {
  return (item) => {
    if (src[bufferStrategySym].push(item)) {
      src[sendReadableSym]();
    }
  }
}

function makeSendReadable(sendReadable) {
  var scheduled = false;
  return () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    process.nextTick(() => {
      scheduled = false;
      sendReadable();
    });
  }
}

function makeClose(src) {
  return (err) => {
    src._state |= STATE_ENDED;
    if (err) {
      src._state |= STATE_ERRORED;
      src[bufferStrategySym].clear();
      src[sendErrorSym](err);
    } else {
      src[bufferStrategySym].setEOF();
      src[sendReadableSym]();
    }
  }
}

function pipeTo(src, dst) {
  var needRead = true;
  var pumping = false;

  src._state &= STATE_PIPED;
  dst.onstart.add(onstart);
  src.onreadable.add(onreadable);
  src.onerror.add(onsrcerror);
  dst.onerror.add(ondsterror);

  function onstart() {
    if (!pumping) {
      pumping = true;
      needRead = pump(src, dst);
      pumping = false;
    }
  }

  function onreadable() {
    if (needRead) {
      onstart();
    }
  }

  function onsrcerror(err) {
    cleanup();
    dst[end](err);
  }

  function ondsterror(err) {
    cleanup();
    src[sendErrorSym](err);
  }

  function cleanup() {
    src.onreadable.remove(onreadable);
    dst.onstart.remove(onstart);
    src.onerror.remove(onsrcerror);
    dst.onerror.remove(ondsterror);
  }
}

function pump(src, dst) {
  do {
    // exhaust buffered items
    while (src[bufferStrategySym].length) {
      if (!dst[write](src[bufferStrategySym].shift())) {
        return false;
      }
    }
    if (!src._state) src[read]();
  } while(src[bufferStrategySym].length);

  if (src._state & STATE_ENDED) {
    dst[end]();
    return false;
  }

  return true;
}

function createDefaultStrategy(readFn) {
  return new DefaultStrategy(readFn);
}
