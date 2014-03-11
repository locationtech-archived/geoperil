var map;
var eqlist = [];
var active = { index: -1,
			   list: eqlist
			  };

var curlist = eqlist;
var curtab = "#tabRecent";

var loggedIn = false;
var username = "";

var global = {	context: -1,
				marker: null,
			  	saved: []
				};

google.maps.event.addDomListener(window, 'load', initialize);
    
function initialize() {

	var mapOptions = {
			zoom: 2,
			center: new google.maps.LatLng(0,0),
			mapTypeId: google.maps.MapTypeId.SATELLITE
	};

	map = new google.maps.Map( document.getElementById('mapview'), mapOptions );
    		
	google.maps.event.addListener( map, 'click', clickMap );
	
	checkSession();
	
	$( "#btnSignIn" ).click( signIn );
	$( "#btnSignOut" ).click( signOut );
	$( "#btnStart" ).click( compute );
	$( "#btnClear" ).click( clearForm );
	$( document ).click( { show: false }, context );
	$( "#ctxEdit" ).click( fillCustomForm );
	$( "#btnDeselect" ).click( deselect );
	
	$( "#tabRecent" ).click( { tab: "recent" }, tabChanged );
	$( "#tabSaved" ).click( { tab: "saved" }, tabChanged );
	$( "#tabCustom" ).click( { tab: "custom" }, tabChanged );
		    						
	getEvents();
}

function getEvents() {
	
	$.ajax({
		url: "srv/fetch",
		type: 'POST',
		data: { limit: 10 },
		dataType: 'json',
				
		success: function( data ) {
				    			
			var timestamp = data['ts'];
			var mlist = data['main'];
			var ulist = data['user'];
			
			for ( var i = mlist.length -1; i >= 0; i-- ) {
				eqlist.push( mlist[i] );
			}
			
			for ( var i = ulist.length -1; i >= 0; i-- ) {
				global.saved.push( ulist[i] );
			}
			
			showEntries( eqlist, $('#sidebar') );
			showEntries( global.saved, $('#saved') );
			$( curtab ).click();
			
			getUpdates( timestamp );
		}
	});
}

function getUpdates( timestamp ) {
	
	$.ajax({
		url: "srv/update",
		type: 'POST',
		data: { ts: timestamp },
		dataType: 'json',
		success: function( result ) {
			
			timestamp = result['ts'];
			var mlist = result['main'];
			var ulist = result['user'];
				    		
			var madd = false;
			var uadd = false;
			
			for ( var i = mlist.length -1; i >= 0; i-- ) {
					    
				var obj = mlist[i];
				
				if( obj['event'] == 'new' ) {
					
					eqlist.push( obj );
					madd = true;
					
				} else if( obj['event'] == 'progress' ) {
		
					var id = obj['_id'];
					var process = obj['process'][0];
					updateProgress( id, process, eqlist );
				}
			}
			
			for ( var i = ulist.length -1; i >= 0; i-- ) {
			    
				var obj = ulist[i];
								
				if( obj['event'] == 'new' ) {
					
					global.saved.push( obj );
					uadd = true;
					
				} else if( obj['event'] == 'progress' ) {
		
					var id = obj['_id'];
					var process = obj['process'][0];
					updateProgress( id, process, global.saved );
				}
			}
			
			// this is not performant if only one element must be updated
			if( madd ) {
				showEntries( eqlist, $('#sidebar') );
			}
			
			if( uadd ) {
				showEntries( global.saved, $('#saved') );
			}
			
			if( madd || uadd )
				$( curtab ).click();
		},
		error: function() {
		},
		complete: function() {
			// schedule the next request when the current one's complete
			setTimeout( function() { getUpdates( timestamp ); }, 1000);
		}
	});
}

function showEntries( list, widget ) {
	
	widget.empty();
	
	//var bounds = new google.maps.LatLngBounds ();
	
	for( var i = 0; i < list.length; i++ ) {
		
		addEntry( widget, list[i], i );
		//bounds.extend( list[i]['marker'].getPosition() );
	}
	
	//map.fitBounds(bounds);
}

