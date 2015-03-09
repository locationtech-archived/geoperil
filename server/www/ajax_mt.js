function getUri( jsobj ) {
	var uri = '&';
	for ( var key in jsobj ) {
	    uri += key + '=' + jsobj[key] + "&";
	}
	return encodeURI(uri.slice(0,-1));
}

onmessage = function(e) {
	var http = new XMLHttpRequest();
	var ajaxObj = e.data;
	http.onload = complete;
	http.open("POST", ajaxObj.url, true);
	http.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');	
	http.send( getUri(ajaxObj.data) );
};

function complete () {
  var o = JSON.parse( this.responseText);
  postMessage( o );
}
