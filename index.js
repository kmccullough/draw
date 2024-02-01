const path = require('node:path');
const process = require('node:process');

let serverPort = 3001;
// let webSocketPort = 3002;

const { argv } = process;
const argc = argv.length;
if (argc > 2) {
  for (let i = 2; i < argc; ++i) {
    switch (argv[i]) {
      case '-s':
        serverPort = argv[i + 1];
        i += 2;
        break;
      // case '-ws':
      //   webSocketPort = argv[i + 1];
      //   i += 2;
      //   break;
    }
  }
}

const userConnections = require('./src/user-connections');

const fastify = require('fastify')({ logger: true });
fastify.register(require('@fastify/websocket'), {
  handle(conn, req) {
    conn.pipe(conn); // creates an echo server
  },
  options: {
    maxPayload: 1048576,
  },
})
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/public/', // optional: default '/'
  constraints: {
    host: 'example.com'
  }, // optional: default {}
});

let webSocketServer;
// const { WebSocketServer } = require('ws');
// webSocketServer.on('connection', this.initConnection);
// webSocketServer = new WebSocketServer({ port: webSocketPort });
const initConnection = ({ socket }) => userConnections.initConnection(socket);

fastify.register(async function () {
  fastify.route({
    method: 'GET',
    url: '/',
    handler: (req, reply) => reply.sendFile('index.html'),
    wsHandler: initConnection,
  })
});

(async function() {
  try {
    await fastify.listen({ port: serverPort });
    userConnections.init(webSocketServer = fastify.websocketServer);
  } catch (err) {
    fastify.log.error(err);
    userConnections.destroy();
    process.exit(1)
  }
})();
