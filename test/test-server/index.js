var http = require('http')
var hat = require('hat')
http.createServer(function(req, res) {
  res.end(
    JSON.stringify({ num: hat() })
  )
}).listen(8081)
