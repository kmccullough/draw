
const messages = new class {

  pos(x, y) {
    this.userConnections.sendFrom(this, 'pos', this.connectionId, x, y);
  }

  draw(vertex) {
    const { drawings } = this.state;
    if (!drawings.length || drawings[drawings.length - 1].length > 1000) {
      drawings[drawings.length] = [];
    }
    if (drawings.length > 2) {
      // TODO Update clients with deleted drawing
      drawings.splice(0, 1);
    }
    const drawing = drawings[drawings.length - 1];
    drawing.push(...vertex);
    this.userConnections.sendFrom(this, 'draw', this.connectionId, vertex);
  }

};

class UserConnection {

  state;

  constructor(userConnections, connectionId, connectionKey) {
    this.userConnections = userConnections;
    this.connectionId = connectionId;
    this.connectionKey = connectionKey;
    this.messages = messages;
  }

  destroy() {
    if (this.state) {
      this.state.destroy?.();
      this.state = null;
    }
  }

  connect(socket) {
    this.socket = socket;
    console.log(`connected ${this.connectionId}`);
    this.sendDrawings();
    this.send('pos', this.connectionId, 0, 0);
  }

  sendDrawings() {
    const drawings = [];
    // TODO On new server instance, notify old clients to delete old drawings
    this.userConnections.forEach(c => {
      drawings.push([ c.connectionId, c.state.drawings ]);
    })
    this.send('drawings', drawings);
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

  setState(state) {
    this.state = state;
  }

}

module.exports = { UserConnection };
