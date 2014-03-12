var map;
var eqlist = [];
var active = { index: -1,
			   list: eqlist
			  };

var curlist = eqlist;
var curtab = "#tabRecent";

var loggedIn = false;
var username = "";

var signTarget = null;

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
	
	$( "#btnSignIn" ).click( drpSignIn );
	$( "#btnSignOut" ).click( signOut );
	$( "#btnStart" ).click( compute );
	$( "#btnClear" ).click( clearForm );
	//$( document ).click( { show: false }, context );
	$( "#btnDeselect" ).click( deselect );
	
	$( "#tabRecent" ).click( { tab: "recent" }, tabChanged );
	$( "#tabSaved" ).click( { tab: "saved" }, tabChanged );
	$( "#tabCustom" ).click( { tab: "custom" }, tabChanged );
	
	$( "#diaSignIn" ).click( diaSignIn );
	
	$( "#custom" ).find( "input" ).blur( checkInput );
	
	// set tooltip for deselect button 
	options = { placement:'top',
			title:'Deselect and show map only',
			container: 'body',
			animation: false
	   	   };

	$( '#btnDeselect' ).tooltip( options );
		    			
	// show disclaimer - redirect to xkcd if not accepted
	if( ! $.cookie('disclaimer') ) {
		$( '.disClose' ).click( function() { window.location.href = "http://dynamic.xkcd.com/random/comic/"; } );
		$( '#disAccept' ).click( function() { $.cookie('disclaimer', 'true'); } );
		$( '#DisclaimDia' ).modal( { show: true, backdrop: 'static' } );
	}
	
	$( '#preset > .list-group-item' ).click( loadPreset );
		
	getEvents();
}

