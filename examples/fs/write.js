import Writable from "../../lib/writable.js";
import HWMWriterStrategy from "../../lib/hwm-write-strategy.js";

var fs = require('fs');

export default function createWriteStream(path=required('path'), opts, ready) {
  if (arguments.length === 2) {
    ready = opts;
    opts = {};
  }
  opts = opts || {};
  if (opts.fd) {
    return setImmediate(onready);
  }

  fs.open(path, opts.flags || 'w', opts.mode || 438, (err, fd) => {
    if (err) {
      return ready(err);
    }
    opts.fd = fd;
    onready();
  });

  function onready() {
    var stream;
    try {
      stream = new FSWriteStream(path, opts);
    } catch(err) {
      return ready(err);
    }
    ready(null, stream);
  }
}

class FSWriteStream extends Writable {
  constructor(path, {
    chunkSize=64 * 1024,
    fd=null,
  }) {
  
  }
}
