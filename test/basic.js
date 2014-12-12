import Readable from "../lib/readable.js";
import Writable from "../lib/writable.js";

var i = 0
var rs = new Readable((enqueue, close) => {
    var sent = i;
  enqueue(i);
  enqueue(i * 2);

  if (i++ > 10) {
    close(new Error('die'));
    console.log('close', sent);
  }
});

var ws = new Writable((item, ready) => {
  console.log(item);
  setTimeout(ready, 10);
}, (err, ready) => { console.log('got err?', err); ready() });

rs.pipeTo(ws)
  .start()
  .oncomplete.add(() => {
    console.log('um')
  })
  .onerror.add((err) => {
    console.log('ONERROR')
  })

function concat(cb) {
  var ws = new Writable((item, ready) => {
    this._items.push(item);
    ready();
  }, (err, ready) => {
    ready()
    cb(err, this._items);
  });
}

