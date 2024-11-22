function addskeet(skeet,cardcolour){
    //prepare a div with the skeet
    var skeetwrapped=$("<div class='card shadow my-2' style='background:"+cardcolour+";'><div class='card-body'>"+skeet+"</div></div>");
    skeetwrapped.hide().prependTo("#skeetstream").slideDown();

}

function renderskeet(m){
  //somehow convert a jetstream entry into something nicely formatted
  //turns out we need to make an aturl then get that post from bluesky
  //that comes with author details
  var aturl="at://"+m.did+"/"+m.commit.collection+"/"+m.commit.rkey;
  $.ajax({url:"https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris="+aturl}).done(function(data){
    //console.log(data);
    var post=data.posts[0];
    if(post){
      var labeled=post.labels.length;
      console.log(post.indexedAt) //show how far behind we are
      var skeet="<a target='_blank' class='link_secondary link-underline-opacity-0' href='https://bsky.app/profile/"+post.author.handle+"/post/"+m.commit.rkey+"'>";
      skeet=skeet+"<h5 class='card-title'>";
      skeet=skeet+"<img class='avatar' src="+post.author.avatar+"> ";
      if(post.author.displayName){
          skeet=skeet+"<span title='@"+post.author.handle+"'>"+post.author.displayName+"</span>";
      }else{
          skeet=skeet+"<span title='@"+post.author.handle+"'>@"+post.author.handle+"</span>";
      }
      skeet=skeet+"</h5></a>";
    //could process the facets and decorate the text with image embeds and clickable hashtags
    //wonder if clicking a hashtag should start streaming it?
      if(labeled){
          skeet=skeet+ "<p class='card-text text-danger bg-dark'>"+ post.labels[0].val.replace('\n','<br/>') +"</p>";
      }else{
          skeet=skeet+ "<p class='card-text'>"+ post.record.text.replace('\n','<br/>') +"</p>";
      }
      addskeet(skeet);
   }
  });
}

function opensocket(){
  var l=window.location;
  window.websocket = new WebSocket("wss://"+l.hostname+":8002/");
  websocket.addEventListener("message", ({data}) => {
        var m=JSON.parse(data);
        renderskeet(m);
  });
  websocket.onopen=function(){
    addskeet("Connection ready","lightblue");
    console.log("connection ready for data");
    window.tags.forEach(function(tag){
      addskeet("Resub to #"+tag,"lightblue");
      websocket.send(JSON.stringify({"subscribe":tag.trim().toLowerCase()}));
    });
  };
  websocket.onclose=function(){
    addskeet("Connection dropped, trying again soon","lightblue");
    console.log("connection dropped, should reconnect and send our subscription requests");
    window.websocket = null;
    setTimeout(opensocket, 5000);
  };
}

$(function(){
  opensocket();
  window.tags=[];
  $('#tag').on("change",function(e){
    var hashlesstag=$('#tag').val().replace('#','');
    //console.log("subscribing to "+hashlesstag);
    if (hashlesstag){
      addskeet("Streaming posts from #"+hashlesstag,"lightblue");
      window.tags.push(hashlesstag);
      websocket.send(JSON.stringify({"subscribe":hashlesstag.trim().toLowerCase()}));
    }
  });
});
