const path = require('node:path');
const process = require('node:process');

let port = 3001;

const { argv } = process;
const argc = argv.length;
if (argc > 2) {
  for (let i = 2; i < argc; ++i) {
    switch (argv[i]) {
      case '-s':
        port = argv[i + 1];
        i += 2;
        break;
    }
  }
}

const ipc = require('node-ipc');

ipc.config.id = 'draw.mu9GCXcXKDkXoV75';
ipc.config.stopRetrying = 0;
ipc.config.silent = true;

const maintenanceNoticeDelay = 5000;

let updateDelayed = 0;
ipc.serve(() => {
  ipc.server.on('update', (data, socket) => {
    if (updateDelayed === 0) {
      console.log('Server update requested. Sending maintenance notices.');
      console.log(`Update will commence in ${maintenanceNoticeDelay * 2} ms...`);
      // Notify clients that the server will soon be going down for maintenance
      userConnections.send('reboot', maintenanceNoticeDelay * 2);
      // Tell server to hit us back in some time...
      ipc.server.emit(socket, 'update', maintenanceNoticeDelay);
    } else if (updateDelayed === 1) {
      console.log(`Update will commence in ${maintenanceNoticeDelay} ms...`);
      // Notify tic-tac-toe clients that the server will SOON be going down for maintenance
      userConnections.send('reboot', maintenanceNoticeDelay);
      // Tell server to hit us back again, we're not ready...
      ipc.server.emit(socket, 'update', maintenanceNoticeDelay);
    } else {
      console.log(`Ready for update.`);
      // Respond to update server that we are ready for update
      ipc.server.emit(socket, 'update');
    }
    updateDelayed = (updateDelayed + 1) % 3;
  });
  ipc.server.on('disconnect', () => {
    updateDelayed = 0;
  });
});

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
    await fastify.listen({ port: port });
    userConnections.init(fastify.websocketServer);
    ipc.server.start();
  } catch (err) {
    fastify.log.error(err);
    userConnections.destroy();
    process.exit(1)
  }
})();
