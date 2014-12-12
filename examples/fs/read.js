import Readable from "../../lib/readable.js";
import HWMReaderStrategy from "../../lib/hwm-read-strategy.js";

var fs = require('fs');

export default function createReadStream(path=required('path'), opts, ready) {
  if (arguments.length === 2) {
    ready = opts;
    opts = {};
  }
  opts = opts || {};
  if (opts.fd) {
    return setImmediate(onready);
  }

  fs.open(path, opts.flags || 'r', opts.mode || 438, (err, fd) => {
    if (err) {
      return ready(err);
    }
    opts.fd = fd;
    onready();
  })

  function onready() {
    var stream;
    try {
      stream = new FSReadStream(path, opts);
    } catch(err) {
      return ready(err);
    }
    ready(null, stream);
  }
}

class FSReadStream extends Readable {
  constructor(path, {
    chunkSize=64 * 1024,
    fd=null,
    start=null,
    end=null,
    autoClose=true
  } = {}) {
    this.path = path;
    this.fd = fd;
    this.start = start;
    this.end = end;
    this.autoClose = autoClose;
    super((enqueue, close) => {
      doRead(this, enqueue, (err) => {
        doClose(this, (closeErr) => {
          close(err || closeErr);
        });
      }, chunkSize);
    }, HWMReaderStrategy(chunkSize));
  }
}

function doRead(stream, enqueue, close, chunkSize) {
  var buf = new Buffer(chunkSize);
  var start = stream.start ? stream.start : null;
  if (start) {
    stream.start = null;
  }
  fs.read(stream.fd, buf, 0, chunkSize, start, (err, bytesRead, buf) => {
    if (err) {
      return close(err);
    }
    if (!bytesRead) {
      return close();
    }
    enqueue(bytesRead === chunkSize ? buf : buf.slice(0, bytesRead));
  });
}

function doClose(stream, ready) {
  fs.close(stream.fd, ready);
}

function required(param) {
  throw new Error(`${param} is a required parameter.`);
}
