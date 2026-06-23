const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dashboard/analytics',
  method: 'GET',
  headers: {
    // Need a valid token. Let's not hit the API directly if we don't have a token.
  }
};
