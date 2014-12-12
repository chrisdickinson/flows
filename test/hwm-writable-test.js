import Readable from "../lib/readable.js";
import Writable from "../lib/writable.js";
import HWMWriterStrategy from "../lib/hwm-write-strategy.js";

var i = 0;
var rs = new Readable((queue, close) => {
  var len = 100 + i;
  for(; i < len; ++i)
    queue(new Buffer('' + i + ' 000000000000000000000 '));
  if (i > 1e6) close();
})

var ws = new Writable((chunk, ready) => {
  setTimeout(function() {
    console.log(chunk + '');
    ready();
  }, 100);
}, null, HWMWriterStrategy(128));

rs.pipeTo(ws).start();