function updateProgress( id, process, list ) {

	for( var i = 0; i < list.length; i++ ) {
		
		if( list[i]['_id'] == id ) {
			
			if( list[i]['process'].length == 0 ) {
				list[i]['process'].push( null );
				list[i].div.find( '.status' ).css( 'display', 'none' );
			}
			
			list[i]['process'][0] = process;
			
			var filled = process['progress'];
			
			if( list[i].div ) {
				
				var grid = process['grid_dim'];
				var latMin = grid['latMin'].toFixed(2);
				var lonMin = grid['lonMin'].toFixed(2);
				var latMax = grid['latMax'].toFixed(2);
				var lonMax = grid['lonMax'].toFixed(2);
				
		    	list[i].div.find( '.progress-bar' ).css( 'width', filled + "%" );
		    	list[i].div.find( '.progress' ).css( 'display', 'block' );
		    	list[i].div.find( '.progress-bar' ).css( 'width', filled + "%" );
		    	list[i].div.find( '.resource' ).html( process['resources'] );
		    	list[i].div.find( '.calc' ).html( 'Runtime: ' + process['calcTime'] / 1000 + 's &#183; Res: ' + process['resolution'] + 's &#183; Simulation: ' + process['simTime'] + 's' );
		    	list[i].div.find( '.grid' ).html( 'Grid: (' + latMin + ', ' + lonMin + '), (' + latMax + ', ' + lonMax + ')' ); 
		    	list[i].div.find( '.status' ).html( 'Processed' );
		    	
		    	if( filled == 100 ) {
		    		list[i].div.find( '.progress' ).css( 'display', 'none' );
		    		list[i].div.find( '.status' ).html( 'Processed' );
		    		list[i].div.find( '.status' ).css( 'display', 'inline' );
		    	}
			}
	    	
			if( active.list == list && active.index == i ) {
				getIsos( list[i] );
				
				if( filled == 100 ) {
					getPois( list[i] );
					showPois(active, true);
				}
			}
		}
	}
}
	    
function zeroPad( num, count ) {
	
	var str = "";
	
	for( var i = 0; i < count; i++ )
		str += "0";
	
	str += num;
	return str.slice( str.length - count );
}
    
function addEntry( widget, data, i ) {
		    	
	var $div = $('#entry').clone();
	var id = $div.attr('id') + i;
	$div.attr('id', id );
	$div.css('display', 'block' );
	
	data['div'] = $div;
	data['index'] = i;
	
	var prop = data['prop'];
	
	var date = new Date( prop['date'] );
	var year = date.getUTCFullYear();
	var month = date.getUTCMonth() + 1;
	var day = date.getUTCDate();
	var hour = date.getUTCHours();
	var minutes = date.getUTCMinutes();
	var seconds = date.getUTCSeconds();
	
	var datestr = year + "/" + zeroPad( month, 2 ) + "/" + zeroPad( day, 2 );
	var timestr = zeroPad( hour, 2 ) + ":" + zeroPad( minutes, 2 ) + ":" + zeroPad( seconds, 2 );
		    		    		    	
	$div.find( '.region' ).text( prop['region'] );
	$div.find( '.mag').text( prop['magnitude'] );
	$div.find( '.datetime' ).html( datestr + " &#183; " + timestr + " UTC" );
	$div.find( '.lonlat' ).html( 'Lat: ' + prop['latitude'] + '&deg; Lon: ' + prop['longitude'] + '&deg; Depth: ' + prop['depth'] + ' km' );
	$div.find( '.dip' ).html( 'Dip: ' + prop['dip'] + '&deg; Strike: ' + prop['strike'] + '&deg; Rake: ' + prop['rake'] + '&deg;' );
	
	if( widget[0] != $('#saved')[0] ) {
		var yearstr = data['_id'].substring(3,7);
		$div.find( '.beach' ).attr( "src", "http://geofon.gfz-potsdam.de/data/alerts/" + yearstr + "/" + data['_id'] + "/bb32.png" );
		$div.find( '.geofon' ).attr( "href", "http://geofon.gfz-potsdam.de/eqinfo/event.php?id=" + data['_id'] );
	}
		
	$div.find( '.progress' ).css( 'display', 'none' );
	$div.find( '.status' ).html( 'Not processed' );
	
	if( data['process'].length > 0 ) {
		updateProgress( data['_id'], data['process'][0], new Array( data ) );
	}
	
	var color = '#00FF00';
	
	if( prop['magnitude'] > 7.0 ) {
		color = '#FF0000';
	} else if( prop['magnitude'] > 6.0 ) {
		color = '#FF8C00';
	} else if( prop['magnitude'] > 5.0 ) {
		color = '#FFFF00';
	}
	
	if( widget[0] == $('#saved')[0] )
		color = '#0000FF';
	
	var link = getMarkerIconLink( i, color );
		
	//$div.find( '.progress-bar' ).css( 'background-color', color );
	$div.find( '.marker' ).attr( 'src', link );
		    	
	$div.bind( 'mouseover', { turnOn: true }, highlight );
	$div.bind( 'mouseout', { turnOn: false }, highlight );
	$div.find( '.region' ).bind( 'click', entryOnClick );
	$div.bind( 'contextmenu', { show: true }, context );
	$div.find( '.calc_lnk' ).bind( 'click', showCalcData );
	$div.find( '.chk_grid' ).bind( 'click', { entry: data }, enableGrid );
	
	if( data['marker'] )
		data['marker'].setMap( null );
		
	data['marker'] = addMarker( prop['latitude'], prop['longitude'], new google.maps.MarkerImage( link ) );
	data['marker'].setAnimation( null );
	data['marker'].setMap( null );
	
	if( data['arrT'] == null ) {
		data['arrT'] = 0;
		data['polygons'] = {};
		data['rectangle'] = null;
		data['show_grid'] = false;
		data['pois'] = null;
	}
		    			    			    	
	widget.prepend( $div );
}

