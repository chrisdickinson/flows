# flows

This is an experiment in creating stripped-down-to-basics streams. 
They have the following properties:

* readable streams may be piped to a writable stream.
* writable streams may call "start()" to begin consuming data from the stream.
* both readable and writable streams may accept a "strategy" for buffering data and applying backpressure.
* backpressure is applied from writables to readables on `.write`.

They lack the following features:

* readers cannot pipe to multiple writers.
* there are no public `.read`, `.write`, or `.end` methods.
* they are not event emitters.
* there is no public `.pause` or `.resume` method.
* once piped, a readable may never be unpiped and redirected.
* they have no concept of "objectMode" or not -- every value is "in-alphabet," so to speak.
* there are no implicit mechanisms to start flowing the stream (i.e., `pipe`, `on('data')`, `on('readable')` do not exist / start the flow of the stream)

It's likely best to take a look at some [examples](/examples). To run test code, use `node run.js path/to/file.js`.

# API

## Readable(producer, strategy)

```javascript
var rs = new Readable(function producer(queue, end) {
  queue('some data');
  queue({some: 'object'})
  end()           // <-- "never call `producer` again, and close piped streams once finished"
  end(new Error)  // <-- "never call `producer` again, and close piped streams immediately with error"
})
```

#### readable.pipeTo(writable) → writable

Sets `writable` up to listen to `readable`'s data. **Does not** start the flow of data.

#### readable.pipeThrough({writable, readable}) → readable

## Writable(committer, flusher, strategy)

```javascript
var ws = new Writable(function committer(chunk, ready) {
  if (operationCausesError) {
    return ready(new Error());
  }
  ready(); // chunk was flushed to underlying resource!
}, function flusher(err, ready) {
  ready();
})
```

#### writer.start() → writer

Starts the flow of data from any upstream readable.
