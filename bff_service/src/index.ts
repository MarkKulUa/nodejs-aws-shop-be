import { getConfig } from './config.js';
import { createServer } from './server.js';

const { port } = getConfig();

const server = createServer();

server.listen(port, () => {
  console.log(`BFF Service is running on port ${port}`);
});
