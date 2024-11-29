const encoder = new TextEncoder();
const decoder = new TextDecoder();
function byteindex(string,i) {
     //we have a byte offset into a utf16 string
     //convert it to bytes, slice it, convert it back to utf16 and see how long it is.
     //that is our utf16 slicing point. It won't split characters because we are looking for facet boundaries
     var j=decoder.decode(encoder.encode(string).slice(0,i)).length
    return j;
  }


function addskeet(skeet,cardcolour,timeout=5000){
    //prepare a div with the skeet
    var skeetwrapped=$("<div class='card shadow my-2' style='background:"+cardcolour+";'><div class='card-body'>"+skeet+"</div></div>");
    skeetwrapped.hide().prependTo("#skeetstream").slideDown();
    setTimeout(function(sw){
      sw.slideUp(500,function(){sw.remove()});
    },timeout,skeetwrapped);
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
     var decorated='';
     var cursor=0;
     //we trust the facets will be processed in ascending bytestart order which seems to work
     facets.forEach(function(facet){
         //work out the start and end of the facet, and the previous cursor position in terms of sliceable positions
         var start=byteindex(skeet,facet.index.byteStart)
         var end=byteindex(skeet,facet.index.byteEnd);
         var stringcursor=byteindex(skeet,cursor);
         //process facets we recognise
         if(facet.features[0].$type=='app.bsky.richtext.facet#tag'){
            var tag=facet.features[0].tag;
            decorated=decorated+skeet.slice(stringcursor,start);
            decorated=decorated+"<strong class='hashtag' data-hashtag='"+tag+"'>#"+tag+"</strong>";
            cursor=facet.index.byteEnd;
         }else if(facet.features[0].$type=='app.bsky.richtext.facet#link'){
            var uri=facet.features[0].uri;
            decorated=decorated+skeet.slice(stringcursor,start);
            decorated=decorated+"<a href='"+uri+"'>"+skeet.slice(start,end)+"</a>";
            cursor=facet.index.byteEnd;
         }else if(facet.features[0].$type=='app.bsky.richtext.facet#mention'){
            var did=facet.features[0].did;
            decorated=decorated+skeet.slice(stringcursor,start);
            decorated=decorated+"<i>"+skeet.slice(start,end)+"</i>"; //maybe link to the profile?
            cursor=facet.index.byteEnd;
         }else{
            //console.log("Unprocessed facet " +facet.features[0].$type);
         }
         //if we don't recognise the facet don't move the cursor on.
     });
     //add on the end of the skeet after the last facet if there was one
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
      if (post.embed){
         //there is one embed object, if it is type images
         if (post.embed.$type=="app.bsky.embed.images#view"){
             post.embed.images.forEach(function(image){
               skeet=skeet+"<img class='attachedimage thumbnail' src='"+image.thumb+"'  alt='"+image.alt+"'>";
//skeet=skeet+"<figure><figcaption>"+image.alt+"</figcaption><img height='200px' src='"+image.thumb+"'></figure>";


             });
         }else if(post.embed.$type=="app.bsky.embed.record#view"){
                //this is a quoted post, they normally have some text, we could try harder.
                //probably don't want to do this recursively and follow a massive quote thread.
		skeet=skeet+"<hr>"+post.embed.record.value.text;
         }else{
             //console.log(post.embed);
//             skeet=skeet+"<hr>Can't render "+post.embed.$type;
         }
      }
      addskeet(skeet,'white',3600000); //skeets last for an hour. Might make this something user selected
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
  if(window.location.hash){
    window.tags=new Set(window.location.hash.replace('#','').split(','));
  }else{
    window.tags=new Set();
  }
  opensocket();
  $('#tag').on("change",function(e){
    var hashlesstag=$('#tag').val().replace('#','');
    sendsub(hashlesstag);
    $('#tag').val('');
  });

  document.addEventListener("click", function(e){
    const tag = e.target.closest(".hashtag"); // Or any other selector.
    if(tag){
      sendsub($(tag).data("hashtag"));
    }
    const image=e.target.closest(".attachedimage");
    if(image){
      $(image).toggleClass("thumbnail",500);
    }

  });
  $("#About").on("click",function(e){
    //playing with an idea here. Not sure it is a good one.
    $.ajax({
      url:"about.md",
      success:function(data){
        var converter = new showdown.Converter();
        var html=converter.makeHtml(data);
        $("<div>"+html+"</div>").dialog({minWidth: 500});
      }
    });
    e.preventDefault();
  });


});
