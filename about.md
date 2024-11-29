# Hashflow
## _Bluesky Hashtags on stream_

Hashflow is a way to passively watch activity on the Bluesky social network organised by hashtags. You can type any hashtag (with or without the #) into the box at the top, hit enter and you will start to see posts turn up. It won't go back and find existing posts, it just shows you new ones as fast as possible. Try following some fast moving tags like #bluesky to get going with it. The URL is bookmarkable and has a comma separated list of the tags you are following, e.g.
    https://hashflow.apertum.ie/#bluesky,photography,nature
You can click on hashtags in posts to subscribe to more posts mentioning that tag.

## How it works
The server connects to the Bluesky jetstream and watches every post get created. When your browser connects it provides the server with a list of hashtags you are interested in. When the server sees a post you have asked for it passes on the details.
