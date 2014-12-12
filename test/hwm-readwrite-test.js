import HWMReaderStrategy from "../lib/hwm-read-strategy.js";
import HWMWriterStrategy from "../lib/hwm-write-strategy.js";
import Readable from "../lib/readable.js";
import Writable from "../lib/writable.js";

var fs = require('fs');
var fd = fs.openSync(__filename, 'r');
var rs = new Readable(generate, HWMReaderStrategy(4096));
var ws = new Writable((chunk, ready) => {
  setTimeout(function() {
    process.stdout.write(chunk);
    ready();
  }, 1000);
}, null, HWMWriterStrategy(4096));
rs.pipeTo(ws).start();

function generate(enqueue, close) {
  var buf = new Buffer(64);
  fs.read(fd, buf, 0, 64, null, (err, bytesRead) => {
    if (err) return close(err);
    if (bytesRead) return enqueue(buf.slice(0, bytesRead));
    return close();
  });
}
