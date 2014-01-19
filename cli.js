#!/usr/bin/env node
var taco = require('./')
var http = require('http')
var port = process.env.PORT || 8080

var opts = {
  dir: process.cwd(),
  host: process.argv[2] || 'test.local',
  nginx: {
    confDir: process.argv[3] || '/etc/nginx/conf.d/',
    conf: process.argv[4] || '/etc/nginx/nginx.conf',
    pidLocation: process.argv[5] || '/var/run/nginx.pid'
  }
}

var host = taco(opts, function ready(err) {
  http.createServer(host.handle.bind(host)).listen(port, function() {
    console.log('listening on', port)
  })
})