function getEvents() {
	
	$.ajax({
		url: "srv/fetch",
		type: 'POST',
		data: { limit: 20 },
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
			}
			
			list[i]['process'][0] = process;
			
			var filled = process['progress'];
			
			if( list[i].div ) {
				
				var grid = process['grid_dim'];
				var latMin = grid['latMin'].toFixed(2);
				var lonMin = grid['lonMin'].toFixed(2);
				var latMax = grid['latMax'].toFixed(2);
				var lonMax = grid['lonMax'].toFixed(2);
				
				list[i].div.find( '.chk_grid' ).css( 'display', 'inline' );
				list[i].div.find( '.status' ).css( 'display', 'none' );
		    	list[i].div.find( '.progress-bar' ).css( 'width', filled + "%" );
		    	list[i].div.find( '.progress' ).css( 'display', 'block' );
		    	list[i].div.find( '.progress-bar' ).css( 'width', filled + "%" );
		    	list[i].div.find( '.resource' ).html( process['resources'] );
		    	list[i].div.find( '.calc' ).html( 'Runtime ' + process['calcTime'] / 1000 + ' sec &#183; SimDuration ' + process['simTime'] + " min" );
		    	list[i].div.find( '.grid' ).html( 'Grid ' + process['resolution'] + '&prime; &#183; BBox (' + latMin + ', ' + lonMin + '), (' + latMax + ', ' + lonMax + ')' ); 
		    	
		    	if( filled == 100 ) {
		    		list[i].div.find( '.progress' ).css( 'display', 'none' );
		    		list[i].div.find( '.status' ).html( 'Simulation processed' );
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
	var timestr = zeroPad( hour, 2 ) + ":" + zeroPad( minutes, 2 ); // + ":" + zeroPad( seconds, 2 );
		    		    		    	
	$div.find( '.region' ).text( prop['region'] );
	$div.find( '.mag').text( prop['magnitude'] );
	$div.find( '.datetime' ).html( datestr + " &#183; " + timestr + " UTC" + " &#183; " + data['_id'] );
	$div.find( '.lonlat' ).html( 'Lat ' + prop['latitude'] + '&deg; &#183;  Lon ' + prop['longitude'] + '&deg; &#183;  Depth ' + prop['depth'] + ' km' );
	$div.find( '.dip' ).html( 'Dip ' + prop['dip'] + '&deg; &#183; Strike ' + prop['strike'] + '&deg; &#183; Rake ' + prop['rake'] + '&deg;' );
	
	if( widget[0] != $('#saved')[0] ) {
		var yearstr = data['_id'].substring(3,7);
		$div.find( '.beach' ).attr( "src", "http://geofon.gfz-potsdam.de/data/alerts/" + yearstr + "/" + data['_id'] + "/bb32.png" );
		$div.find( '.geofon' ).attr( "href", "http://geofon.gfz-potsdam.de/eqinfo/event.php?id=" + data['_id'] );
	} else {
		$div.find( '.geofon' ).css( 'display', 'none' );
	}
		
	$div.find( '.progress' ).css( 'display', 'none' );
	
	if( data['process'].length > 0 ) {
		updateProgress( data['_id'], data['process'][0], new Array( data ) );
	} else {
		
		if( widget.is( '#saved' ) ) {
			$div.find( '.status' ).html( 'Simulation is being prepared' );
		} else if( ! prop['sea_area'] ) {
			$div.find( '.status' ).html( 'Inland, no simulation processed' );
		} else {
			$div.find( '.status' ).html( 'No tsunami potential' );
			$div.find( '.lnkLearn' ).css( "display", "inline" );
			
			var options = { placement:'bottom',
							title:'Info',
							html: true,
							container: $div,
							animation: false
						   };
			options.content = "<span style='font-size: 0.8em;'>Currently, we use a rough and simple threshold mechanism to identify the tsunami potential of an earthquake. If the location of the earthquake is inland, deeper than 100km, or has a magnitude less than 5.5 then we don't consider the earthquake for any wave propagation computation. However, if you think the earthquake is relevant for computation then you can do so by using 'Modify and reprocess'. <br><br>Anyhow, in the near future we plan to use an improved mechanism by adopting region dependent decision matrices defined by the UNESCO-IOC ICGs, that is ICG/NEAMTWS, ICG/IOTWS, ICG/PTWS, and ICG/CARIBE EWS.</span>";
			$div.find( '.lnkLearn' ).popover( options );
		}
	}
	
	options = { placement:'top',
				title:'Modify and reprocess',
				container: $div,
				animation: false
		   	   };
	
	$div.find( '.lnkEdit' ).tooltip( options );
	
	options.title = 'Learn more';
	$div.find( '.lnkLearn' ).tooltip( options );
	
	var color = getMarkerColor( prop['magnitude'] );
	
	if( widget[0] == $('#saved')[0] )
		color = '#E4E7EB';
	
	var link = getMarkerIconLink( i + 1, color );
		
	$div.find( '.marker' ).attr( 'src', link );
		    	
	$div.bind( 'mouseover', { turnOn: true }, highlight );
	$div.bind( 'mouseout', { turnOn: false }, highlight );
	$div.find( '.region' ).bind( 'click', entryOnClick );
	$div.bind( 'contextmenu', { show: true }, context );
	$div.find( '.chk_grid' ).bind( 'click', { entry: data }, enableGrid );
	$div.find( '.lnkEdit' ).bind( 'click', fillCustomForm );
	
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

function getMarkerColor( mag ) {
	
	var color = 'gray';
	
	if( mag < 2.0 ) {
		color = '#FFFFFF';
	} else if( mag < 3.0 ) {
		color = '#BFCCFF';
	} else if( mag < 4.0 ) {
		color = '#9999FF';
	} else if( mag < 5.0 ) {
		color = '#80FFFF';
	} else if( mag < 5.3 ) {
		color = '#7DF894';
	} else if( mag < 6.0 ) {
		color = '#FFFF00';
	} else if( mag < 7.0 ) {
		color = '#FFC800';
	} else if( mag < 7.4 ) {
		color = '#FF9100';
	} else if( mag < 7.8 ) {
		color = '#FF0000';
	} else if( mag < 8.5 ) {
		color = '#C80000';
	} else if( mag < 9.0 ) {
		color = '#800000';
	} else {
		color = '#400000';
	}
	
	return color;
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
		color = '#c3d3e1'; //#99b3cc';
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
							
				var color = getPoiColor( poi );
				
				point.marker = new google.maps.Marker ({
					position: center,
					map: map,
					icon: {
						path: google.maps.SymbolPath.CIRCLE,
					    fillOpacity: 0.7,
					    fillColor: color,
					    strokeOpacity: 1.0,
					    strokeColor: color,
					    strokeWeight: 2.0,
					    scale: 5 //pixels
						}
					});
				
				var txt = "<b>" + poi.station + "</b><br>";
				
				var min = Math.floor( poi.eta );
				var sec = Math.floor( (poi.eta % 1) * 60.0 );
				
				if( poi.eta != -1 ) {
					txt += "<span>Estimated Arrival Time: " + min + ":" + sec + " minutes</span><br>";
					txt += "<span>Estimated Wave Height: " + poi.ewh.toFixed(2) + " meters</span><br>";
				} else {
					txt += "<span>Uneffected.</span><br>";
				}
				
				point.info = new google.maps.InfoWindow({
						content: txt
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

function getPoiColor( poi ) {
	
	var color;
	
	if( poi.eta == -1 ) {
		color = "#ADADAD";
	} else if( poi.ewh < 0.75 ) {
		color = "#00CCFF";
	} else if( poi.ewh < 1.5 ) {
		color = "#FFFF00";
	} else if( poi.ewh < 3 ) {
		color = "#FF6600";
	} else {
		color = "#FF0000";
	}
	
	return color;
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

function signIn( user, password ) {
	
	var status = null;
	
	$.ajax({
		type: 'POST',
		url: "srv/signin",
		data: { username: user, password: password },
		dataType: 'json',
		success: function( result ) {
			
			status = result['status'];
		},
		error: function() {
		},
		complete: function() {
			
			if( status == "success" ) {
				logIn();
				
				/* reset all password and status fields of sign-in widgets */
				$( "#SignInDialog" ).modal("hide");
				$('#diaStatus').html("");
				$('#diaPass').val("");
				$('#inPassword').val("");
				
				if( signTarget )
					signTarget();
				
			} else {

				/* set status to error and clear password fields */
				$('#diaStatus').html("Login failed!");
				$('#drpStatus').html("Login failed!");
				$('#diaPass').val("");
				$('#inPassword').val("");
			}
		}
	});
}

function drpSignIn( e ) {
					
	if( ! loggedIn ) {
		
		e.stopPropagation();
		signTarget = null;
		$( "#SignInDialog" ).modal("show");
		return;
	}
	
}

function diaSignIn() {
	
	username = $('#diaUser').val();
	var password = $('#diaPass').val();

	signIn( username, password );
}

function logIn() {
	
	loggedIn = true;
	
	$( "#btnSignIn" ).css( "display", "none" );
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
	
	$( "#btnSignIn" ).css( "display", "block" );
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
	
	params['name'] = $('#inName').val();
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
	
	$('#inName').val( prop['region'] );
	$('#inLon').val( prop['longitude'] );
	$('#inLat').val( prop['latitude'] );
	$('#inMag').val( prop['magnitude'] );
	$('#inDepth').val( prop['depth'] );
	$('#inDip').val( prop['dip'] );
	$('#inStrike').val( prop['strike'] );
	$('#inRake').val( prop['rake'] );
	$('#inDuration').val( 180 );
		
	checkInput();
}

function clearForm() {
	$('#custom :input').val('');
	checkInput();
}

function context( e ) {
	
	var show = e.data.show;
		
	/*if( ! loggedIn )*/
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

function fillCustomForm( e ) {
	
	if( !loggedIn ) {
		
		e.stopPropagation();
		signTarget = fillCustomForm.bind(this, e);
		$( "#SignInDialog" ).modal("show");
		return;
	}
	
	var index = curlist.length - $(this).parents('.entry').index() - 1;
	fillForm( curlist[ index ] );
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
    var link = getMarkerIconLink( "%E2%80%A2", "#E4E7EB" );
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

function enableGrid( args ) {
	
	var entry = args.data.entry;
	
	entry['show_grid'] = $(this).is(':checked');
	
	if( active.index == entry['index'] )
		showGrid( active, entry['show_grid'] );
}

function checkInput() {
	
	var validLon = checkRange( '#inLon', -180, 180 );
	var validLat = checkRange( '#inLat', -90, 90 );
	
	var stat = validLon;
	stat = validLat && stat;
	stat = checkRange( '#inMag', 0, 10.6 ) && stat;
	stat = checkRange( '#inDepth', 0, 1000 ) && stat;
	stat = checkRange( '#inDip', 0, 90 ) && stat;
	stat = checkRange( '#inStrike', 0, 360 ) && stat;
	stat = checkRange( '#inRake', -180, 180 ) && stat;
	stat = checkRange( '#inDuration', 0, 480 ) && stat;
	
	$('#btnStart').prop('disabled', !stat);
	
	if( validLon && validLat ) {
		setMarker();
	} else if( global.marker ) {
		global.marker.setMap(null);
	}
	
	return stat;
}

function checkRange( id, start, end ) {

    var val = $( id ).val().replace( ",", "." );
    
    $( id ).val( val );
    $(id).css( "color", "" );
    
    if( val == '' ) {
    	return false;
    }
	
    if( checkFloat( val ) == false ) {
    	$(id).css( "color", "red" );
        return false;
    }

    if( val < start || val > end ) {
    	$(id).css( "color", "red" );
        return false;
    }

    return true;
}

function checkFloat( val ) {

    if( isNaN( parseFloat( +val ) ) || ! isFinite( val ) )
        return false;

    return true;
}

function loadPreset() {
	
	var data = {};
	var id = $(this).attr('id');
	
	data.preset1 = { latitude: 38.321, longitude: 142.369, magnitude: 9.0, depth: 24, strike: 193, dip: 14, rake: 81 };
	data.preset2 = { latitude: 2.3, longitude: 92.9, magnitude: 8.57, depth: 25, strike: 199, dip: 80, rake: 3 };
	data.preset3 = { latitude: 7.965, longitude: 156.40, magnitude: 8.1, depth: 23, strike: 331, dip: 38, rake: 120 };
	data.preset4 = { latitude: 35, longitude: 29, magnitude: 8.5, depth: 24.1, strike: 260, dip: 42, rake: 95 };
	data.preset5 = { latitude: 35.5, longitude: 31.9, magnitude: 7.3, depth: 15.1, strike: 310, dip: 69, rake: 111 };
	data.preset6 = { latitude: 38.9, longitude: 26.4, magnitude: 6.5, depth: 11.4, strike: 140, dip: 56, rake: -120 };
	data.preset7 = { latitude: 34.5, longitude: 27.1, magnitude: 8, depth: 21.3, strike: 66, dip: 33, rake: 90 };
	data.preset8 = { latitude: 36.574, longitude: -9.890, magnitude: 8.1, depth: 4, strike: 20, dip: 35, rake: 90 };
	data.preset9 = { latitude: 36.665, longitude: -11.332, magnitude: 8.1, depth: 5, strike: 53, dip: 35, rake: 90 };
	data.preset10 = { latitude: 35.796, longitude: -9.913, magnitude: 8.3, depth: 4, strike: 42, dip: 35, rake: 90 };
	data.preset11 = { latitude: 36.314, longitude: -8.585, magnitude: 8, depth: 2.5, strike: 266, dip: 24, rake: 90 };
	data.preset12 = { latitude: 35.407, longitude: -8.059, magnitude: 8.6, depth: 20, strike: 349, dip: 5, rake: 90 };
	data.preset13 = { latitude: -3.55, longitude: 100.05, magnitude: 7.7, depth: 15, strike: 325, dip: 12, rake: 90 };
	data.preset14 = { latitude: -3.2, longitude: 99.70, magnitude: 7.5, depth: 15, strike: 325, dip: 12, rake: 90 };
	data.preset15 = { latitude: 35.2, longitude: 23.4, magnitude: 8.3, depth: 0, strike: 315, dip: 30, rake: 90 };

	var prop = data[id];
	prop.region = $(this).html();
	
	var entry = { prop: prop };
	fillForm( entry );
	
	$( '#custom' ).scrollTop(0);
}
