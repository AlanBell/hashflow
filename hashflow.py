#!/usr/bin/env python

#this opens a websocket client connection to the bluesky jetstream and reads all messages
#it acts as a websocket server accepting many connections, these can send a message with a hashtag
#the server will forward all posts containing that hashtag to the connections who asked for it

import asyncio
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve
import json
streamers = {} #a collection of client connections
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

sendbuffer=set()
puritanical=True #filter out anything with a label and anything with tag nsfw

async def sendpost(post,connection):
    try:
        await connection.send(post)
    except:
        print ("send to user failed")

async def jetstream():
  #this is the client, it connects to Bluesky and reads every post flying by
  print("Connecting to the jetstream")
  try:
    async for websocket in connect("wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post"):
      try:
        while True:
            message = await websocket.recv()
            m=json.loads(message)
            tagset=set()
            spicy=False
            #examine the message to get a set of unique tags it contains
            #there are better/more pythonic ways to do this
            if 'commit' in m:
              if 'record' in m['commit']:
                if 'facets' in m['commit']['record']:
                  for f in m['commit']['record']['facets']:
                    if 'features' in f:
                      for tag in f['features']:
                        if tag['$type']=='app.bsky.richtext.facet#tag':
                          tagset.add(tag['tag'].lower())
                          if tag['tag'].lower() in ['nsfw','porn','onlyfans']:
                            spicy=True
                if 'labels' in m['commit']['record']:
                  spicy=True
            #now we want to send m to any clients that asked for a tag in the message.
            if len(tagset)>0 and not (puritanical and spicy):
                #print(tagset)
                #print(m)
                #streamers should be sockets grouped into hashtag sets
                sendto=set()
                #assemble a list of unique subscribers to send this to
                for tag in tagset:
                  if tag in streamers:
                     for sub in streamers[tag]:
                         print(sub.id.hex+f" Sending {tag}")
                         sendto.add(sub)
                for sub in sendto:
                  sendbuffer.add(asyncio.create_task(sendpost(message,sub)))
                  #we don't really need to send the whole thing if the clients hydrate from the aturl
                  #but for now, lets not be opinionated on how the clients deal with it, and just send raw jetstream records
      except Exception as e:
          print (e)
          print("Jetstream dropped, reconnecting")
          await asyncio.sleep(10) #lets give it a moment to come back online
          continue
  except Exception as e:
    print(e)
    print("didn't connect properly to the jetstream")
#this listens for incoming client connections
async def handler(websocket):
    print (websocket.id.hex+" Subscriber stream started")
    connected=True
    subscriptions=set()
    while connected:
        try:
            message = await websocket.recv()
            print(websocket.id.hex +" "+message) #this is the raw request
            m=json.loads(message)
            #we should have a format for sub/unsub requests, but for now keeping it simple
            subtag=m['subscribe']
            #first deal with any subscription request
            if subtag and subtag in streamers:
                streamers[subtag].add(websocket)
            elif subtag:
                streamers[subtag]={websocket}
            subscriptions.add(subtag)
            #then unsubscribe a tag if requested.
            #don't think we need to deal with multiple subscription requests in one message, they can send many requests

        except Exception as e:
            print(e)
            print(websocket.id.hex+" disconnected a streamer, unsub them from everything")
            for t in subscriptions:
                print(websocket.id.hex+f" unsub from {t}")
                streamers[t].remove(websocket)
            connected=False


async def hashstreamer():
    print("awaiting incomming connections")
    try:
       server=await serve(handler, "", 8001)
       await server.serve_forever()
    except Exception as e:
       print ("serving a client failed")
       print(e)

if __name__ == "__main__":
    loop.create_task(jetstream())
    loop.create_task(hashstreamer())
    loop.run_forever()
