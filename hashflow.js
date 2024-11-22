const encoder = new TextEncoder();
const decoder = new TextDecoder();
function byteindex(string,i) {
     //we have a byte offset into a utf16 string
     //convert it to bytes, slice it, convert it back to utf16 and see how long it is.
     //that is our utf16 slicing point. It won't split characters because we are looking for facet boundaries
     var j=decoder.decode(encoder.encode(string).slice(0,i)).length
    return j;
  }


function addskeet(skeet,cardcolour){
    //prepare a div with the skeet
    var skeetwrapped=$("<div class='card shadow my-2' style='background:"+cardcolour+";'><div class='card-body'>"+skeet+"</div></div>");
    skeetwrapped.hide().prependTo("#skeetstream").slideDown();

}
function sendsub(tag){
  if(tag){
      tag=tag.trim().toLowerCase();
      window.tags.add(tag);
      websocket.send(JSON.stringify({"subscribe":tag}));
      addskeet("Streaming posts from #"+tag,"lightblue");
      window.location.hash=Array.from(window.tags).join(",");
  }
}


function decorate(skeet,facets){
     //apparently we may run into some utf16 to utf8 issues in edge cases
     var decorated='';
     var cursor=0;
     //we trust the facets are in ascending bytestart order 
     facets.forEach(function(facet){
         if(facet.features[0].$type=='app.bsky.richtext.facet#tag'){
            var tag=facet.features[0].tag;
            var start=facet.index.byteStart;
            decorated=decorated+skeet.slice(byteindex(skeet,cursor),byteindex(skeet,start));
            decorated=decorated+"<b class='hashtag' data-hashtag='"+tag+"'>#"+tag+"</b>";
            cursor=facet.index.byteEnd;
         }
     });
     decorated=decorated+skeet.slice(byteindex(skeet,cursor));
     return decorated;
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
      //console.log(post.indexedAt) //show how far behind we are
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
      var decorated=decorate(post.record.text,post.record.facets)
      if(labeled){
          skeet=skeet+ "<p class='card-text text-danger bg-dark'>"+ post.labels[0].val.replace('\n','<br/>') +"</p>";
      }else{
          skeet=skeet+ "<p class='card-text'>"+ decorated +"</p>";
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
      //addskeet("Asking for #"+tag,"lightblue");
      sendsub(tag);
    });
  };
  websocket.onclose=function(){
    addskeet("Connection dropped, trying again soon","lightblue");
    //console.log("connection dropped, should reconnect and send our subscription requests");
    window.websocket = null;
    setTimeout(opensocket, 5000);
  };
}


$(function(){
  window.tags=new Set(window.location.hash.replace('#','').split(','));
  opensocket();
  $('#tag').on("change",function(e){
    var hashlesstag=$('#tag').val().replace('#','');
    //console.log("subscribing to "+hashlesstag);
    sendsub(hashlesstag);
  });
});

document.addEventListener("click", function(e){
  const target = e.target.closest("b.hashtag"); // Or any other selector.
  if(target){
    sendsub($(target).data("hashtag"));
  }
});
