var taco = require('./')
var http = require('http')

var nginxOpts = {
  confDir: '/usr/local/etc/nginx/conf.d/',
  pidLocation: '/var/run/nginx.pid'
}

var host = taco({
  dir: __dirname + '/example',
  nginx: nginxOpts,
  host: 'test.local'
}, function ready(err) {
  http.createServer(host.handle.bind(host)).listen(process.env.PORT || 8080)
})

host.server.listen(8080)
