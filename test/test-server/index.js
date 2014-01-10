var http = require('http')
var hat = require('hat')
var port = process.env['PORT'] || 8081
http.createServer(function(req, res) {
  res.end(
    JSON.stringify({ num: hat() })
  )
}).listen(port, function(e) {
  console.log('listening on', port, e)
})
