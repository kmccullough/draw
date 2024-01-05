const fastify = require('fastify')({ logger: true });
const fastifyStatic = require('@fastify/static');
const path = require('node:path');

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

const port = 3000;

(async function() {
  try {
    await fastify.listen({ port });
    userConnections.init();
  } catch (err) {
    fastify.log.error(err);
    userConnections.destroy();
    process.exit(1)
  }
})();
