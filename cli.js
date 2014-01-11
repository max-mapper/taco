#!/usr/bin/env node
var taco = require('./')

var nginxOpts = {
  confDir: '/usr/local/etc/nginx/conf.d/',
  pidLocation: '/var/run/nginx.pid'
}

var host = taco({
  dir: process.cwd(),
  nginx: nginxOpts,
  host: process.argv[2] || 'test.local'
})

host.server.listen(8080)
