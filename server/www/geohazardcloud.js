var map;

function CustomList( widget ) {
	
   this.list = [];
   this.startIdx = 0;
   this.endIdx = 19;
   this.widget = widget;
   
   this.getElem = function( i ) {
	   return this.list[ this.list.length - i - 1 ];
   };
   
   this.reset = function() {
	   this.list.length = 0;
	   this.startIdx = 0;
	   this.endIdx = 19;
   };
   
   this.push = function( entry ) {
	   	   							
	   entry['arrT'] = 0;
	   entry['polygons'] = {};
	   entry['rectangle'] = null;
	   entry['show_grid'] = false;
	   entry['pois'] = null;
	   entry['heights'] = {};
	   	   	   
	   var date2 = new Date( entry.prop.date );
	   	   
	   for( var i = 0; i < this.list.length; i++ ) {
		   
		   var date1 = new Date( this.list[i].prop.date );
		   
		   if( date1.getTime() > date2.getTime() ) {
			   
			   this.list.splice( i, 0, entry );
			   return;
		   }
		   
	   }
	   
	   this.list.push( entry );
   };
   
   this.find = function( baseId ) {
	   
	   for( var i = 0; i < this.list.length; i++ ) {
		   
		   if( this.list[i]['id'] == baseId ) {
			   return this.list[i];
          }
	   }
	   
	   return null;
   };
   
   this.remove = function( baseId ) {
	   	   
	   for( var i = 0; i < this.list.length; i++ ) {
		   
		   if( this.list[i]['id'] == baseId ) {
			   this.list.splice(i, 1);
			   break;
          }
	   }
   };
}

function EntryMap() {
	
	this.map = {};
	
	this.reset = function() {
		this.map = {};
	};
	
	this.add = function( entry ) {
		
		if( this.map[ entry['_id'] ] )
			console.log("Warning: entry with id " + entry['_id'] + " already in map.");
		
		this.map[ entry['_id'] ] = entry;
	};
	
	this.get = function( id ) {
		return this.map[ id ];
	};
	
	this.getOrInsert = function( entry ) {
		
		var result = this.map[ entry['_id'] ];
				
		if( ! result ) {
			this.map[ entry['_id'] ] = entry;
			result = entry;
		}
		
		return result;
	};
}

var eqlist = new CustomList( '#sidebar' );
var timeline = new CustomList( '#timeline-data' );
var messages = new CustomList( '#messages' );

var entries = new EntryMap();

var active = null;
var searchId = null;

var curlist = eqlist;
var curtab = "#tabRecent";

var loggedIn = false;

var curuser = null;

var default_delay = 24*60;
var delay = default_delay;
var events = {};
var timerId = null;

var defaultText = { no: "No simulation",
					inland: "No simulation",
					prepared: "Simulation is being prepared",
					done: "Simulation processed"
				   };

var userText = { no: "No tsunami potential",
				 inland: "Inland, no simulation processed",
				 prepared: "Simulation is being prepared",
				 done: "Simulation processed"
			   };

var simText = defaultText;

var signTarget = null;

var global = {	context: -1,
				marker: null,
			  	saved: new CustomList( '#saved' )
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
	google.maps.event.addListener( map, 'zoom_changed', mapZoomed );
	
	checkSession();
	
	$( "#btnSignIn" ).click( drpSignIn );
	$( "#btnSignOut" ).click( signOut );
	$( "#btnProp" ).click( showProp );
	$( "#btnStart" ).click( compute );
	$( "#btnClear" ).click( clearForm );
	//$( document ).click( { show: false }, context );
	$( "#btnDeselect" ).click( deselect );
	
	$( "#tabRecent" ).click( { tab: "recent" }, tabChanged );
	$( "#tabSaved" ).click( { tab: "saved" }, tabChanged );
	$( "#tabCustom" ).click( { tab: "custom" }, tabChanged );
	$( "#tabTimeline" ).click( { tab: "timeline" }, tabChanged );
	$( "#tabMessages" ).click( { tab: "messages" }, tabChanged );
	
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
	
	$( '#sidebar' ).scroll( scrollList );
	$( '#saved' ).scroll( scrollList );
	
	$( '#mailBtnSend' ).click( sendEmail );
	
	$( '#btnSearch' ).click( searchEvents );
	$( '#inSearch' ).keyup( function(e) { if( e.keyCode == 13 ) searchEvents(); } );
	
	$( '#btnDelRoot' ).click( function() { $('#inRootId').html(""); } );
	$( '#btnDelParent' ).click( function() { $('#inParentId').html(""); } );
		
	$( '.lnkGroup' ).click( groupOnClick );
	
	// set default behavior of mail dialog
	$( '#msgEvents' ).find( '.lnkGroup' ).click();
	$( '#msgFax' ).find( '.lnkGroup' ).click();
	$( '#msgSMS' ).find( '.lnkGroup' ).click();
	
	$('#EmailDia').on('shown.bs.modal', function() {
		var h = $( "#mailText" )[0].scrollHeight;
	    $( "#mailText" ).outerHeight( h );
	    
	    /* we must make the textarea visible first before the height can be read */
	    var hidden = $( '#msgSMS .grpContent' ).css( "display" ) == "none";
	    if( hidden )
	    	$( '#msgSMS .lnkGroup' ).click();
	    
	    h = $( "#smsText" )[0].scrollHeight;
	    $( "#smsText" ).outerHeight( h );
	    
	    if( hidden )
	    	$( '#msgSMS .lnkGroup' ).click();
	});
		
	$('#smsText').bind('input propertychange', function() {
		$( '#smsChars' ).html( $(this).val().length );
	});
}

