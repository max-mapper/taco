var nhost = require('./')

var host = nhost({
  dir: __dirname + '/deploys'
})


host.server.listen(8080) 