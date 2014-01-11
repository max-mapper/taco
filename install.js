#!/usr/bin/env node

var spawn = require('child_process').spawn
var script = require('./')
var fs = require('fs')
var path = require('path')
var server = process.argv[2]

if (!server) return console.error('Usage: install-taco-on-ubuntu user@server')

var hostOverrides = ['-o', 'UserKnownHostsFile=/dev/null', '-o', 'StrictHostKeyChecking=no']

installMongroup(function(code) {
  if (code) return console.error('Mongroup install returned error code', code)
  console.log('Mongroup is installed')
  installConf(function(code) {
    if (code) return console.error('Mongroup upstart conf install returned error code', code)
  })
})

function installMongroup(cb) {
  console.log('Installing mongroup...')
  var ssh = spawn('ssh', hostOverrides.concat(server))

  ssh.stdout.pipe(process.stdout)
  ssh.stderr.pipe(process.stderr)

  ssh.on('exit', function(code, signal) {
    if (cb) cb(code)
  })

  var scriptStream = fs.createReadStream(path.join(__dirname, 'install.sh'))
  scriptStream.pipe(ssh.stdin)
}

function installConf(cb) {
  console.log('Writing mongroup.conf for upstart...')
  var conf = path.join(__dirname, 'mongroup.conf')
  var remotePath = '/root/mongroup.conf'
  var scp = spawn('scp', hostOverrides.concat([conf, server + ':' + remotePath]))

  scp.stdout.pipe(process.stdout)
  scp.stderr.pipe(process.stderr)

  scp.on('exit', function(code, signal) {
    console.log('Wrote mongroup.conf', {code: code, signal: signal})
    if (cb) cb(code)
  })
}