function getEvents( callback ) {
	
	if( timerId != null ) {
		clearTimeout( timerId );
		timerId = null;
	}
	
	$.ajax({
		url: "srv/fetch",
		type: 'POST',
		data: { limit: 200, delay: delay },
		dataType: 'json',
				
		success: function( data ) {
				    			
			var timestamp = data['ts'];
			var mlist = data['main'];
			var ulist = data['user'];
			var msglist = data['msg'];
			
			for ( var i = mlist.length -1; i >= 0; i-- ) {
				
				var entry = entries.getOrInsert( mlist[i] );
				eqlist.push( entry );
			}
			
			for ( var i = ulist.length -1; i >= 0; i-- ) {
				var entry = entries.getOrInsert( ulist[i] );
				global.saved.push( entry );
			}
			
			for ( var i = msglist.length -1; i >= 0; i-- ) {
				
				msglist[i]._id = msglist[i]['Message-ID'];
				
				if( msglist[i]['Dir'] == "in" )
					msglist[i]._id += "_in";
												
				var entry = entries.getOrInsert( msglist[i] );
				entry.kind = "msg";
				entry.prop = { date: msglist[i]['CreatedTime'] };
				messages.push( entry );
			}
		            
			showEntries( eqlist );
			
            if( global.saved.list.length > 0 ) {
				showEntries( global.saved );
            }
            
            if( messages.list.length > 0 )
            	showEntries( messages );
			
			$( curtab ).click();
			
			getUpdates( timestamp );
			
			if( callback != null )
				callback();
		}
	});
}

function getUpdates( timestamp ) {
		
	$.ajax({
		url: "srv/update",
		type: 'POST',
		data: { ts: timestamp, delay: delay },
		dataType: 'json',
		success: function( result ) {
			
			timestamp = result['ts'];
			var mlist = result['main'];
			var ulist = result['user'];
				    		
			var madd = false;
			var uadd = false;
			var sadd = false;
			var msgadd = false;
            var show = false;
			
			for ( var i = mlist.length -1; i >= 0; i-- ) {
					    
				var obj = mlist[i];
				var id = obj['_id'];
				
				if( obj['event'] == 'new' ) {
					
					var entry = entries.getOrInsert( obj );
					eqlist.push( entry );
					madd = true;
					
					if( searched( entry ) ) {
						timeline.push( entry );
						sadd = true;
					}
					
				} else if( obj['event'] == 'progress' ) {
		
                    if( id == active )
                        show = true;

					var process = obj['process'][0];
					
					/* TODO: just a workaround to omit duplicated progress events caused by delay concept */
					//if( ! events[id] ) {
						updateProgress( id, process, eqlist.list );
					//}
					
					events[id] = true;
					
				} else if( obj['event'] == 'update' ) {
										
					// insert obj sorted again
					eqlist.remove( obj['id'] );
					eqlist.push( obj );
					
					entries.add( obj );
					madd = true;
					
					if( searched( obj ) ) {
						timeline.push( obj );
						sadd = true;
					}
				}
			}
			
			for ( var i = ulist.length -1; i >= 0; i-- ) {
			    
				var obj = ulist[i];
				var id = obj['_id'];
								
				if( obj['event'] == 'new' ) {
					
					var entry = entries.getOrInsert( obj );
					global.saved.push( entry );
					uadd = true;
					
					if( searched( entry ) ) {
						timeline.push( entry );
						sadd = true;
					}
					
				} else if( obj['event'] == 'progress' ) {
		
                    if( id == active )
                        show = true;

					var process = obj['process'][0];
					updateProgress( id, process, global.saved.list );
					
				} else if( obj['event'] == 'msg_sent' || obj['event'] == 'msg_recv' ) {
					
					obj._id = obj['Message-ID'];
										
					var entry = entries.getOrInsert( obj );
					entry.kind = "msg";
					entry.prop = { date: obj['CreatedTime'] };
					
					messages.push( entry );
					msgadd = true;
				}
			}
			
			if( madd ) {
				showEntries( eqlist );
			}
			
			if( uadd ) {
				showEntries( global.saved );
			}
			
			if( sadd ) {
				showEntries( timeline );
			}
			
			if( msgadd ) {
				showEntries( messages );
			}
			
			if( madd || uadd )
				$( curtab ).click();

            if( show ) {
                
                var filled = entries.get( active )['process'][0]['progress'];
                if( filled == 100 ) {
                    getPois( entries.get( active ), null );
                    getWaveHeights( entries.get( active ) );
                }

                getIsos( entries.get( active ), function() { getUpdates( timestamp ); } );

            } else {

                timerId = setTimeout( function() { getUpdates( timestamp ); }, 1000);
            }

		},
		error: function() {
		},
		complete: function() {
		}
	});
}

function removeMarker( widget ) {
	
	widget.children().each( function() {
		
		if( $(this).data( "entry" ).marker )
			$(this).data( "entry" ).marker.setMap( null );
	});
}

function showEntries( list ) {
	
	var widget = $( list.widget );
	
	removeMarker( widget );
	widget.empty();
		
    var start = Math.min( list.list.length - 1, list.endIdx );
    for( var i = start; i >= list.startIdx; i-- ) {

    	var elem = list.getElem(i);
    	
    	if( elem.kind == "msg" ) {
    		
    		addMsg( widget, elem, i );
    		
    	} else {
    		
    		addEntry( widget, elem, i );
    	}
	}
	
}

