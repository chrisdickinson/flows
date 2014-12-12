class Topic {
  constructor() {
    this._listeners = new Set;
  }
  add(fn) {
    this._listeners.add(fn);
  }
  remove(fn) {
    this._listeners.delete(fn);
  }
  send(...args) {
    for (var listener of this._listeners) {
      listener(...args);
    }
  }
}

export default function createTopic(src) {
  var topic = new Topic
  return [(...args) => {
    topic.send(...args)
  }, {
    add(fn) {
      topic.add(fn);
      return src;
    },
    remove(fn) {
      topic.remove(fn);
      return src;
    }
  }]
}