function entryOnClick() {
		
	var index = curlist.length - $(this).parents( ".entry" ).index() - 1;
	var entry = curlist[ index ];
		
	showPolygons( active, false );
	showGrid( active, false );
	showPois( active, false );
	
	active.index = index;
	active.list = curlist;
	getIsos( entry );
	getPois( entry );
	
	showPolygons( active, true );
	showGrid( active, entry['show_grid'] );
	showPois( active, true );
		
	//map.setZoom(3);
	map.panTo( entry['marker'].position );
}

function highlight( event ) {
		   	
	var turnOn = event.data["turnOn"];
	var entry = curlist[ curlist.length - $(this).index() - 1 ];
	
	if( jQuery.contains( event.currentTarget, event.relatedTarget ) )
		return;
		    	
	if( turnOn ) {
		color = '#99b3cc'; //'#cacaf7';
		entry['marker'].setAnimation( google.maps.Animation.BOUNCE );
	} else {
		color = '#fafafa';
		entry['marker'].setAnimation( null );
	}
	
	$(this).css('background-color', color);
}

function addMarker( lat, lon, icon ) {
		
    // create new marker on selected position
    return new google.maps.Marker( { position: new google.maps.LatLng( lat, lon ), map: map, icon: icon} );
}

function getMarkerIconLink( text, color ) {
	
	var link = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld='
			 + text + '|' + color.substring(1) + '|000000';
	
	return link;
}
	    	
function getIsos( entry ) {
	
	var id = entry['_id'];
	var arrT = entry['arrT'];
				
	$.ajax({
		url: "srv/getIsolines",
		data: { "id": id, "process": 0, "arrT": arrT },
		dataType: 'json',
		success: function( result ) {
			
			for( var i = 0; i < result.length; i++ ) {
				
				var resultObj = result[i];
				
				entry['arrT'] = resultObj['arrT'];
				
				sub = [];
				
				lines = resultObj['points'];    				
				for( var j = 0; j < lines.length; j++ ) {
					
					points = lines[j];
					coords = [];
    				for( var k = 0; k < points.length; k++ ) {
    					xy = points[k];
    					coords.push( new google.maps.LatLng( xy['d'], xy['e'] ) );
    				}
    				
    				polyline = new google.maps.Polyline({
    				    path: coords,
    				    geodesic: true,
    				    strokeColor: '#FF0000',
    				    strokeOpacity: 1.0,
    				    strokeWeight: 1
				  	});
    				
    				polyline.setMap( map );

    				sub.push( polyline );
				}
			
				entry['polygons'][ resultObj['arrT'] ] = sub;
			}
			
		}
	});
		    	
}

function getPois( entry ) {
	
	var id = entry._id;
	
	if( entry.pois != null )
		return;
				
	$.ajax({
		url: "srv/getPois",
		data: { "id": id, "process": 0 },
		dataType: 'json',
		success: function( result ) {
			
			if( result.length == 0 )
				return;
			
			entry.pois = new Array();
			
			for( var i = 0; i < result.length; i++ ) {
				
				var poi = result[i];
				
				var center = new google.maps.LatLng( poi.lat, poi.lon );
				
				var point = { marker: null,
						  	  info: null,
						  	  isOpen: false
							};
								
				point.marker = new google.maps.Marker ({
					position: center,
					map: map,
					icon: {
						path: google.maps.SymbolPath.CIRCLE,
					    fillOpacity: 0.5,
					    fillColor: '#fff000',
					    strokeOpacity: 1.0,
					    strokeColor: '#fff000',
					    strokeWeight: 2.0,
					    scale: 5 //pixels
						}
					});
				
				point.info = new google.maps.InfoWindow({
						content: poi.station
					});
				
				entry.pois.push( point );
				
				with( { p: i } ) {
					google.maps.event.addListener( point.marker, 'click', function() {
						var poi = entry.pois[p];
						
						if( ! poi.isOpen ) {
							
							poi.info.open( map, poi.marker );
							poi.isOpen = true;
							
						} else {
							
							poi.info.close();
							poi.isOpen = false;
						}
					});
				}
			}
		}	
	});	
	
}