function updateProgress( id, process, list ) {

	for( var i = 0; i < list.length; i++ ) {
		
		if( list[i]['_id'] == id ) {
			
			if( list[i]['process'].length == 0 ) {
				list[i]['process'].push( null );
			}
			
			list[i]['process'][0] = process;
			
			var filled = process['progress'];
			
			for( var widget in list[i].div ) {			
								
				var div = list[i].div[widget];
				
				var grid = process['grid_dim'];
				var latMin = grid['latMin'].toFixed(2);
				var lonMin = grid['lonMin'].toFixed(2);
				var latMax = grid['latMax'].toFixed(2);
				var lonMax = grid['lonMax'].toFixed(2);
				
				div.find( '.chk_grid' ).css( 'display', 'inline' );
				div.find( '.status' ).css( 'display', 'none' );
		    	div.find( '.progress-bar' ).css( 'width', filled + "%" );
		    	div.find( '.progress' ).css( 'display', 'block' );
		    	div.find( '.progress-bar' ).css( 'width', filled + "%" );
		    	div.find( '.resource' ).html( process['resources'] );
		    	div.find( '.calc' ).html( 'Runtime ' + process['calcTime'] / 1000 + ' sec &#183; SimDuration ' + process['simTime'] + " min" );
		    	div.find( '.grid' ).html( 'Grid ' + process['resolution'] + '&prime; &#183; BBox (' + latMin + ', ' + lonMin + '), (' + latMax + ', ' + lonMax + ')' ); 
		    	
		    	if( filled == 100 ) {
		    		div.find( '.progress' ).css( 'display', 'none' );
		    		div.find( '.status' ).html( simText['done'] );
		    		div.find( '.status' ).css( 'display', 'inline' );
		    	}	
		    	
			}
		}
	}
}
	    
function zeroPad( num, count ) {
	
	return charPad( num, count, "0" );
}

