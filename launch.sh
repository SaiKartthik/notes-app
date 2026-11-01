#!/bin/bash
if [ "$1" = "kill" ]; then
    pkill -f "http.server 8080" && echo "Server stopped." || echo "No server running."
    exit 0
fi
cd "$(dirname "$0")"
nohup python3 -m http.server 8080 --bind 0.0.0.0 &>/dev/null &
echo "Server started at http://10.131.38.111:8080 (PID $!)"
