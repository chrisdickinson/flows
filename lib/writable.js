import { read, write, die, end } from "./symbols.js";
import createTopic from "./topic.js";

var sendStart = Symbol('send-start');
var sendError = Symbol('send-error');
var sendComplete = Symbol('send-complete');
var strategySym = Symbol('strategy');
const STATE_FLOWING = 0x01;
const STATE_ENDED = 0x02;
const STATE_ERRORED = 0x04;

class DefaultWriteStrategy {
  constructor(committer, finish, onerror, resume) {
    this._committer = committer;
    this._finish = finish;
    this._onerror = onerror;
    this._resume = resume;
  }

  write(item) {
    var digested = false;
    var sync = true;
    var called = 0;
    this._committer(item, (err) => {
      if (++called > 1) {
        err = new Error('called multiple times');
      }
      if (err) {
        return this._onerror(err);
      }
      if (!sync) {
        this._resume();
      } else {
        digested = true;
      }
    });
    sync = false;
    return digested;
  }

  end(err) {
    if (err) {
      this._onerror(err);
    }
    this._finish(err);
  }

  clear() {
  }
}

export default class Writable {
  constructor(committer=defaultCommitter, flush=defaultFlush, createWriteStrategy=createDefaultWriteStrategy) {
    committer = committer || defaultCommitter;
    flush = flush || defaultFlush;
    this._state = 0;
    [this[sendStart], this.onstart] = createTopic(this);
    [this[sendError], this.onerror] = createTopic(this);
    [this[sendComplete], this.oncomplete] = createTopic(this);

    this[sendStart] = makeSendStart(this, this[sendStart]);
    this[sendError] = makeSendError(this, this[sendError]);
    this[strategySym] = createWriteStrategy(committer, (err) => {
      flush(err, (closeError) => {
        if (closeError) {
          this[sendError](err);
        }
        this[sendComplete](closeError || err);
      })
    }, this[sendError], this[sendStart]);
  }

  start() {
    if (this._state) return;
    this._state |= STATE_FLOWING;
    this[sendStart]();
    return this;
  }

  [write](item) {
    // no longer flowing!
    if (this._state !== STATE_FLOWING) {
      throw new Error('write out of band');
    }
    this._state &= ~STATE_FLOWING;
    if (this[strategySym].write(item, this[sendStart])) {
      this._state |= STATE_FLOWING;
    }
    return this._state & STATE_FLOWING;
  }

  [end](err=null) {
    this._state = STATE_ENDED;
    this[strategySym].end(err);
  }
}

function makeSendStart(stream, send) {
  return function() {
    stream._state |= STATE_FLOWING;
    send();
  }
}

function makeSendError(stream, send) {
  return function(err) {
    stream._state |= STATE_ERRORED;
    send(err);
    setImmediate(() => {
      stream[strategySym].clear();
    });
  }
}

function defaultCommitter(item, ready) {
  ready();
}

function defaultFlush(err, ready) {
  ready();
}

function createDefaultWriteStrategy(committer, finish, onerror, resume) {
  return new DefaultWriteStrategy(committer, finish, onerror, resume);
}