function charPad( num, count, char ) {

	var str = "";
	
	for( var i = 0; i < count; i++ )
		str += char;
	
	str += num;
	return str.slice( str.length - count );
}

    
function addEntry( widget, data, i ) {
		    	
	var $div = $('#entry').clone();
	var id = $div.attr('id') + i;
	$div.attr('id', id );
	$div.css('display', 'block' );
	
	$div.data( "entry", data );
	
	if( ! data['div'] )
		data['div'] = {};
	
	data['div'][ '#' + widget.attr('id') ] = $div;
	
	var prop = data['prop'];
		
	var date = new Date( prop['date'] );
	var year = date.getUTCFullYear();
	var month = date.getUTCMonth() + 1;
	var day = date.getUTCDate();
	var hour = date.getUTCHours();
	var minutes = date.getUTCMinutes();
	//var seconds = date.getUTCSeconds();
	
	var datestr = year + "/" + zeroPad( month, 2 ) + "/" + zeroPad( day, 2 );
	var timestr = zeroPad( hour, 2 ) + ":" + zeroPad( minutes, 2 ); // + ":" + zeroPad( seconds, 2 );
		    		
	var txtId = data['_id'];
	
	if( data['refineId'] && data['refineId'] > 0 ) {
		$div.find( '.lnkId' ).html( txtId );
		$div.find( '.lnkId' ).bind( 'click', lnkIdOnClick );
		
		txtId = "";
	}
	
	$div.find( '.region' ).text( prop['region'] );
	$div.find( '.mag').text( prop['magnitude'] );
	$div.find( '.datetime' ).html( datestr + " &#183; " + timestr + " UTC" + " &#183; " + txtId );
	$div.find( '.lonlat' ).html( 'Lat ' + prop['latitude'] + '&deg; &#183;  Lon ' + prop['longitude'] + '&deg; &#183;  Depth ' + prop['depth'] + ' km' );
	$div.find( '.dip' ).html( 'Dip ' + prop['dip'] + '&deg; &#183; Strike ' + prop['strike'] + '&deg; &#183; Rake ' + prop['rake'] + '&deg;' );
	
	if( widget.attr('id') == 'sidebar' ) {
		var yearstr = data['_id'].substring(3,7);
		$div.find( '.beach' ).attr( "src", "http://geofon.gfz-potsdam.de/data/alerts/" + yearstr + "/" + data['_id'] + "/bb32.png" );
		$div.find( '.geofon' ).attr( "href", "http://geofon.gfz-potsdam.de/eqinfo/event.php?id=" + data['_id'] );
	} else {
		$div.find( '.geofon' ).css( 'display', 'none' );
	}
		
	$div.find( '.progress' ).css( 'display', 'none' );
	
	if( ! data['process'] ) {
		
		if( ! prop['sea_area'] ) {
			$div.find( '.status' ).html( simText['inland'] );
		} else {
			$div.find( '.status' ).html( simText['no'] );
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
		
	} else if( data['process'].length == 0 ) {
		$div.find( '.status' ).html( simText['prepared'] );
	} else {
		updateProgress( data['_id'], data['process'][0], new Array( data ) );
	}
	
	options = { placement:'top',
				title:'Modify and reprocess',
				container: $div,
				animation: false
		   	   };
	
	$div.find( '.lnkEdit' ).tooltip( options );
	
	options.title = 'Learn more';
	$div.find( '.lnkLearn' ).tooltip( options );
	
	options.title = 'Send message';
	$div.find( '.lnkSend' ).tooltip( options );
	
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
	$div.find( '.lnkSend' ).bind( 'click', mailOnClick );
	
	if( data['marker'] )
		data['marker'].setMap( null );
		
	data['marker'] = addMarker( prop['latitude'], prop['longitude'], new google.maps.MarkerImage( link ) );
	data['marker'].setAnimation( null );
	data['marker'].setMap( null );
		    			    			    	
	widget.prepend( $div );
}

function addMsg( widget, data, i ) {
	
	var $div = $('#msg').clone();
	var id = $div.attr('id') + widget.attr('id') + i;
	$div.attr('id', id );
	$div.css('display', 'block' );
	
	$div.data( "entry", data );
	
	if( ! data['div'] )
		data['div'] = {};
	
	data['div'][ '#' + widget.attr('id') ] = $div;
			
	var date = new Date( data['CreatedTime'] );
	var year = date.getUTCFullYear();
	var month = date.getUTCMonth() + 1;
	var day = date.getUTCDate();
	var hour = date.getUTCHours();
	var minutes = date.getUTCMinutes();
	
	var datestr = year + "/" + zeroPad( month, 2 ) + "/" + zeroPad( day, 2 );
	var timestr = zeroPad( hour, 2 ) + ":" + zeroPad( minutes, 2 );
		    		    		    	
	var dir = data.Dir == "in" ? "Received" : "Sent";
	var cls = "glyphicon msgIcon ";
	
	var color = "gray";
	
	if( data.errors && ! $.isEmptyObject( data.errors ) ) {
		color = "red";
		for( var prop in data.errors )
			console.log( prop );
	}
	
	if( data.Type == "MAIL" ) {
		cls += "glyphicon-envelope";
	} else if( data.Type == "FTP" ) {
		cls += "glyphicon-link";
	} else if( data.Type == "FAX" ) {
		cls += "glyphicon-phone-alt";
	} else if( data.Type == "SMS" ) {
		cls += "glyphicon-phone";
	} else if( data.Type == "INTERNAL" ) {
		
		if( data.Dir == "in" ){
			cls += "glyphicon-bell";
			color = "#428bca";
		} else {
			cls += "glyphicon-share";
		}
	}
	
	$div.find( '.msgIcon').css( "color", color );
	$div.find( '.msgIcon').attr( "class", cls );
	$div.find( '.type').text( data['Type'] );
	$div.find( '.subject' ).text( data['Subject'] );
	$div.find( '.datetime' ).html( datestr + " &#183; " + timestr + " UTC &#183; " + dir );
		
	if( data.ReadTime ) {
		
		date = new Date( data.ReadTime );
		year = date.getUTCFullYear();
		month = date.getUTCMonth() + 1;
		day = date.getUTCDate();
		hour = date.getUTCHours();
		minutes = date.getUTCMinutes();
		
		datestr = year + "/" + zeroPad( month, 2 ) + "/" + zeroPad( day, 2 );
		timestr = zeroPad( hour, 2 ) + ":" + zeroPad( minutes, 2 );
		
		$div.find( '.readtime' ).html( datestr + " &#183; " + timestr );
		
	} else {
		
		$div.find( '.readtime' ).html( "-" );
	}

	$div.find( '.to' ).html( "" );
	
	for( var k = 0; k < data.To.length; k++ ) {
		$div.find( '.to' ).append( data.To[k] + "<br>" );
	}
	
	if( data.Dir == "in" )
		$div.find( '.from' ).html( data['From'] );
	else
		$div.find( '.from' ).html( curuser.username );
	
	$div.bind( 'mouseover', { turnOn: true }, highlight );
	$div.bind( 'mouseout', { turnOn: false }, highlight );
	$div.find( '.subject' ).bind( 'click', msgOnClick );
	
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
			
	var id = $(this).parents( ".entry" ).data( "entry" )['_id'];
			
	if( !loggedIn ) {
		
		signTarget = visualize.bind( this, id );
		$( "#SignInDialog" ).modal("show");
		return;
	}
	
	visualize( id );
}

function visualize( id ) {
	
	var entry = entries.get( id );		
		
        if( active != id ) {

            showWaveHeights( active, false );
            showPolygons( active, false );
            showGrid( active, false );
            showPois( active, false );

            active = id;
		    getWaveHeights( entry );
		    getIsos( entry, null );
		    getPois( entry, null );
		
		    showGrid( active, entry['show_grid'] );
        }

	if( entry['marker'] )
		map.panTo( entry['marker'].position );
}

function highlight( event ) {
		   	
	var turnOn = event.data["turnOn"];
	var entry = $(this).data( "entry" );
	
	if( jQuery.contains( event.currentTarget, event.relatedTarget ) )
		return;
		    	
	if( turnOn ) {
		
		color = '#c3d3e1'; //#99b3cc';
		
		if( entry['marker'] )
			entry['marker'].setAnimation( google.maps.Animation.BOUNCE );
		
	} else {
		
		color = '#fafafa';
		
		if( entry['marker'] )
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
	    	
function getIsos( entry, callback ) {
	
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
    				    strokeColor: '#BF0000',
    				    strokeOpacity: 1.0,
    				    strokeWeight: 1,
    				    zIndex: 100
				  	});
    				
    				polyline.setMap( null );

    				sub.push( polyline );
				}
		
				entry['polygons'][ resultObj['arrT'] ] = sub;
			}
			
            if( active == id )
                showPolygons( id, true );

            if( callback != null )
                callback();
                        
		}
	});
		    	
}

