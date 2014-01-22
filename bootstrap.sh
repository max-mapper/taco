#!/usr/bin/env bash
set -e
echo "installing taco as $1 onto $2"
install-nginx-on-ubuntu root@$2
install-node-on-ubuntu root@$2
wget -qO- https://gist.github.com/maxogden/8551202/raw/3de4f5b818da41df8a40f41f89166a2af98f4da1/initial.sh | ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no root@$2
install-taco-on-ubuntu $1 $2
