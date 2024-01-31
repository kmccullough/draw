const fastify = require('fastify')({ logger: true });
const fastifyStatic = require('@fastify/static');
const path = require('node:path');
const process = require('node:process');

let serverPort = 3002;
let webSocketPort = 3003;

const { argv } = process;
const argc = argv.length;
if (argc > 2) {
  for (let i = 2; i < argc; ++i) {
    switch (argv[i]) {
      case '-s':
        serverPort = argv[i + 1];
        i += 2;
        break;
      case '-ws':
        webSocketPort = argv[i + 1];
        i += 2;
        break;
    }
  }
}

const userConnections = require('./src/user-connections');

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/', // optional: default '/'
  constraints: {
    host: 'example.com'
  }, // optional: default {}
});
fastify.get('/', function (req, reply) {
  reply.sendFile('index.html');
});


(async function() {
  try {
    await fastify.listen({ port: serverPort });
    userConnections.init(webSocketPort);
  } catch (err) {
    fastify.log.error(err);
    userConnections.destroy();
    process.exit(1)
  }
})();