function getWaveHeights( entry ) {
	
	var id = entry['_id'];
				
	if( ! $.isEmptyObject( entry['heights'] ) ) {
                showWaveHeights( id, true );
		return;
        }
	
	$.ajax({
		url: "srv/getWaveHeights",
		data: { "id": id, "process": 0 },
		dataType: 'json',
		success: function( result ) {
			
			for( var i = 0; i < result.length; i++ ) {
				
				var resultObj = result[i];
								
				sub = [];
				
				lines = resultObj['points'];    				
				for( var j = 0; j < lines.length; j++ ) {
					
					points = lines[j];
					coords = [];
    				for( var k = 0; k < points.length; k++ ) {
    					xy = points[k];
    					coords.push( new google.maps.LatLng( xy['d'], xy['e'] ) );
    				}
    				
    				polygon = new google.maps.Polygon({
    				    path: coords,
    				    geodesic: true,
    				    strokeColor: resultObj['color'],
    				    strokeOpacity: 0.5,
    				    fillColor: resultObj['color'],
    				    fillOpacity: 0.8,
    				    zIndex: i
				  	});
    				
    				polygon.setMap( null );

    				sub.push( polygon );
				}
			
				entry['heights'][ resultObj['ewh'] ] = sub;
			}
                        
                        if( active == id )
    			    showWaveHeights( id, true );
		}
	});
		    	
}

