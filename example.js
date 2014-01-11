var taco = require('./')

var nginxOpts = {
  confDir: '/usr/local/etc/nginx/conf.d/',
  pidLocation: '/var/run/nginx.pid'
}

var host = taco({
  dir: __dirname + '/example',
  nginx: nginxOpts,
  host: 'test.local'
})

host.server.listen(8080)