function showPolygons( pointer, visible ) {
		    	
	if( pointer.index < 0 )
		return;
	
	var tmap = null;
	
	if( visible )
		tmap = map;
		
	var entry = pointer.list[ pointer.index ];
	
	for( var arrT in entry['polygons'] ) {
		
		polylines = entry['polygons'][arrT];
		
		for( var i = 0; i < polylines.length; i++ ) {
			
			polylines[i].setMap( tmap );
		}
	}
}

function showGrid( pointer, visible ) {
		
	if( pointer.index < 0 )
		return;
	
	var entry = pointer.list[ pointer.index ];
	
	if( ! visible ) {
		if( entry['rectangle'] != null ) {
			entry['rectangle'].setMap( null );
			entry['rectangle'] = null;
		}
		return;
	}
		
	if( entry['process'].length == 0 )
		return;
		
	if( entry['rectangle'] )
		return;
	
	var grid = entry['process'][0]['grid_dim'];
		
	var latMin = Math.max( grid['latMin'], -85.05115 );
	var latMax = Math.min( grid['latMax'], 85.05115 );
	var lonMin = grid['lonMin'];
	var lonMax = grid['lonMax'];
	
	entry['rectangle'] = new google.maps.Rectangle({
	    strokeColor: '#00FF00',
	    strokeOpacity: 0.8,
	    strokeWeight: 2,
	    fillColor: '#FF0000',
	    fillOpacity: 0.0,
	    //editable: true,
	    //draggable: true,
	    bounds: new google.maps.LatLngBounds(
	      new google.maps.LatLng( latMin, lonMin ),
	      new google.maps.LatLng( latMax, lonMax ))
	});
	
	entry['rectangle'].setMap( map );
}

function showPois( pointer, visible ) {
	
	if( pointer.index < 0 )
		return;
	
	var tmap = null;
	
	if( visible )
		tmap = map;
	
	var entry = pointer.list[ pointer.index ];
	
	for( var i in entry.pois ) {
		
		entry.pois[i].marker.setMap( tmap );
	}
}

function deselect() {
	
	showPolygons(active, false);
	showGrid(active, false);
	showPois(active, false);
	
	active.index = -1;
}
	    
function checkSession() {
	
	var status;
	
	$.ajax({
		type: 'POST',
		url: "srv/session",
		dataType: 'json',
		success: function( result ) {
			status = result.status;
			
			if( status == 'success' ) {
				username = result.username;
				logIn();
			}
		},
		error: function() {
		},
		complete: function() {
		}
	});
}

function signIn() {
		    	
	$( "#drpSignIn" ).dropdown("toggle");
	
	username = $('#inUsername').val();
	var password = $('#inPassword').val();
	
	var status = null;
	
	$.ajax({
		type: 'POST',
		url: "srv/signin",
		data: { username: username, password: password },
		dataType: 'json',
		success: function( result ) {
			
			status = result['status'];
		},
		error: function() {
		},
		complete: function() {			
			if( status == "success" ) {
				logIn();
			}
		}
	});
}

function logIn() {
	
	loggedIn = true;
	
	$( "#drpSignIn" ).css( "display", "none" );
	$( "#btnSignOut" ).css( "display", "block" );
	
	$( '#tabSaved').css( "display", "block" );
	$( '#tabCustom').css( "display", "block" );
}

function signOut() {

	var status = null;
		
	$.ajax({
		type: 'POST',
		url: "srv/signout",
		data: { username: username },
		dataType: 'json',
		success: function( result ) {
			
			status = result['status'];
		},
		error: function() {
		},
		complete: function() {	 
			
			if( status == "success" ) {
				logOut();
			}
		}
	});
}

function logOut() {
	
	loggedIn = false;
	
	$( "#drpSignIn" ).css( "display", "block" );
	$( "#btnSignOut" ).css( "display", "none" );
	
	$( '#tabSaved').css( "display", "none" );
	$( '#tabCustom').css( "display", "none" );
	
	$( '#tabRecent' ).find('a').trigger('click');
}