function getPois( entry, callback ) {
	
	var id = entry._id;

	if( entry.pois != null ) {
		showPois( id, true );
        return "done";
    }
				
	$.ajax({
		url: "srv/getPois",
		data: { "id": id, "process": 0 },
		dataType: 'json',
		success: function( result ) {
			
			entry.pois = new Array();
			
			if( result.length == 0 )
				return;
						
			for( var i = 0; i < result.length; i++ ) {
				
				var poi = result[i];
				
				var center = new google.maps.LatLng( poi.lat, poi.lon );
				
				var point = { marker: null,
						  	  info: null,
						  	  isOpen: false,
						  	  data: poi
							};
							
				var color = getPoiColor( poi );
				
				point.marker = new google.maps.Marker ({
					position: center,
					map: null,
					icon: {
						path: google.maps.SymbolPath.CIRCLE,
					    fillOpacity: 0.7,
					    fillColor: color,
					    strokeOpacity: 1.0,
					    strokeColor: color,
					    strokeWeight: 2.0,
					    scale: 4 //pixels
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

            if( active == id )
                showPois( id, true );
		},
		complete: function() {
			
			if( callback != null )
                callback();
		}
	});	
	
	return "pending";
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

function getPoiLevel( poi ) {
	
	var level = "WATCH";
	
	if( poi.eta == -1 ) {
		level = "";
	} else if( poi.ewh < 0.75 ) {
		level = "INFORMATION";
	} else if( poi.ewh < 1.5 ) {
		level = "ADVISORY";
	} else if( poi.ewh < 3 ) {
		level = "WATCH";
	} else {
		level = "WATCH";
	}
	
	return level;
}

function showPolygons( pointer, visible ) {
		    	
	if( pointer == null )
		return;
	
	var tmap = null;
	
	if( visible )
		tmap = map;
		
	var entry = entries.get( pointer );

	for( var arrT in entry['polygons'] ) {
		
		polylines = entry['polygons'][arrT];
		
		for( var i = 0; i < polylines.length; i++ ) {
			polylines[i].setMap( tmap );
		}
	}
}

function showWaveHeights( pointer, visible ) {
	
	if( pointer == null )
		return;
	
	var tmap = null;
	
	if( visible )
		tmap = map;
		
	var entry = entries.get( pointer );
	
	for( var ewh in entry['heights'] ) {
		
		polygons = entry['heights'][ewh];
		
		for( var i = 0; i < polygons.length; i++ ) {
			
			polygons[i].setMap( tmap );
		}
	}
}

function showGrid( pointer, visible ) {
		
	if( pointer == null )
		return;
	
	var entry = entries.get( pointer );
	
	if( ! visible ) {
		if( entry['rectangle'] != null ) {
			entry['rectangle'].setMap( null );
			entry['rectangle'] = null;
		}
		return;
	}
		
	if( ! entry['process'] || entry['process'].length == 0 )
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
	
	if( pointer == null )
		return;
	
	var tmap = null;
	
	if( visible ) {
		tmap = map;
		
		if( map.getZoom() < 5 )
			return;
	}
	
	var entry = entries.get( pointer );
	
	for( var i in entry.pois ) {
		
		entry.pois[i].marker.setMap( tmap );
	}
}

function deselect() {
	
	showWaveHeights(active, false);
	showPolygons(active, false);
	showGrid(active, false);
	showPois(active, false);
	
	active = null;
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
				curuser = result.user;
				logIn( null );
			} else {
				getEvents( null );
			}
		},
		error: function() {
		},
		complete: function() {
		}
	});
}

function signIn( user, password ) {
	
	var resObj = null;
	
	$.ajax({
		type: 'POST',
		url: "srv/signin",
		data: { username: user, password: password },
		dataType: 'json',
		success: function( result ) {
			
			resObj = result;
			
			console.log( resObj.status );
		},
		error: function() {
		},
		complete: function() {
			
			if( resObj.status == "success" ) {
				
				/* reset all password and status fields of sign-in widgets */
				$( "#SignInDialog" ).modal("hide");
				$('#diaStatus').html("");
				$('#diaPass').val("");
				$('#inPassword').val("");
				
				curuser = resObj.user;
				logIn( signTarget );
								
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
	
	var user = $('#diaUser').val();
	var password = $('#diaPass').val();

	signIn( user, password );
}

function logIn( callback ) {
	
	loggedIn = true;
	
	$( '.tab-pane' ).css( "top", "6em" );
	
	simText = userText;
	
	delay = 0;
	eqlist.list.length = 0;
	global.saved.reset();
	entries.reset();
	getEvents( callback );
		
	$( "#btnSignIn" ).css( "display", "none" );
	$( "#grpSignOut" ).css( "display", "block" );
	
	$( '.tab-private' ).css( "display", "block" );
}

function signOut() {

	var status = null;
		
	$.ajax({
		type: 'POST',
		url: "srv/signout",
		data: { username: curuser.username },
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
	
	$( '.tab-pane' ).css( "top", "3em" );
	
	simText = defaultText;
		
	$( "#btnSignIn" ).css( "display", "block" );
	$( "#grpSignOut" ).css( "display", "none" );
	
	$( '.tab-private' ).css( "display", "none" );
	
	$( '#tabRecent' ).find('a').trigger('click');
	
	deselect();	
	delay = default_delay;
	eqlist.reset();
	global.saved.reset();
	timeline.reset();
	messages.reset();
	entries.reset();	
	getEvents( null );
}

function compute() {
  
	var params = getParams();
		    	
	$( "#hrefSaved" ).click();
	
	deselect();
	active = null;
	
	$.ajax({
		type: 'POST',
		url: "srv/compute",
		data: params,
		dataType: 'json',
		success: function( result ) {
			active = result['id'];
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
	params['root'] =  $('#inRootId').html();
	params['parent'] =  $('#inParentId').html();
	
	return params;
}

function fillForm( entry ) {
	
	if( !loggedIn ) {
		
		signTarget = fillForm.bind( this, entry );
		$( "#SignInDialog" ).modal("show");
		return;
	}
	
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
	
	$( '#inParentId' ).html( entry['_id'] );
	
	if( entry['root'] ) {
		$( '#inRootId' ).html( entry['root'] );
	} else {
		$( '#inRootId' ).html( entry['_id'] );
	}
		
	checkInput();
	
	$( '#tabCustom' ).find('a').trigger('click');
}

function clearForm() {
	$('#custom :input').val('');
	$('#inRootId').html('');
	$('#inParentId').html('');
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
		
	var entry = $(this).parents('.entry').data('entry');
	fillForm( entry );
}

function mailOnClick( e ) {
		
	var id = $(this).parents( ".entry" ).data( "entry" )['_id'];
	var entry = entries.get( id );
	
	showEmailDialog( entry );
}

function showEmailDialog( entry ) {
			
	if( !loggedIn ) {
		
		signTarget = showEmailDialog.bind( this, entry );
		$( "#SignInDialog" ).modal("show");
		return;
	}
	
	if( getPois( entry, showEmailDialog.bind( this, entry ) ) != "done" )
		return;
		
	var prop = entry.prop;
		
	$( "#mailFrom" ).html( curuser.username );
	$( "#mailTo" ).val( "" );
	$( "#mailCC" ).val( "" );
	$( "#mailSubject" ).val( "Tsunami warning message!" );
	
	var root = entry.root ? entry.root : entry._id;
		
	$( "#mailEvent" ).html( root );
	$( "#mailParent" ).html( entry._id );
	
	$( "#mailDate" ).html( new Date().toISOString() );
	$( "#mailOriginTime" ).html( prop.date );
	$( "#mailCoordinates" ).html( Math.abs( prop.latitude ).toFixed(2) + ( prop.latitude < 0 ? " South" : " North" ) + " ");
	$( "#mailCoordinates" ).append( Math.abs( prop.longitude ).toFixed(2) + ( prop.longitude < 0 ? " West" : " East" ) );
	$( "#mailDepth" ).html( prop.depth );
	$( "#mailLocation" ).html( prop.region );
	$( "#mailMag" ).html( prop.magnitude );
		
	var uprop = curuser.properties;
	var perm = curuser.permissions;
			
	$( "#faxGrp" ).css( "display", (perm && perm.fax) ? "table" : "none" );
	$( "#ftpGrp" ).css( "display", (perm && perm.ftp) ? "table" : "none" );
	
	$( "#faxTo" ).prop( "disabled", ! (uprop && uprop.InterfaxUsername != "" && uprop.InterfaxPassword != "" ) );
	$( "#ftpChk" ).prop( "disabled", ! (uprop && uprop.FtpUser != "" && uprop.FtpPassword ) );
	//$( "#ftpChk" ).prop( "disabled", false );
	
	$( "#ftpTo" ).html( uprop.FtpHost + uprop.FtpPath );
	
	if( entry.pois != null ) {
			
		/* previously iterate once to get maximum length of location names */
		var heads = new Array(
			"LOCATION-FORECAST POINT",
		    "COORDINATES   ",
		    "EAT   ",
		    "EWH  ",
		    "LEVEL       "
		);
		
		var minlen = heads[0].length;
		for( var i = 0; i < entry.pois.length; i++ ) {
			
			var poi = entry.pois[i].data;
		
			if( poi.eta == -1 )
				continue;
			
			minlen = Math.max( minlen, poi.station.length );
		}
				
		var txt = "";
		
		for( var i = 0; i < entry.pois.length; i++ ) {
			
			var poi = entry.pois[i].data;
			
			if( poi.eta == -1 )
				continue;
					
			var pretty_station = poi.station + new Array( minlen - poi.station.length + 1 ).join(" ");
			var pretty_lat = charPad( Math.abs( poi.lat ).toFixed(2), 5, ' ' );
			var pretty_lon = charPad( Math.abs( poi.lon ).toFixed(2), 6, ' ' );
			var pretty_eta = charPad( poi.eta.toFixed(2), 6, ' ' );
			var pretty_ewh = charPad( poi.ewh.toFixed(2), 5, ' ' );
			
			txt += pretty_station + " ";
			txt += pretty_lat + (poi.lat < 0 ? "S" : "N") + " ";
			txt += pretty_lon + (poi.lon < 0 ? "W" : "E") + " ";
			txt += pretty_eta + " ";
			txt += pretty_ewh + " ";
			txt += getPoiLevel( poi ) + "\n<br>";
		}
		
		if( txt != "" ) {
			
			$( "#mailFCPs" ).html( "" );
			for( var k = 0; k < heads.length; k++ )
				$( "#mailFCPs" ).append( heads[k] + " " );
			
			$( "#mailFCPs" ).append( "\n<br>" );
			for( var k = 0; k < heads.length; k++ ) {
				/* generates as many '-' as there are letters in the head string */
				$( "#mailFCPs" ).append( new Array( heads[k].length + 1 ).join("-") + " " );
			}
							
			$( "#mailFCPs" ).append( "\n<br>" + txt );
		}
		
	}
	
	/* SMS text */
	var short_region = prop.region.length < 27 ? prop.region : prop.region.substring( 0, 24 ) + "...";
	var smstext = "...THIS IS AN EXERCISE...\n\n" +
				  "AN EARTHQUAKE HAS OCCURRED:\n\n  " +
				  short_region + "\n  " +
				  prop.date + "\n  " +
				  Math.abs( prop.latitude ).toFixed(2) + ( prop.latitude < 0 ? "S" : "N" ) + " " +
				  Math.abs( prop.longitude ).toFixed(2) + ( prop.longitude < 0 ? "W" : "E" ) + " " + 
				  prop.depth + "KM\n  " +
				  prop.magnitude + " Mw\n\n" +
				  "...EXERCISE...";
	
	if( smstext.length > 160 )
		smstext = smstext.substring( 0, 160 );
	
	$( '#smsChars' ).html( smstext.length );
	$( "#smsText" ).val( smstext );
	
	$( "#mailText" ).val( getPlainText( $( "#mailTemplate" ) ) );	
		
	$( "#EmailDia" ).modal("show");
}

function sendEmail() {
	
	var to = $( "#mailTo" ).val();
	var cc = $( "#mailCC" ).val();
	var intTo = $( "#intTo" ).val();
	var subject = $( "#mailSubject" ).val();
	var faxTo = $( "#faxTo" ).val();
	var smsTo = $( "#smsTo" ).val();
	var smsText = $( "#smsText" ).val();
	
	var parent = $( "#mailParent" ).html();
	var root = $( "#mailEvent" ).html();
	
	var text = getPlainText( $( "#mailTemplate" ) );
		
	// internal message
	$.ajax({
		type: 'POST',
		url: "msgsrv/intmsg",
		data: { apiver: 1, to: intTo, subject: subject, text: text, evid: root, parentid: parent }, 
		dataType: 'json',
		success: function( result ) {
			status = result.status;
			
			console.log( status );
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
	
	// email
	$.ajax({
		type: 'POST',
		url: "msgsrv/mail",
		data: { apiver: 1, to: to, cc: cc, subject: subject, text: text, evid: root, parentid: parent }, 
		dataType: 'json',
		success: function( result ) {
			status = result.status;
			
			console.log( status );
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
	
	// fax
	$.ajax({
		type: 'POST',
		url: "msgsrv/fax",
		data: { apiver: 1, to: faxTo, text: text, evid: root, parentid: parent }, 
		dataType: 'json',
		success: function( result ) {
			status = result.status;
			
			console.log( status );
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
	
	// ftp
	$.ajax({
		type: 'POST',
		url: "msgsrv/ftp",
		data: { apiver: 1, text: text, evid: root, parentid: parent }, 
		dataType: 'json',
		success: function( result ) {
			status = result.status;
			
			console.log( status );
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
	
	// sms
	$.ajax({
		type: 'POST',
		url: "msgsrv/sms",
		data: { apiver: 1, to: smsTo, text: smsText, evid: root, parentid: parent },
		dataType: 'json',
		success: function( result ) {
			status = result.status;
			
			console.log( status );
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
	
}

function getPlainText( span ) {
	
	var lines = span.text().split("\n");
	var text = "";
	
	for( var i = 0; i < lines.length; i++ )
		text += $.trim( lines[i] ) + "\n";
	
	return text;
}

function msgOnClick() {
	
	var id = $(this).parents( ".entry" ).data( "entry" )['_id'];
	var msg = entries.get( id );
			
	visualize( msg.ParentId );
		
	markMsgAsRead( msg );
	
	return;
}

function markMsgAsRead( msg ) {
	
	$.ajax({
		type: 'POST',
		url: "msgsrv/readmsg",
		data: { apiver: 1, msgid: msg['Message-ID'] },
		dataType: 'json',
		success: function( result ) {
			status = result.status;
			
			console.log( status + ": " + result.ReadTime );
			
			if( ! msg.ReadTime )
				msg.ReadTime = result.ReadTime;
			
			showEntries( messages );
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
	
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
		
		var start = Math.min( eqlist.list.length - 1, eqlist.endIdx );
		for( var i = start; i >= eqlist.startIdx; i-- )
			eqlist.getElem(i).marker.setMap( map );
				
	} else {
		
		removeMarker( $('#sidebar') );
	}
	
	if( tab == "saved" ) {
		
		curlist = global.saved;
	
        var start = Math.min( global.saved.list.length - 1, global.saved.endIdx );
		for( var i = start; i >= global.saved.startIdx; i-- ) {
			global.saved.getElem(i).marker.setMap( map );
		}
		
	} else {
		
		removeMarker( $('#saved') );
	}
	
	if( tab == "custom" ) {
		
		curlist = global.saved;
		
		if( global.marker )
			global.marker.setMap( map );
		
	} else {
		
		if( global.marker )
			global.marker.setMap( null );
	}
	
	if( tab == "timeline" ) {
		
		curlist = timeline;
		
		var start = Math.min( timeline.list.length - 1, timeline.endIdx );
		for( var i = start; i >= timeline.startIdx; i-- ) {
			if( timeline.getElem(i).marker )
				timeline.getElem(i).marker.setMap( map );
		}
		
	} else {
		
		removeMarker( $('#timeline-data') );
	}

}

function enableGrid( args ) {
	
	var entry = args.data.entry;
	
	entry['show_grid'] = $(this).is(':checked');
		
	if( active == entry['_id'] )
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

function nextEntries() {

	if( curlist.list.length - 1 <= curlist.endIdx )
		return;
	
	var step = Math.min( curlist.endIdx + 10, curlist.list.length - 1 ) - curlist.endIdx;
	curlist.startIdx += step;
	curlist.endIdx += step;

	showEntries( curlist );
	
	$( curtab ).click();
}

function prevEntries() {
	
	var step = curlist.startIdx - Math.max( curlist.startIdx - 10, 0 );
	curlist.startIdx -= step;
	curlist.endIdx -= step;
	
	showEntries( curlist );
	
	$( curtab ).click();
}

function scrollList() {
	
	var maxValue = $( curlist.widget ).prop('scrollHeight') - $( curlist.widget ).innerHeight();
	var curValue = $( curlist.widget ).scrollTop();
		
	if( curValue == maxValue ) {
		
		var elem = $( curlist.widget ).children().last();
		var top = elem.offset().top;
		var id = elem.data('entry')['_id'];
		
		nextEntries();
		
		elem = entries.get( id )['div'][ curlist.widget ];
		$( curlist.widget ).scrollTop( 0 );
		$( curlist.widget ).scrollTop( elem.offset().top - top );
	}
	
	if( curValue == 0 ) {
		
		var elem = $( curlist.widget ).children().first();
		var top = elem.offset().top;
		var id = elem.data('entry')['_id'];
		
		prevEntries();
		
		elem = entries.get( id )['div'][ curlist.widget ];
		$( curlist.widget ).scrollTop( 0 );
		$( curlist.widget ).scrollTop( elem.offset().top - top );
	}
	
}

function mapZoomed() {
	
	var zoom = map.getZoom();
	
	if( zoom < 5 )
		showPois( active, false );
	
	if( zoom >= 5 )
		showPois( active, true );
}

function searchEvents() {
	
	searchId = $( '#inSearch' ).val();
	
	timeline.reset();
	
	$.ajax({
		type: 'GET',
		url: "srv/search",
		data: { text: searchId },
		dataType: 'json',
		success: function( result ) {
								
			for ( var i = result.length -1; i >= 0; i-- ) {
				
				if( result[i].kind == "msg" )
					result[i]._id = result[i]['Message-ID'];
					
				var entry = entries.getOrInsert( result[i] );
				timeline.push( entry );
			}
					            
			showEntries( timeline );
			
			$( curtab ).click();
		},
		error: function() {
		},
		complete: function() {
		}
	});
	
}

function searched( obj ) {
	
	if( obj.id == searchId || obj.root == searchId || obj.parent == searchId )
		return true;
	
	return false;
}

function lnkIdOnClick() {
		
	var entry = $(this).parents( ".entry" ).data( "entry" );
	
	$( '#inSearch' ).val( entry['id'] );
	$( '#btnSearch' ).click();
	$( "#hrefTimeline" ).click();
}

function showProp() {
	
	var prop = curuser.properties;
	
	$( '#propUser' ).html( curuser.username );
	$( '#propMail' ).html( curuser.username );
	$( '#propFaxUser' ).val( prop.InterfaxUsername );
	$( '#propFaxPwd' ).val( prop.InterfaxPassword );
	$( '#propFTPUser' ).val( prop.FtpUser );
	$( '#propFTPPwd' ).val( prop.FtpPassword );
	$( '#propFTPHost' ).val( prop.FtpHost );
	$( '#propFTPPath' ).val( prop.FtpPath );
	
	$( '#PropDia' ).modal('show');
}

function groupOnClick() {
	
	var content = $(this).parents('.group').children('.grpContent');
	var arrow =  $(this).children('.grpArrow');
			
	content.css( "display", arrow.hasClass( 'glyphicon-chevron-up' ) ? "none" : "inline" );
	
	arrow.toggleClass( 'glyphicon-chevron-up' );
	arrow.toggleClass( 'glyphicon-chevron-down' );
}
