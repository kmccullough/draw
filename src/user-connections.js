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
  socketServer;
  pingInterval;

  instance(...args) {
    return new UserConnections(...args);
  }

  init() {
    const userConnections = this;
    const { connectionsBySocket } = this;
    const socketServer = this.socketServer = new WebSocketServer({ port: 8080 });
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
        connectionId = 1;
        for (; connectionIds.includes(connectionId); ++connectionId);
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
      if (!(data = userConnections.getMessageData(data))) {
        return;
      }
      const [ type, ...args ] = data;
      if (!type || messages[type]) {
        console.error(`received from ${connectionId} unknown message type: ${type}`);
        return;
      }
      try {
        messages[type].apply(this, args);
      } catch (e) {
        console.error(`error processing message of type ${type} from ${connectionId}`);
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
    console.log(`received from ${connectionId}:`, data);
    return data;
  }

  destroy() {
    clearInterval(this.pingInterval);
  }

}

module.exports = new UserConnections;
