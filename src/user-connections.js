const { UserConnection } = require('./user-connection');
const { Emitter } = require('./emitter');

function heartbeat() {
  this.isAlive = true;
}

function extractQueryParams(url) {
  const result = {};
  const params = url?.split('?')[1]?.split('&') || [];
  for (const param of params) {
    const [ key, value ] = param.split('=');
    result[key] = value;
  }
  return result;
}

class UserConnections {

  connections = {};
  connectionIds = [];
  connectionsBySocket = new WeakMap();
  socket;
  pingInterval;
  events = new Emitter;

  constructor() {
    this.init = this.init.bind(this);
    this.initConnection = this.initConnection.bind(this);
  }

  instance(...args) {
    return new UserConnections(...args);
  }

  init(webSocketServer, version) {
    const { connectionsBySocket } = this;
    this.socket = webSocketServer;
    this.version = version;
    this.pingInterval = setInterval(() => {
      for (const socket of webSocketServer.clients) {
        if (socket.isAlive === false) {
          connectionsBySocket.get(socket)?.disconnect();
          socket.terminate();
          return;
        }
        socket.isAlive = false;
        socket.ping();
      }
    }, 30000);
  }

  initConnection({ socket }, { url }) {
    const params = extractQueryParams(url);
    heartbeat.call(socket);
    socket.on('pong', heartbeat);
    this.handleMessages(socket, params);
  }

  close(userConnection) {

  }

  handleMessages(socket, params) {
    let { version, id: connId, key: connKey } = params;
    const userConnections = this;
    const { connectionIds, connections } = userConnections;

    if (version !== this.version) {
      socket.send(JSON.stringify([ 'reload' ]));
    }

    let connection = connId && connKey
      && connections[connId]?.connectionKey === connKey && connections[connId];

    if (!connection) {
      connId ||= 1;
      for (; connectionIds.includes(connId); ++connId);
      connectionIds.push(socket.id = connId);
      connKey = Math.ceil(Math.random() * 0xffffffff);
    }

    socket.send(JSON.stringify([ '$connect', connId, connKey ]));

    if (connection) {
      connection.reconnect(socket);
    } else {
      connection = connections[connId] = new UserConnection(this, connId, connKey);
      this.events.emit('connection', connection);
      connection.connect(socket);
    }

    const { messages } = connection;

    socket.on('error', error => {
      try {
        connection.error(error);
      } catch (e) {
        console.error(`error processing error on ${connId}`);
      }
    });

    socket.on('close', () => {
      try {
        const index = this.connectionIds.findIndex(id => id === connId);
        this.connectionIds.splice(index, 1);
        delete this.connections[connId];
        connection.disconnect();
      } catch (e) {
        console.error(`error processing disconnect on ${connId}`);
      }
    });

    socket.on('message', data => {
      if (!(data = userConnections.getMessageData(data, connId))) {
        return;
      }
      const [ type, ...args ] = data;
      if (!type || !messages[type]) {
        console.error(`received from ${connId} unknown message type: ${type}`);
        return;
      }
      try {
        messages[type].apply(connection, args);
      } catch (e) {
        console.error(`error processing message of type ${type} from ${connId}`, e);
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
    this.events.clear();
    return this.forEach(c => c.destroy());
  }

  forEach(callback) {
    const { connections, connectionIds } = this;
    const { length } = connectionIds;
    for (let i = 0; i < length; ++i) {
      callback(connections[connectionIds[i]], i, this);
    }
    return this;
  }

  send(type, ...args) {
    return this.sendFrom(null, type, ...args);
  }

  sendFrom(userConnection, type, ...args) {
    return this.forEach(c => c !== userConnection && c.send(type, ...args));
  }

}

module.exports = new UserConnections;
