#!/usr/bin/env node

var child = require('child_process')
var spawn = child.spawn
var script = require('./')
var fs = require('fs')
var path = require('path')
var user = process.argv[2]
var vhost = process.argv[3]

if (!user || !vhost) return console.error('Usage: install-taco-on-ubuntu user server')

var host = user + '@' + vhost
var hostOverrides = ['-o', 'UserKnownHostsFile=/dev/null', '-o', 'StrictHostKeyChecking=no']

installTacoConf(function(code) {
  if (code) return console.error('Taco nginx conf install returned error code', code)
  installMongroupConf(function(code) {
    if (code) return console.error('Mongroup upstart conf install returned error code', code)
    installMongroup(function(code) {
      if (code) return console.error('Mongroup install returned error code', code)
      console.log('Mongroup is installed')
    })
  })
})

function installMongroup(cb) {
  console.log('Installing mongroup...')
  
  var ssh = spawn('ssh', hostOverrides.concat(host))

  ssh.stdout.pipe(process.stdout)
  ssh.stderr.pipe(process.stderr)

  ssh.on('exit', function(code, signal) {
    if (cb) cb(code)
  })

  ssh.stdin.write('export USERNAME=' + user + '\n')
  ssh.stdin.write('export VHOST=' + vhost + '\n')
  var scriptStream = fs.createReadStream(path.join(__dirname, 'install.sh'))
  scriptStream.pipe(ssh.stdin)
}

function installMongroupConf(cb) {
  console.log('Writing mongroup.conf for upstart...')
  var conf = fs.readFileSync(path.join(__dirname, 'mongroup.conf')).toString()
  var remotePath = '/etc/init/mongroup.conf'
  var env = ['USER=' + user, 'USER_HOME=' + (user === 'root' ? '/root' : '/home/' + user)]
  var echo = ['echo', '"' + conf + '"', '|']
  var args = hostOverrides.concat([host, '"sudo tee ' + remotePath + '"'])
  var cmd = env.concat('&&').concat(echo).concat('ssh').concat(args).join(' ')

  child.exec(cmd, function(err, stdo, stde) {
    console.log('writing mongroup.conf done', {err: err})
    if (cb) cb()
  })
}

function installTacoConf(cb) {
  console.log('Writing taco.conf for nginx...')
  var conf = fs.readFileSync(path.join(__dirname, 'taco.conf')).toString().replace('VHOST', 'taco.' + vhost)
  var remotePath = '/etc/nginx/conf.d/taco.conf'
  var echo = ['echo', "'" + conf + "'", '|', 'ssh']
  var args = hostOverrides.concat([host, "'sudo tee " + remotePath + "'"])
  var cmd = echo.concat(args).join(' ')
  child.exec(cmd, function(err, stdo, stde) {
    process.stderr.write(stde)
    console.log('Wrote taco.conf', {err: err})
    if (cb) cb()
  })
}
