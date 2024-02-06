
class Emitter {

  listeners = {};

  on(event, fn) {
    (this.listeners[event] ??= []).push(fn);
    return this;
  }

  off(event, fn) {
    const listeners = this.listeners[event];
    const i = listeners?.indexOf(fn) ?? -1;
    if (i >= 0) {
      listeners.splice(i, 1);
      if (!listeners.length) {
        delete this.listeners[event];
      }
    }
    return this;
  }

  emit(event, ...args) {
    let updated = 0;
    for (const listener of this.listeners[event] ?? []) {
      ++updated;
      listener?.apply?.(this, args);
    }
    return updated;
  }

  clear() {
    this.listeners = {};
  }

}

module.exports = { Emitter };
