Hashflow consists of a python script that connects to the bluesky jetstream over a websocket client connection. 
It then acts as a websocket server and accepts connections from clients wanting a filtered stream.
Clients can request one or more hashtags, the process then hands out posts to them that meet their requirements.
The server should be running somewhere with plenty of bandwidth as it will be consuming a fairly fast stream of all Bluesky posts
Clients have dramatically less bandwidth requirement and will receive posts they are interested in very quickly.
