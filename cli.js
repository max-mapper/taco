#!/usr/bin/env node
var taco = require('./')
var http = require('http')

var nginxOpts = {
  confDir: '/etc/nginx/conf.d/',
  pidLocation: '/var/run/nginx.pid'
}

var host = taco({
  dir: process.cwd(),
  nginx: nginxOpts,
  host: process.argv[2] || 'test.local'
}, function ready(err) {
  http.createServer(host.handle).listen(process.env.PORT || 8080)
})
