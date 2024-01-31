const { WebSocketServer } = require('ws');
const UserConnection = require('./user-connection');

function heartbeat() {
  this.isAlive = true;
}

const newConnection = 'new connection';

class UserConnections {

  connections = {};
  connectionIds = [];
  connectionsBySocket = new WeakMap();
  socket;
  pingInterval;

  instance(...args) {
    return new UserConnections(...args);
  }

  init(port = 8080) {
    const userConnections = this;
    const { connectionsBySocket } = this;
    const socketServer = this.socket = new WebSocketServer({ port });
    this.pingInterval = setInterval(() => {
      for (const socket of socketServer.clients) {
        if (socket.isAlive === false) {
          connectionsBySocket.get(socket)?.disconnect();
          socket.terminate();
          return;
        }
        socket.isAlive = false;
        socket.ping();
      }
    }, 30000);
    socketServer.on('connection', function connection(socket) {
      heartbeat.call(socket);
      socket.on('pong', heartbeat);
      userConnections.handleConnections(socket);
    });
  }

  close(userConnection) {

  }

  handleConnections(socket) {
    const userConnections = this;
    const { connectionIds, connections } = userConnections;
    function connectionClose() {
      console.error(`disconnected ${newConnection}`);
    }
    function connectionError() {
      console.error(`error on ${newConnection}`);
    }
    function connectionMessage(data) {
      if (!(data = userConnections.getMessageData(data))) {
        return;
      }
      let [ type, connectionId, connectionKey ] = data;
      if (type !== '$connect') {
        console.error(`received from ${newConnection} non-connect message type: ${type}`);
        return;
      }
      socket.off('close', connectionClose);
      socket.off('error', connectionError);
      socket.off('message', connectionMessage);
      let connection = connections[connectionId];
      if (connection) {
        if (connection.connectionKey === connectionKey) {
          connection.reconnect(socket);
        } else {
          console.error(`received from ${connectionId} incorrect connectionKey: ${connectionKey}, expected: ${connection.connectionKey}`);
          connection = null;
        }
      }
      if (!connection) {
        if (!connectionId) {
          connectionId = 1;
          for (; connectionIds.includes(connectionId); ++connectionId);
        }
        connectionIds.push(socket.id = connectionId);
        connectionKey = Math.ceil(Math.random() * 0xffffffff);
      }
      socket.send(JSON.stringify([ '$connect', connectionId, connectionKey ]));
      if (!connection) {
        connection = connections[connectionId]
          = new UserConnection(userConnections, connectionId, connectionKey);
        connection.connect(socket);
      }
      userConnections.handleMessages(connection);
    }
    socket.on('close', connectionClose);
    socket.on('error', connectionError);
    socket.on('message', connectionMessage);
  }

  handleMessages(userConnection) {
    const userConnections = this;
    const { connectionId, messages, socket } = userConnection;
    socket.on('close', () => {
      try {
        this.connectionIds.splice(this.connectionIds.findIndex(id => id === connectionId), 1);
        delete this.connections[connectionId];
        userConnection.disconnect();
      } catch (e) {
        console.error(`error processing disconnect on ${connectionId}`);
      }
    });
    socket.on('error', error => {
      try {
        userConnection.error(error);
      } catch (e) {
        console.error(`error processing error on ${connectionId}`);
      }
    });
    socket.on('message', data => {
      if (!(data = userConnections.getMessageData(data, connectionId))) {
        return;
      }
      const [ type, ...args ] = data;
      if (!type || !messages[type]) {
        console.error(`received from ${connectionId} unknown message type: ${type}`);
        return;
      }
      try {
        messages[type].apply(userConnection, args);
      } catch (e) {
        console.error(`error processing message of type ${type} from ${connectionId}`, e);
      }
    });
  }

  getMessageData(data, connectionId = null) {
    const isNew = !connectionId;
    connectionId ||= 'new connection';
    try {
      data = JSON.parse(data);
    } catch (e) {
      data = null;
      return;
    }
    if (!Array.isArray(data)) {
      console.error(`received from ${connectionId} bad ${isNew ? 'connection ' : ''}data`);
      return;
    }
    return data;
  }

  destroy() {
    clearInterval(this.pingInterval);
  }

  send(type, ...args) {
    return this.sendFrom(null, type, ...args);
  }

  sendFrom(userConnection, type, ...args) {
    const { connections } = this;
    for (const connectionId of this.connectionIds) {
      const connection = connections[connectionId];
      if (connection !== userConnection) {
        connection.send(type, ...args);
      }
    }
    return this;
  }

}

module.exports = new UserConnections;
