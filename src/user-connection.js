

const messages = new class {

  pos() {

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
    console.error(`connected ${this.connectionId}`);
    socket.send(JSON.stringify([ 'pos', 0, 0 ]));
  }

  reconnect(socket) {
    this.socket = socket;
    console.error(`reconnected ${this.connectionId}`);
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

}

module.exports = UserConnection;
