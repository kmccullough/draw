const { WebSocket } = require('ws');

const messages = new class {

  pos(x, y) {
    this.userConnections.sendFrom(this, 'pos', this.connectionId, x, y);
  }

  draw(drawing) {
    this.userConnections.sendFrom(this, 'draw', this.connectionId, drawing);
  }

};

class UserConnection {

  constructor(userConnections, connectionId, connectionKey) {
    this.userConnections = userConnections;
    this.connectionId = connectionId;
    this.connectionKey = connectionKey;
    this.messages = messages;
  }

  destroy() {

  }

  connect(socket) {
    this.socket = socket;
    console.log(`connected ${this.connectionId}`);
    this.send('pos', this.connectionId, 0, 0);
  }

  reconnect(socket) {
    this.socket = socket;
    console.log(`reconnected ${this.connectionId}`);
  }

  timeout() {
    this.socket = null;
    console.error(`timed-out connection ${this.connectionId}`);
  }

  disconnect() {
    this.socket = null;
    console.error(`disconnected ${this.connectionId}`);
  }

  error(error) {
    console.error(`error on ${this.connectionId}:`, error);
  }

  send(type, ...args) {
    this.socket.send(JSON.stringify([ type, ...args ]));
    return this;
  }

}

module.exports = UserConnection;
