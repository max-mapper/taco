#!/usr/bin/env bash
set -e
echo "installing taco onto $1"
install-nginx-on-ubuntu $1
install-node-on-ubuntu $1
install-taco-on-ubuntu $1 $2
