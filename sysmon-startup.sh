#!/bin/sh
source ./.env.ping
sudo nohup node distm/main.js p $LOCAL_PING_ADDR_1 -i 0.5 &
disown
sudo nohup node dist/main.js p $GLOBAL_PING_ADDR_1 -i 0.5 &
disown
sudo nohup node dist/main.js p $GLOBAL_PING_ADDR_2 -i 0.5 &
disown