function compute() {
  
	var params = getParams();
	var status;
		    	
	$( "#hrefSaved" ).click();
	
	deselect();
	active.list = global.saved;
	active.index = active.list.length;
	
	$.ajax({
		type: 'POST',
		url: "srv/compute",
		data: params,
		dataType: 'json',
		success: function( result ) {
			status = result['status'];
		},
		error: function() {
		},
		complete: function() {
		}
	});
	
}

function getParams() {
	
	var params = {};
	
	params['lon'] = $('#inLon').val();
	params['lat'] = $('#inLat').val();
	params['mag'] = $('#inMag').val();
	params['depth'] = $('#inDepth').val();
	params['dip'] = $('#inDip').val();
	params['strike'] = $('#inStrike').val();
	params['rake'] = $('#inRake').val();
	params['dur'] = $('#inDuration').val();
	
	return params;
}

function fillForm( entry ) {
	
	var prop = entry['prop'];
	
	$('#inLon').val( prop['longitude'] );
	$('#inLat').val( prop['latitude'] );
	$('#inMag').val( prop['magnitude'] );
	$('#inDepth').val( prop['depth'] );
	$('#inDip').val( prop['dip'] );
	$('#inStrike').val( prop['strike'] );
	$('#inRake').val( prop['rake'] );
	$('#inDuration').val( 180 );
	
	setMarker();
}

function clearForm() {
	$('#custom :input').val('');
}

function context( e ) {
	
	var show = e.data.show;
		
	if( ! loggedIn )
		return !show;
	
	if( show ) {
		global.context = curlist.length - $(this).index() - 1;
		$( '#contextMenu' ).css( "display", "block" );
		$( '#contextMenu' ).css( "left", e.pageX );
		$( '#contextMenu' ).css( "top", e.pageY );
	} else {
		
		/* left mouse click */
		if( e.which == 1 ) {
			global.conext = -1;
			$( '#contextMenu' ).css( "display", "none" );
		}
		
		/* very important to not break links */
		return true;
	}
	
	/* do not give this event to the browser to avoid the usual context menu */
	return false;
}

function fillCustomForm() {
	fillForm( curlist[ global.context ] );
	$( '#tabCustom' ).find('a').trigger('click');
}

function clickMap( event ) {
		
	if( $('#custom').css("display") == "block" ) {
	
    	$('#inLon').val( event.latLng.lng().toFixed(2) );
	    $('#inLat').val( event.latLng.lat().toFixed(2) );
	
    	//checkAll();
    
    	setMarker();
	}
}

function setMarker() {
	
	// delete the old marker
    if( global.marker ) { global.marker.setMap(null); }

    // create new marker on selected position
    var link = getMarkerIconLink( "%E2%80%A2", "#0000FF" );
    global.marker = addMarker( $('#inLat').val(), $('#inLon').val(), new google.maps.MarkerImage( link ) );
}

function tabChanged( args ) {
	
	var tab = args.data.tab;
			
	curtab = "#" + $(this).attr('id');
	
	if( tab == "recent" ) {
		
		curlist = eqlist;
		
		for( var i = 0; i < eqlist.length; i++ )
			eqlist[i].marker.setMap( map );
			
	} else {
		
		for( var i = 0; i < eqlist.length; i++ )	
			eqlist[i].marker.setMap( null );
	}
	
	if( tab == "saved" ) {
		
		curlist = global.saved;
		
		for( var i = 0; i < global.saved.length; i++ )
			global.saved[i].marker.setMap( map );
		
	} else {
		
		for( var i = 0; i < global.saved.length; i++ )
			global.saved[i].marker.setMap( null );
	}
	
	if( tab == "custom" ) {
		
		curlist = global.saved;
		
		if( global.marker )
			global.marker.setMap( map );
		
	} else {
		
		if( global.marker )
			global.marker.setMap( null );
	}
}

function showCalcData() {
	
	var calc_data = $(this).parents( '.entry' ).find( '.calc_data' );
	var display = calc_data.css( "display" );
	
	var status = $(this).find( '.status' );
	
	if( status.text() == "Not processed" )
		return;
	
	if( display == "none" ) {
		
		calc_data.css( "display", "block" );
		$(this).find( ".arrow_down" ).css( "display", "none" );
		$(this).find( ".arrow_up" ).css( "display", "inline" );
		
	} else {
		
		calc_data.css( "display", "none" );
		$(this).find( ".arrow_down" ).css( "display", "inline" );
		$(this).find( ".arrow_up" ).css( "display", "none" );
	}
}

function enableGrid( args ) {
	
	var entry = args.data.entry;
	
	entry['show_grid'] = $(this).is(':checked');
	
	if( active.index == entry['index'] )
		showGrid( active, entry['show_grid'] );
}
