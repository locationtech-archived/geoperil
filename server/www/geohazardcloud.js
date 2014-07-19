var map;

function CustomList( widget, sort ) {
	
   this.list = [];
   this.startIdx = 0;
   this.endIdx = 19;
   this.widget = widget;
   
   this.sort = (typeof sort === "undefined") ? "prop.date" : sort;
   
   this.getElem = function( i ) {
	   return this.list[ this.list.length - i - 1 ];
   };
   
   this.reset = function() {
	   this.list.length = 0;
	   this.startIdx = 0;
	   this.endIdx = 19;
	   
	   $(this.widget).empty();
   };
   
   this.getProp = function( obj, prop ) {
	   
	   var arr = prop.split(".");
	   while( arr.length && ( obj = obj[arr.shift()] ) );
		    
	   return obj;
   };
   
   this.push = function( entry ) {
	   	   								   	   	   
	   var date2 = new Date( this.getProp( entry, this.sort ) );
	   	   	   
	   for( var i = 0; i < this.list.length; i++ ) {
		   
		   var date1 = new Date( this.getProp( this.list[i], this.sort ) );
		   
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
   
   this.remove = function( id, field ) {
	   
	   for( var i = 0; i < this.list.length; i++ ) {
		   
		   if( this.list[i][field] == id ) {
			   this.list.splice(i, 1);
			   break;
          }
	   }
   };
   
   this.removeById = function( baseId ) {
	   	   
	   for( var i = 0; i < this.list.length; i++ ) {
		   
		   if( this.list[i]['id'] == baseId ) {
			   this.list.splice(i, 1);
			   break;
          }
	   }
   };
   
   this.setSort = function( field ) {
	   
	   this.sort = field;
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
			
			entry['arrT'] = 0;
			entry['polygons'] = {};
			entry['rectangle'] = null;
			entry['show_grid'] = false;
			entry['pois'] = null;
			entry['heights'] = {};
		}
		
		return result;
	};
}

var eqlist = new CustomList( '#sidebar' );
var saved = new CustomList( '#saved' );
var timeline = new CustomList( '#timeline-data', 'timestamp' );
var messages = new CustomList( '#messages' );
var shared = new CustomList( '#static' );

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

var share = false;

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

var global = { context: -1 };

var markers = { compose: null,
				active: null
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
	
	/* create default marker used in the "Compose" tab, make it invisible first */
	markers.compose = createDefaultMarker( $('#inLat').val(), $('#inLon').val(), "#E4E7EB" );
	markers.compose.setMap( null );
	markers.active = createDefaultMarker( $('#inLat').val(), $('#inLon').val(), "#5cb85c" );
	markers.active.setMap( null );
			
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
	$( "#splashSignIn" ).click( diaSignIn );
	$( "#propBtnSubmit" ).click( propSubmit );
	
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
	
	$( '#btnDelRoot' ).click( function() { $('#inRootId').html(""); $('#inParentId').html(""); } );
	$( '#btnDelParent' ).click( function() { $('#inRootId').html(""); $('#inParentId').html(""); } );
	$( '#btnDelDate' ).click( function() { $('#inDate').html(""); } );
		
	$( '#EmailDia' ).on('shown.bs.modal', dialogOnDisplay );
	$( '#EmailDia :input' ).val( "" );
	$( '#btnGrpText .btn' ).change( changeMsgText );
		
	$( '#smsText' ).bind('input propertychange', function() {
		$( '#smsChars' ).html( $(this).val().length );
	});
	
	$( '#SignInDialog' ).on('shown.bs.modal', function () {
		
		if( $.cookie('username') ) {
			$( '#diaPass' ).focus();
		} else {
			$( '#diaUser' ).focus();
		}
	});
	
	$( '#diaUser' ).val( $.cookie('username') );
	
	$( window ).resize( onResize );
	
	checkSession();
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
				saved.push( entry );
			}
			
			for ( var i = msglist.length -1; i >= 0; i-- ) {
				
				msglist[i]._id = msglist[i]['Message-ID'];
				
				if( msglist[i]['Dir'] == "in" )
					msglist[i]._id += "_in";
																
				var entry = entries.getOrInsert( msglist[i] );
				entry.kind = "msg";
				entry.prop = { date: msglist[i]['CreatedTime'] };
				messages.push( entry );
				
				var event = entry.event;
				if( event )
					entries.getOrInsert( event );
			}
		            
			showEntries( eqlist );
			
            if( saved.list.length > 0 ) {
				showEntries( saved );
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
					eqlist.removeById( obj['id'] );
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
					saved.push( entry );
					uadd = true;
					
					if( searched( entry ) ) {
						timeline.push( entry );
						sadd = true;
					}
					
				} else if( obj['event'] == 'progress' ) {
		
					/* don't show polygons again if we already display the event with 100% progress */
                    if( id == active /*&& entries.get(id).process[0].progress < 100*/ )
                        show = true;

					var process = obj['process'][0];
					updateProgress( id, process, saved.list );
					
				} else if( obj['event'] == 'msg_sent' || obj['event'] == 'msg_recv' ) {
					
					obj._id = obj['Message-ID'];
					
					if( obj['Dir'] == "in" )
						obj._id += "_in";
															
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
				showEntries( saved );
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

function showMarker( widget ) {
	
	widget.children().each( function() {
		
		if( $(this).data( "marker" ) )
			$(this).data( "marker" ).setMap( map );
	});
	
}

function removeMarker( widget ) {
	
	widget.children().each( function() {
		
		if( $(this).data( "marker" ) )
			$(this).data( "marker" ).setMap( null );
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
    
    select( active );
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
	
//	if( curuser && data['refineId'] && data['refineId'] > 0 ) {
//		$div.find( '.lnkId' ).html( txtId );
//		$div.find( '.lnkId' ).bind( 'click', {id: data.id}, lnkIdOnClick );
//		
//		txtId = "";
//	}
	
	var tid = data._id;
	if( data.root )
		tid = data.root;
	
	$div.find( '.lnkTimeline' ).bind( 'click', { id: tid }, lnkIdOnClick );
	
	$div.find( '.region' ).text( prop['region'] );
	$div.find( '.mag').text( prop['magnitude'] );
	$div.find( '.datetime' ).html( datestr + " &#183; " + timestr + " UTC" + " &#183; " + txtId );
	$div.find( '.lonlat' ).html( 'Lat ' + prop['latitude'] + '&deg; &#183;  Lon ' + prop['longitude'] + '&deg; &#183;  Depth ' + prop['depth'] + ' km' );
	$div.find( '.dip' ).html( 'Dip ' + prop['dip'] + '&deg; &#183; Strike ' + prop['strike'] + '&deg; &#183; Rake ' + prop['rake'] + '&deg;' );
	
	if( widget.attr('id') == 'sidebar' ) {
		var yearstr = data['_id'].substring(3,7);
		$div.find( '.beach' ).attr( "src", "http://geofon.gfz-potsdam.de/data/alerts/" + yearstr + "/" + data['id'] + "/bb32.png" );
		$div.find( '.geofon' ).attr( "href", "http://geofon.gfz-potsdam.de/eqinfo/event.php?id=" + data['id'] );
	} else {
		$div.find( '.geofon' ).css( 'display', 'none' );
	}
		
	$div.find( '.progress' ).css( 'display', 'none' );
	
	$div.find( '.lnkLearn' ).css( "display", "inline" );
	
	var options = { placement:'bottom',
					title:'Info',
					html: true,
					container: $div,
					animation: false
				   };
	
	options.content = "<span style='font-size: 0.8em;'>Currently, we use a rough and simple threshold mechanism to identify the tsunami potential of an earthquake. If the location of the earthquake is inland, deeper than 100km, or has a magnitude less than 5.5 then we don't consider the earthquake for any wave propagation computation. However, if you think the earthquake is relevant for computation then you can do so by using 'Modify and reprocess'. <br><br>Anyhow, in the near future we plan to use an improved mechanism by adopting region dependent decision matrices defined by the UNESCO-IOC ICGs, that is ICG/NEAMTWS, ICG/IOTWS, ICG/PTWS, and ICG/CARIBE EWS.</span>";
	$div.find( '.lnkLearn' ).popover( options );
	
	if( ! data['process'] ) {
		
		if( ! prop['sea_area'] ) {
			$div.find( '.status' ).html( simText['inland'] );
		} else {
			$div.find( '.status' ).html( simText['no'] );
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
	
	options.title = 'Share map';
	$div.find( '.lnkStatic' ).tooltip( options );
	
	options.title = 'Show timeline';
	$div.find( '.lnkTimeline' ).tooltip( options );
	
	var color = getMarkerColor( prop['magnitude'] );
			
	if( checkPerm( "share" ) )
		$div.find( '.lnkStatic' ).css( "display", "inline" );
	
	if( checkPerm( "comp" ) )
		$div.find( '.lnkEdit' ).css( "display", "inline" );
	
	if( checkPermsAny( "intmsg", "mail", "fax", "ftp", "sms" ) )
		$div.find( '.lnkSend' ).css( "display", "inline" );
	
	if( checkPerm( "timeline" ) )
		$div.find( '.lnkTimeline' ).css( "display", "inline" );
	
	if( curuser != null && id_equals( curuser._id, data.user ) ) {
		
		color = '#E4E7EB';
		
		if( widget.attr('id') != 'static' ) {
			$div.find( '.lnkDelete' ).css( "display", "inline" );
			$div.find( '.lnkDelete' ).bind( 'click', deleteEntry );
			
			options.title = 'Delete entry';
			$div.find( '.lnkDelete' ).tooltip( options );
		}
	}
	
	var link = getMarkerIconLink( i + 1, color );
			
	$div.find( '.marker' ).attr( 'src', link );
		    	
	$div.bind( 'mouseover', { turnOn: true }, highlight );
	$div.bind( 'mouseout', { turnOn: false }, highlight );
	$div.find( '.region' ).bind( 'click', entryOnClick );
	$div.bind( 'contextmenu', { show: true }, context );
	$div.find( '.chk_grid' ).bind( 'click', { entry: data }, enableGrid );
	$div.find( '.lnkEdit' ).bind( 'click', fillCustomForm );
	$div.find( '.lnkSend' ).bind( 'click', mailOnClick );
	$div.find( '.lnkStatic' ).bind( 'click', shareOnClick );
	
	if( $div.data( "marker" ) )
		$div.data( "marker" ).setMap( null );
		
	$div.data( "marker", addMarker( prop['latitude'], prop['longitude'], new google.maps.MarkerImage( link ) ) ); 
	$div.data( "marker" ).setAnimation( null );
	$div.data( "marker" ).setMap( null );
			    			    			    	
	widget.prepend( $div );
}

function id_equals( id1, id2 ) {
		
	var fields = [ "_time", "_machine", "_inc", "_new" ];
	
	for( i in fields )
		if( id1[ fields[i] ] != id2[ fields[i] ] )
			return false;
			
	//return ( id1.toSource() == id2.toSource() );
	return true;
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
	
	var color = "#5cb85c";
	var type = "";
	var info = "Message sent successfully";
	
	if( data.errors && ! $.isEmptyObject( data.errors ) ) {
		color = "#d9534f";
		info = "Errors occured while sending";
//		for( var prop in data.errors )
//			console.log( prop );
	}
	
	if( data.Type == "MAIL" ) {
		cls += "glyphicon-envelope";
		type = "Mail";
	} else if( data.Type == "FTP" ) {
		cls += "glyphicon-link";
		type = "FTP";
	} else if( data.Type == "FAX" ) {
		cls += "glyphicon-phone-alt";
		type = "Fax";
	} else if( data.Type == "SMS" ) {
		cls += "glyphicon-phone";
		type = "SMS";
	} else if( data.Type == "INTERNAL" ) {
		
		if( data.Dir == "in" ){
			cls += "glyphicon-bell";
			if( ! data.ReadTime || ! data.MapDisplayTime )
				//color = "#428bca";
				color = "#FF8000"; 
		} else {
			cls += "glyphicon-cloud";
		}
		type = "Cloud";
	}
	
	if( data.Dir == "in" ) {
		
		if( data.ReadTime ) {
			
			var str = getDateString( new Date( data.ReadTime ) );
			$div.find( '.stat-read' ).html( "Message read on " + str );
			$div.find( '.stat-read' ).css( "display", "inline" );
		}
		
		if( data.MapDisplayTime ) {
			
			var str = getDateString( new Date( data.MapDisplayTime ) );
			$div.find( '.stat-disp' ).html( "Map displayed on " + str );
			$div.find( '.stat-disp' ).css( "display", "inline" );
		}
	
	} else {
		
		$div.find( '.stat-read' ).html( info );
		$div.find( '.stat-disp' ).css( "display", "none" );
	}
	
	$div.find( '.msgIcon').css( "color", color );
	$div.find( '.msgIcon').attr( "class", cls );
	$div.find( '.msgType').text( type );
	$div.find( '.subject' ).text( data['Subject'] );
	$div.find( '.datetime' ).html( dir + " &#183; " + datestr + " &#183; " + timestr + " UTC &#183; ");
	$div.find( '.lnkEvtId' ).html( data['ParentId'] );
	$div.find( '.to' ).html( data.To[0] );
	
	for( var k = 1; k < data.To.length; k++ ) {
		$div.find( '.to' ).append( ", " + data.To[k] );
	}
	
	if( data.Cc ) {
		
	
		$div.find( '.cc' ).html( data.Cc[0] );
	
		for( var k = 1; k < data.Cc.length; k++ ) {
			$div.find( '.c' ).append( ", " + data.Cc[k] );
		}
		
	} else {
		
		$div.find( '.cc-row' ).css( "display", "none" );
	}
	
	if( data.Dir == "in" )
		$div.find( '.from' ).html( data['From'] );
	else
		$div.find( '.from' ).html( curuser.username );
	
	$div.bind( 'mouseover', { turnOn: true }, highlight );
	$div.bind( 'mouseout', { turnOn: false }, highlight );
	$div.find( '.subject' ).bind( 'click', msgOnClick );
	
	options = { placement:'top',
				title:'Show message',
				container: $div,
				animation: false
	   	   	  };

	$div.find( '.lnkMsg' ).tooltip( options );

	options.title = 'Delete message';
	$div.find( '.lnkDelete' ).tooltip( options );
	
	options.title = 'Show timeline';
	$div.find( '.lnkTimeline' ).tooltip( options );
	
//	options.title = '<span style="font-size: 0.9em;">Delete entry?</span>';
//	options.container = 'body';
//	options.placement = 'bottom';
//	options.html = true;
//	options.content =
//		'<button type="button" class="btn btn-sm btn-primary pull-right">Yes</button>' +
//		'<button type="button" class="btn btn-sm btn-default pull-left">No</button>';
//	$div.find( '.lnkDelete' ).popover( options );
	
	$div.find( '.lnkMsg' ).bind( 'click', showMsg );
	$div.find( '.lnkDelete' ).bind( 'click', deleteEntry );
	
	$div.find( '.lnkDelete' ).css( "display", "inline" );
	
	var entry = entries.get( data['ParentId'] );
	if( entry ) {
		
		var tid = entry.id;
		
		if( entry.root )
			tid = entry.root;
		
		//$div.find( '.lnkEvtId' ).bind( 'click', { id: entry.id }, lnkIdOnClick );
		$div.find( '.lnkTimeline' ).bind( 'click', { id: tid }, lnkIdOnClick );
	}
	
	if( checkPerm( "timeline" ) )
		$div.find( '.lnkTimeline' ).css( "display", "inline" );
	
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
	
	var entry = $(this).parents( ".entry" ).data( "entry" );
	var id = entry['_id'];
		
	/* allow external events (e.g. a shared link) to be displayed without the need to sign in */
	if( !entry.extern && !loggedIn ) {
		
		signTarget = visualize.bind( this, id );
		$( "#SignInDialog" ).modal("show");
		return;
	}
		
	visualize( id );
}

function visualize( id ) {
		
	var entry = entries.get( id );
	
	setMarkerPos( markers.active, entry.prop.latitude, entry.prop.longitude );
	markers.active.setMap( map );
	
    if( active != id ) {

        showWaveHeights( active, false );
        showPolygons( active, false );
        showGrid( active, false );
        showPois( active, false );

        deselect( active );
        select( id );
        
	    getWaveHeights( entry );
	    getIsos( entry, null );
	    getPois( entry, null );
	
	    showGrid( active, entry['show_grid'] );
    }

	map.panTo( markers.active.getPosition() );
}

function highlight( event ) {
		   	
	var turnOn = event.data["turnOn"];
	var marker = $(this).data( "marker" );
		
	if( jQuery.contains( event.currentTarget, event.relatedTarget ) )
		return;
			    	
	if( turnOn ) {
		
		color = '#c3d3e1'; //#99b3cc';
		
		if( marker )
			marker.setAnimation( google.maps.Animation.BOUNCE );
		
	} else {
		
		color = '#fafafa';
		
		if( marker )
			marker.setAnimation( null );
	}
	
	if( $(this).data( "entry" )._id == active )
		return;
	
	$(this).css('background-color', color);
}

function addMarker( lat, lon, icon ) {
		
    // create new marker on selected position
    return new google.maps.Marker( { position: new google.maps.LatLng( lat, lon ), map: map, icon: icon, zIndex: 1} );
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

function getNextMsgNr( entry, callback ) {
	
	var id = entry.root ? entry.root : entry._id;
	
	var msgnr = 1;
	
	$.ajax({
		type: 'POST',
		url: "srv/getNextMsgNr",
		data: { "rootid": id },
		dataType: 'json',
		success: function( result ) {
						
			if( result.status == "success" ) {
				
				msgnr = result.NextMsgNr;
				
			} else {
				console.log( "Error: Unable to get next message number." );
			}
		},
		complete: function() {
			
			if( callback != null )
	            callback( msgnr );
		}
	});
	
	return 0;
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
				
				var center = new google.maps.LatLng( poi.lat_real, poi.lon_real );
				
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
					    strokeColor: "white",
					    strokeWeight: 1.5,
					    scale: 5 //pixels
						}
					});
				
				var txt = "<b>" + poi.code + "</b><br>";
				
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

function select( id ) {
	
	if( id == null )
		return;
	
	active = id;
	
	var entry = entries.get( active );
	
	if( entry )
		for( var key in entry.div ) {
			entry.div[key].css( "border-left", "8px solid #C60000" );
			entry.div[key].css( "background-color", "#c3d3e1" );
		}
}

function deselect() {
		
	showWaveHeights(active, false);
	showPolygons(active, false);
	showGrid(active, false);
	showPois(active, false);
	
	if( markers.active ) markers.active.setMap( null );
	
	var entry = entries.get( active );
	
	if( entry )
		for( var key in entry.div ) {
			entry.div[key].css( "background-color", "#fafafa" );
			entry.div[key].css( "border-left", "0px" );
		}
	
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
				showSplash( true );
				getEvents( null );
				checkStaticLink();
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
				$('#splashStatus').html("");
				
				curuser = resObj.user;
				logIn( signTarget );
								
			} else {

				/* set status to error and clear password fields */
				$('#diaStatus').html("Login failed!");
				$('#splashStatus').html("Login failed!");
				$('#drpStatus').html("Login failed!");
			}
			
			$('#diaPass').val("");
			$('#splashPass').val("");
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
		
	var parentId = $( this ).attr('id');
	
	var user = "";
	var password = "";
	
	if( parentId == "diaSignIn" ) {
	
		user = $('#diaUser').val();
		password = $('#diaPass').val();
		
	} else if( parentId == "splashSignIn" ) {
		
		user = $('#splashUser' ).val();
		password = $('#splashPass' ).val();
	}
	
	$.cookie( 'username', user );
	
	signIn( user, password );
}

function logIn( callback ) {
	
	loggedIn = true;
	
	showSplash( false );
		
	simText = userText;
		
	deselect();
	
	delay = 0;
	eqlist.list.length = 0;
	saved.reset();
	entries.reset();
	getEvents( callback );
		
	$( "#btnSignIn" ).css( "display", "none" );
	$( "#grpSignOut" ).css( "display", "block" );
	
	$( '.tab-private' ).css( "display", "block" );
	
	if( ! checkPerm("comp") ) {
		$( '#tabCustom' ).css( "display", "none" );
		$( '#tabSaved' ).css( "display", "none" );
	}
	
	if( ! checkPermsAny( "intmsg", "mail", "fax", "ftp", "sms" ) ) {
		$( '#tabMessages' ).css( "display", "none" );
	}
	
	if( ! checkPerm("timeline") ) {
		$( '#tabTimeline' ).css( "display", "none" );
	}
	
	onResize();
		
	shared.reset();
	checkStaticLink();
	
	configMailDialog();
	
	$( '#lnkUser' ).html( curuser.username );
	$( '#lnkUser' ).css( "display", "block" );
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
	
	showSplash( true );
	
	simText = defaultText;
		
	$( "#btnSignIn" ).css( "display", "block" );
	$( "#grpSignOut" ).css( "display", "none" );
	
	$( '.tab-private' ).css( "display", "none" );
	onResize();
	
	$( '#tabRecent' ).find('a').trigger('click');
		
	deselect();
	delay = default_delay;
	eqlist.reset();
	saved.reset();
	timeline.reset();
	messages.reset();
	entries.reset();	
	getEvents( null );
	
	shared.reset();
	checkStaticLink();
	
	$( '#lnkUser' ).html( "" );
	$( '#lnkUser' ).css( "display", "none" );
}

function compute() {
  
	var params = getParams();
		    	
	$( "#tabSaved" ).css( "display", "block" );
	$( "#hrefSaved" ).click();
	
	deselect();
	
	$.ajax({
		type: 'POST',
		url: "srv/compute",
		data: params,
		dataType: 'json',
		success: function( result ) {
			select( result['_id'] );
			map.panTo( new google.maps.LatLng( params.lat, params.lon ) );
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
	
	if( $('#inDate').html() != "" )
		params['date'] =  $('#inDate').data( "dateObj" ).toISOString();
	
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
	
	var date = new Date( prop['date'] );
	$( '#inDate' ).html( getDateString( date ) );
	$( '#inDate' ).data( "dateObj", date );
		
	checkInput();
	
	$( '#tabCustom' ).css( "display", "block" );
	$( '#tabCustom' ).find('a').trigger('click');
}

function clearForm() {
	$('#custom :input').val('');
	$('#inRootId').html('');
	$('#inParentId').html('');
	$('#inDate').html('');
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

function showEmailDialog( entry, msgnr ) {
				
	if( !loggedIn ) {
		
		signTarget = showEmailDialog.bind( this, entry );
		$( "#SignInDialog" ).modal("show");
		return;
	}
		
	if( getPois( entry, showEmailDialog.bind( this, entry ) ) != "done" )
		return;
	
	if( ! msgnr ) {
		getNextMsgNr( entry, showEmailDialog.bind( this, entry ) );
		return
	}
	
	$( ".mailNumber" ).html( zeroPad( msgnr, 3 ) );
		
	var prop = entry.prop;
		
	$( "#mailFrom" ).html( curuser.username );
	$( "#mailTo" ).val( "" );
	$( "#mailCC" ).val( "" );
	$( "#mailSubject" ).val( "Tsunami warning message!" );
	
	var root = entry.root ? entry.root : entry._id;
		
	$( "#mailEvent" ).html( root );
	$( "#mailParent" ).html( entry._id );
	
	var originTime = new Date( prop.date );
	
	$( "#mailDate" ).html( toMsgDateFormat( new Date() ) );
	$( "#mailOriginTime" ).html( toMsgDateFormat( originTime ) );
	$( "#mailCoordinates" ).html( Math.abs( prop.latitude ).toFixed(2) + ( prop.latitude < 0 ? " SOUTH" : " NORTH" ) + " ");
	$( "#mailCoordinates" ).append( Math.abs( prop.longitude ).toFixed(2) + ( prop.longitude < 0 ? " WEST" : " EAST" ) );
	$( "#mailDepth" ).html( prop.depth );
	$( "#mailLocation" ).html( prop.region );
	$( "#mailMag" ).html( prop.magnitude );
			
	if( entry.pois != null ) {
			
		/* previously iterate once to get maximum length of location names */
		var heads = new Array(
			"LOCATION-FORECAST POINT",
		    "COORDINATES   ",
		    "ARRIVAL TIME",
		    //"EWH  ",
		    "LEVEL       "
		);
		
		var headlens = new Array( heads.length );
		for( var i = 0; i < heads.length; i++ )
			headlens[i] = heads[i].length;
				
		var minlen = heads[0].length;
		for( var i = 0; i < entry.pois.length; i++ ) {
			
			var poi = entry.pois[i].data;
		
			if( poi.eta == -1 )
				continue;
			
			var poi_name = poi.country + "-" + poi.name;
			
			minlen = Math.max( minlen, poi_name.length );
		}
		
		headlens[0] = minlen;
				
		var TFPs = { "INFORMATION": new Array(),
					 "WATCH": new Array(),
					 "ADVISORY": new Array()
				   };
		
		var region_map = { "INFORMATION": new Array(),
						   "WATCH": new Array(),
						   "ADVISORY": new Array(),
						   "ALL": new Array()
						  };
		
		for( var i = 0; i < entry.pois.length; i++ ) {
			
			var poi = entry.pois[i].data;
						
			if( poi.eta == -1 )
				continue;
			
			var poi_name = poi.country + "-" + poi.name;
					
			var pretty_station = poi_name + new Array( minlen - poi_name.length + 1 ).join(" ");
			var pretty_lat = charPad( Math.abs( poi.lat_real ).toFixed(2), 5, ' ' );
			var pretty_lon = charPad( Math.abs( poi.lon_real ).toFixed(2), 6, ' ' );
			//var pretty_ewh = charPad( poi.ewh.toFixed(2), 5, ' ' );
			var level = getPoiLevel( poi );
			
			var min = Math.floor( poi.eta );
			var sec = Math.floor( (poi.eta % 1) * 60.0 );
			
			var eta_ms = (min * 60 + sec) * 1000;
			var pretty_eta = toMsgDateFormat( new Date( originTime.getTime() + eta_ms ) );
			pretty_eta = pretty_eta.split(' ', 3).join(' ');
						
			var txt = "";
			txt += pretty_station + " ";
			txt += pretty_lat + (poi.lat_real < 0 ? "S" : "N") + " ";
			txt += pretty_lon + (poi.lon_real < 0 ? "W" : "E") + " ";
			txt += withPadding( pretty_eta, headlens[2], " " ) + " ";
			//txt += pretty_ewh + " ";
			txt += level + "\n<br>";
			
			TFPs[ level ].push( txt );
									
			region_map[ level ].push( poi.country );
			region_map[ "ALL" ].push( poi.country );
		}
		
		TFPs["WATCH"].sort();
		TFPs["ADVISORY"].sort();
		
		subtract( region_map[ "INFORMATION" ], region_map[ "WATCH" ] );
		subtract( region_map[ "INFORMATION" ], region_map[ "ADVISORY" ] );
										
		if( TFPs["WATCH"].length > 0 ||  TFPs["ADVISORY"].length > 0 ) {
			
			$( "#mailFCPs" ).html( "" );
			for( var k = 0; k < heads.length; k++ )
				$( "#mailFCPs" ).append( withPadding( heads[k], headlens[k], " " ) + " " );
			
			$( "#mailFCPs" ).append( "\n<br>" );
			for( var k = 0; k < heads.length; k++ ) {
				/* generates as many '-' as there are letters in the head string */
				$( "#mailFCPs" ).append( withPadding( "", headlens[k], "-" ) + " " );
			}
						
			$( "#mailFCPs" ).append( "\n<br>" + TFPs["WATCH"].join("") );
			$( "#mailFCPs" ).append( "\n<br>" + TFPs["ADVISORY"].join("") );
		}

		printRegionList( getUniqueList( region_map[ "INFORMATION" ] ), $("#mailInfoList") );
		printRegionList( getUniqueList( region_map[ "WATCH" ] ), $("#mailWatchList") );
		printRegionList( getUniqueList( region_map[ "ADVISORY" ] ), $("#mailAdvisoryList") );
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
	
	changeMsgText();
	
	$( "#EmailDia" ).modal("show");
}

function changeMsgText() {
	
	var kind = "info";
	kind = $('#btnTextInfo').is(':checked') ? "info" : kind;
	kind = $('#btnTextEnd').is(':checked') ? "end" : kind;
	kind = $('#btnTextCancel').is(':checked') ? "cancel" : kind;
	
	var subject = { "info": "Tsunami Information/Watch/Advisory",
					"end": "Tsunami End",
					"cancel": "Tsunami Cancelation"	
				   };
		
	var number = parseInt( $( ".mailNumber" ).html(), 10 );
	
	var inst = "";
	
	if( curuser.inst )
		inst = curuser.inst.msg_name;
	
	$( "#mailSubject" ).val( subject[ kind ] );
	$( ".mailProvider" ).html( inst );
		
	$( ".mailOngoing" ).html( "" );
	$( ".mailEndOf" ).html( "" );
	
	var msgText = "";
			
	if( kind == "info" ) {
		
		if( number > 1 )
			$( ".mailOngoing" ).html( " ONGOING" );
				
		msgText += getPlainText( $( "#mailProlog" ) );
				
		if( ! $("#mailWatchList").is(':empty') )
			msgText += getPlainText( $( "#mailWatchSum" ) );
		
		if( ! $("#mailAdvisoryList").is(':empty') )
			msgText += getPlainText( $( "#mailAdvisorySum" ) );
		
		if( ! $("#mailInfoList").is(':empty') && number == 1 )
			msgText += getPlainText( $( "#mailInfoSum" ) );
		
		msgText += getPlainText( $( "#mailAdvice" ) );
		msgText += getPlainText( $( "#mailEqParams" ) );
				
		if( ! $("#mailWatchList").is(':empty') )
			msgText += getPlainText( $( "#mailWatchEval" ) );
		
		if( ! $("#mailAdvisoryList").is(':empty') )
			msgText += getPlainText( $( "#mailAdvisoryEval" ) );
		
		if( ! $("#mailInfoList").is(':empty') && number == 1 )
			msgText += getPlainText( $( "#mailInfoEval" ) );
		
		if( ! $("#mailFCPs").is(':empty') )
			msgText += getPlainText( $( "#mailTFPs" ) );
		
		msgText += getPlainText( $( "#mailSuppl" ) );
		msgText += getPlainText( $( "#mailEpilog" ) );
	
	} else if( kind == "end" ) {
		
		$( ".mailEndOf" ).html( "END OF " );
		
		msgText += getPlainText( $( "#mailProlog" ) );
		
		if( ! $("#mailWatchList").is(':empty') )
			msgText += getPlainText( $( "#mailWatchSum" ) );
		
		if( ! $("#mailAdvisoryList").is(':empty') )
			msgText += getPlainText( $( "#mailAdvisorySum" ) );
		
		msgText += getPlainText( $( "#mailAdvice" ) );
		msgText += getPlainText( $( "#mailEqParams" ) );
		
		if( ! $("#mailWatchList").is(':empty') )
			msgText += getPlainText( $( "#mailWatchEval" ) );
		
		if( ! $("#mailAdvisoryList").is(':empty') )
			msgText += getPlainText( $( "#mailAdvisoryEval" ) );
		
		msgText += getPlainText( $( "#mailFinal" ) );
		msgText += getPlainText( $( "#mailEpilog" ) );
		
	} else if( kind == "cancel" ) {
		
		$( ".mailOngoing" ).html( " CANCELLATION" );
		
		msgText += getPlainText( $( "#mailProlog" ) );
		
		if( ! $("#mailWatchList").is(':empty') )
			msgText += getPlainText( $( "#mailWatchSum" ) );
		
		if( ! $("#mailAdvisoryList").is(':empty') )
			msgText += getPlainText( $( "#mailAdvisorySum" ) );
		
		if( ! $("#mailInfoList").is(':empty') )
			msgText += getPlainText( $( "#mailInfoSum" ) );
		
		msgText += getPlainText( $( "#mailAdvice" ) );
		msgText += getPlainText( $( "#mailEqParams" ) );
		
		if( ! $("#mailWatchList").is(':empty') )
			msgText += getPlainText( $( "#mailWatchEval" ) );
		
		if( ! $("#mailAdvisoryList").is(':empty') )
			msgText += getPlainText( $( "#mailAdvisoryEval" ) );
		
		if( ! $("#mailInfoList").is(':empty') )
			msgText += getPlainText( $( "#mailInfoEval" ) );
		
		msgText += getPlainText( $( "#mailFinal" ) );
		msgText += getPlainText( $( "#mailEpilog" ) );
	}
		
	/* reset height to 0 and make text-area resize with content */
	$( "#mailText" ).outerHeight( 0 );
	$( "#mailText" ).val( msgText );
	
	/* set height of text area according to content height */
	dialogOnDisplay();
}

function withPadding( text, len, char ) {
	
	if( len - text.length < 0 )
		return text;
		
	return text + new Array( len - text.length + 1 ).join( char );
}

function printRegionList( list, span ) {
			
	span.html("");
	
	for( var i = 0; i < list.length; i++ ) {
		span.append( " " + list[i] );
		if( i < list.length - 1 )
			span.append( " ..." );
	}
	
}

/* modifies list in place */
function subtract( list, sub ) {
	
	var i = list.length - 1;
	
	while( i-- >= 0 ) {
		for( var j in sub ) {
		
			if( list[i] == sub[j] )
				list.splice( i, 1 );
		}		
	}
}

function sendEmail() {
	
	var to = $( "#mailTo" ).val();
	var cc = $( "#mailCC" ).val();
	var intTo = $( "#intTo" ).val();
	var subject = $( "#mailSubject" ).val();
	var faxTo = $( "#faxTo" ).val();
	var ftpChk = $( "#ftChk" ).val();
	var smsTo = $( "#smsTo" ).val();
	var smsText = $( "#smsText" ).val();
	
	var parent = $( "#mailParent" ).html();
	var root = $( "#mailEvent" ).html();
	
	var msgnr = parseInt( $( ".mailNumber" ).html(), 10 ) + 1;
	
	var endmsg = $('#btnTextEnd').is(':checked');
	var cancelmsg = $('#btnTextCancel').is(':checked');
	
	if( endmsg || cancelmsg )
		msgnr = 1;
		
	var text = $( "#mailText" ).val();
	
	var sent = false;
		
	if( intTo != "" ) {
		// internal message
		console.log( "Sent internal message!" );
		sent = true;
		
		$.ajax({
			type: 'POST',
			url: "msgsrv/intmsg",
			data: { apiver: 1, to: intTo, subject: subject, text: text, evid: root, parentid: parent, msgnr: msgnr }, 
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
	
	if( to != "" || cc != "" ) {
		// email
		console.log( "Sent email!" );
		sent = true;
		
		$.ajax({
			type: 'POST',
			url: "msgsrv/mail",
			data: { apiver: 1, to: to, cc: cc, subject: subject, text: text, evid: root, parentid: parent, msgnr: msgnr }, 
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
	
	if( faxTo != "" ) {
		// fax
		console.log( "Sent fax!" );
		sent = true;
		
		$.ajax({
			type: 'POST',
			url: "msgsrv/fax",
			data: { apiver: 1, to: faxTo, text: text, evid: root, parentid: parent, msgnr: msgnr }, 
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
	
	if( ftpChk == true ) {
		// ftp
		console.log( "Published on FTP-Server!" );
		sent = true;
		
		$.ajax({
			type: 'POST',
			url: "msgsrv/ftp",
			data: { apiver: 1, text: text, evid: root, parentid: parent, msgnr: msgnr }, 
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
	
	if( smsTo != "" ) {
		// sms
		console.log( "Sent sms!" );
		sent = true;
		
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
	
	if( sent == true ) {
		
		$( "#tabMessages a" ).click();
		$( '#EmailDia' ).modal('hide');
		
	} else {
		
		options = { content: "Please specify at least one receiver and click again!", title:"Info", trigger: 'manual', placement: 'top' }; 
		$( "#mailBtnSend" ).popover(options);
		$( "#mailBtnSend" ).popover('show');
		//$( ".popover-title" ).append('<button type="button" class="close" aria-hidden="true">&times;</button>');
		setTimeout( function() { $( "#mailBtnSend" ).popover('hide'); }, 3000);
	}
}

function getPlainText( span ) {
	
	/* get plain text without html markups - remove leading and trailing newlines */
	var plain = span.text().replace(/^\s+|\s+$/g, '');
	var lines = plain.split("\n");
	var text = "";
	
	/* remove leading and trailing spaces */
	for( var i = 0; i < lines.length; i++ )
		text += $.trim( lines[i] ) + "\n";
	
	return text + "\n";
}

function msgOnClick() {
	
	var id = $(this).parents( ".entry" ).data( "entry" )['_id'];
	var msg = entries.get( id );
			
	visualize( msg.ParentId );
		
	markMsgAsDisplayed( msg );
	
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
						
			if( ! msg.ReadTime )
				msg.ReadTime = result.readtime;
			
			showEntries( messages );
			showEntries( timeline );
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
	
}

function markMsgAsDisplayed( msg ) {
	
	$.ajax({
		type: 'POST',
		url: "msgsrv/displaymapmsg",
		data: { apiver: 1, msgid: msg['Message-ID'] },
		dataType: 'json',
		success: function( result ) {
			status = result.status;
						
			if( ! msg.MapDisplayTime )
				msg.MapDisplayTime = result.mapdisplaytime;
			
			showEntries( messages );
			showEntries( timeline );
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
    
	    setMarkerPos( markers.compose, $('#inLat').val(), $('#inLon').val() );
	}
}

function createDefaultMarker( lat, lon, color ) {
	
	var link = getMarkerIconLink( "%E2%80%A2", color );
	marker = addMarker( lat, lon, new google.maps.MarkerImage( link ) );
	marker.setZIndex( 100 );
	
	return marker;
}

function setMarkerPos( marker, lat, lon ) {
	
	marker.setPosition( {lat: Number(lat), lng: Number(lon) } );
}

function tabChanged( args ) {
	
	var tab = args.data.tab;
			
	curtab = "#" + $(this).attr('id');
			
	if( tab == "recent" ) {
		
		curlist = eqlist;
		showMarker( $('#sidebar') );
				
	} else {
		
		removeMarker( $('#sidebar') );
	}
	
	if( tab == "saved" ) {
		
		curlist = saved;
		showMarker( $('#saved') );
		
	} else {
		
		removeMarker( $('#saved') );
	}
	
	if( tab == "custom" ) {
		
		curlist = saved;
		
		markers.compose.setMap( map );
		
	} else {
		
		markers.compose.setMap( null );
	}
	
	if( tab == "timeline" ) {
		
		curlist = timeline;
		showMarker( $('#timeline-data') );
		
	} else {
		
		removeMarker( $('#timeline-data') );
	}
	
	if( tab == "messages" ) {
		
		curlist = messages;
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
		setMarkerPos( markers.compose, $('#inLat').val(), $('#inLon').val() );
	} else {
		markers.compose.setMap(null);
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
	
	deselect();
	removeMarker( $('#timeline-data') );
	timeline.reset();
	
	$.ajax({
		type: 'POST',
		url: "srv/search",
		data: { text: searchId },
		dataType: 'json',
		success: function( result ) {
								
			for ( var i = result.length -1; i >= 0; i-- ) {
								
				if( result[i].kind == "msg" )
					result[i]._id = result[i]['Message-ID'];
				
				if( result[i]['Dir'] == "in" )
					result[i]._id += "_in";
					
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
	
	if( searchId == null )
		return false;
	
	if( obj.id == searchId || obj.root == searchId || obj.parent == searchId )
		return true;
	
	return false;
}

function lnkIdOnClick( args ) {
	$( '#inSearch' ).val( args.data.id );
	$( '#btnSearch' ).click();
	$( "#hrefTimeline" ).click();
}

function showProp() {
	
	var prop = curuser.properties;
	var perm = curuser.permissions;
		
	/* clear all input fields to avoid displaying old data from another user! */
	$( '#PropDia :input' ).val( "" );
	
	$( '#propUser' ).html( curuser.username );
	
	if( checkPermsAny( "fax", "ftp", "sms" ) ) {
	
		/* hide all groups first */
		$( '#PropDia .group' ).css( "display", "none" );
		
		if( perm.fax && perm.fax == true )
			$( '#propGrpFax' ).css( "display", "block" );
		
		if( perm.ftp && perm.ftp == true )
			$( '#propGrpFtp' ).css( "display", "block" );
		
		if( perm.sms && perm.sms == true )
			$( '#propGrpSms' ).css( "display", "block" );
			
		if( prop ) {
			$( '#propFaxUser' ).val( prop.InterfaxUsername );
			$( '#propFaxPwd' ).val( prop.InterfaxPassword );
			$( '#propFTPUser' ).val( prop.FtpUser );
			$( '#propFTPPwd' ).val( prop.FtpPassword );
			$( '#propFTPHost' ).val( prop.FtpHost );
			$( '#propFTPPath' ).val( prop.FtpPath );
			$( '#propSmsSID' ).val( prop.TwilioSID );
			$( '#propSmsToken' ).val( prop.TwilioToken );
			$( '#propSmsFrom' ).val( prop.TwilioFrom );
		}
	
		$( '#propTabMsgs' ).css( "display", "block" );
		
	} else {
		
		$( '#propTabMsgs' ).css( "display", "none" );
	}
	
	if( checkPerm("manage") ) {
		
		var inst = curuser.inst;
		
		if( inst ) {
			$( '#propInstName' ).val( inst.descr );
			$( '#propInstMsgName' ).val(  inst.msg_name);
		}
		
		$( '#propTabInst' ).css( "display", "block" );
		
	} else {
		$( '#propTabInst' ).css( "display", "none" );
	}
	
	$( '#PropDia' ).modal('show');
}

function groupOnClick() {
		
	var content = $(this).parents('.group').children('.grpContent');
	var arrow =  $(this).children('.grpArrow');
			
	content.css( "display", arrow.hasClass( 'glyphicon-chevron-up' ) ? "none" : "inline" );
	
	arrow.toggleClass( 'glyphicon-chevron-up' );
	arrow.toggleClass( 'glyphicon-chevron-down' );
}

function configMailDialog() {
	
	$( '.lnkGroup' ).click( groupOnClick );
	
	/* hide all groups first */
	$( '#EmailDia .group' ).css( "display", "none" );
	$( '#msgEvents' ).css( "display", "block" );
	
	var perm = curuser.permissions;
	
	if( ! perm )
		return;
	
	//var fax = perm.fax && prop && prop.InterfaxUsername && prop.InterfaxPassword;
	//var ftp = perm.ftp && prop && prop.FtpUser && prop.FtpHost && prop.FtpPath && prop.FtpPassword;
	//var sms = perm.sms && prop && prop.TwilioSID && prop.TwilioToken && prop.TwilioFrom;
	var fax = checkPerm( "fax" );
	var ftp = checkPerm( "ftp" );
	var sms = checkPerm( "sms" );
	
	if( perm.intmsg )
		$( '#msgCloud' ).css( "display", "block" );
	
	if( perm.mail )
		$( '#msgMail' ).css( "display", "block" );
	
	if( fax )
		$( '#msgFax' ).css( "display", "block" );
	
	if( ftp )
		$( '#msgFtp' ).css( "display", "block" );
	
	if( perm.intmsg || perm.mail || fax || ftp )
		$( '#msgText' ).css( "display", "block" );
	
	if( sms )
		$( '#msgSMS' ).css( "display", "block" );
			
	// set default behavior of mail dialog
	$( '.lnkGroup' ).click();
	$( '#msgMail .lnkGroup' ).click();
	$( '#msgText .lnkGroup' ).click();
}

/* this functions takes a variable number of arguments */
function checkPermsAny() {
	
	var result = false;
	
	for( var i = 0; i < arguments.length; i++ ) {
		result = result || checkPerm( arguments[i] );
	}
	
	return result;
}

function checkPerm( type ) {
		
	if( ! curuser )
		return false;
	
	var perm = curuser.permissions;
	var prop = curuser.properties;
	
	if( ! perm )
		return false;
	
	if( type == "fax" )
		return perm.fax && prop
						&& checkProp( prop.InterfaxUsername )
						&& checkProp( prop.InterfaxPassword );
	
	if( type == "ftp" )
		return perm.ftp && prop 
						&& checkProp( prop.FtpUser )
						&& checkProp( prop.FtpHost )
						&& checkProp( prop.FtpPath )
						&& checkProp( prop.FtpPassword );
	
	if( type == "sms" )
		return perm.sms && prop
						&& checkProp( prop.TwilioSID )
						&& checkProp( prop.TwilioToken )
						&& checkProp( prop.TwilioFrom );
	
	return perm[ type ];
}

function checkProp( prop ) {
	return prop && prop != "";
}

function propSubmit() {

	var curpwd = $( '#propCurPwd' ).val();
	var newpwd = $( '#propNewPwd' ).val();
	var confpwd = $( '#propConfPwd' ).val();
	
	var prop = { "InterfaxUsername": $( '#propFaxUser' ).val(),
				 "InterfaxPassword": $( '#propFaxPwd' ).val(),
				 "FtpUser": $( '#propFTPUser' ).val(),
				 "FtpPassword": $( '#propFTPPwd' ).val(),
				 "FtpHost": $( '#propFTPHost' ).val(),
				 "FtpPath": $( '#propFTPPath' ).val(),
				 "TwilioSID": $( '#propSmsSID' ).val(),
				 "TwilioToken": $( '#propSmsToken' ).val(),
				 "TwilioFrom": $( '#propSmsFrom' ).val()
				};

	var inst = { "descr": $( '#propInstName' ).val(),
			 	 "msg_name": $( '#propInstMsgName' ).val(),
		       };
				
	$( '#propStatus' ).html("");
	
	if( newpwd != confpwd ) {
		$( '#propStatus' ).html("Error: The given passwords differ.");
		return;
	}
	
	var data = { prop: JSON.stringify( prop ),
				 inst: JSON.stringify( inst )
	   			};
	
	if( newpwd != "" || curpwd != "" ) {
		data.curpwd = curpwd;
		data.newpwd = newpwd;
	}
		
	$( '#propBtnSubmit' ).html( '<i class="fa fa-spinner fa-spin fa-lg"></i><span class="pad-left">Save</span>' );
	
	$.ajax({
		type: 'POST',
		url: "srv/changeProp",
		data: data,
		dataType: 'json',
		success: function( result ) {

			if( result.status == "success" ) {
				curuser = result.user;
				$( '#PropDia' ).modal("hide");
			} else {
				$( '#propStatus' ).html("Error: " + result.error);
			}
		},
		error: function() {
		},
		complete: function() {
		}
	});
	
	$( '#propBtnSubmit' ).html( '<span>Save</span>' );
}

function deleteEntry() {
	
	var entry = $(this).parents( ".entry" ).data( "entry" );
	
	var id = entry._id;
	var type = "";
	
	var eid = id;
	
	if( entry.kind == "msg" ) {
				
		if( entry.Dir == "in" ) {
			id = id.slice( 0, -3 );
			type = "msg_in";
		} else {
			type = "msg_out";
		}
		
		eid = entry.ParentId;
	}
		
	$.ajax({
		type: 'POST',
		url: "srv/delete",
		data: { id: id, type: type },
		dataType: 'json',
		success: function( result ) {

			if( result.status == "success" ) {
				
				if( eid == active )
					deselect();
				
				curlist.remove( entry._id, '_id' );
				showEntries( curlist );
			}
		},
		error: function() {
		},
		complete: function() {
		}
	});
	
}

function showMsg() {
	
	var msg = $(this).parents( ".entry" ).data( "entry" );
	var text = msg.Text;
	
	markMsgAsRead( msg );
	
	$( '#msgDiaText' ).html( text );
	$( '#showTextDia' ).modal('show');
}

function getDateString( date ) {
	
	var year = date.getUTCFullYear();
	var month = date.getUTCMonth() + 1;
	var day = date.getUTCDate();
	var hour = date.getUTCHours();
	var minutes = date.getUTCMinutes();
	
	var datestr = year + "/" + zeroPad( month, 2 ) + "/" + zeroPad( day, 2 );
	var timestr = zeroPad( hour, 2 ) + ":" + zeroPad( minutes, 2 );
	
	return datestr + " &#183; " + timestr;
}

function toMsgDateFormat( date ) {
	
	var months = [ "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC" ];
	var HH = zeroPad( date.getUTCHours(), 2);
	var mm = zeroPad( date.getUTCMinutes(), 2);
	var dd = zeroPad( date.getUTCDate(), 2 );
	var MMM = months[ date.getUTCMonth() ];
	var yyyy = date.getUTCFullYear();
	
	var datestr = HH + "" + mm + "Z" + " " + dd + " " + MMM + " " + yyyy;
	
	return datestr;
}

// from the MDN
function getPageVar( sVar ) {
	return unescape(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + escape(sVar).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}

function checkStaticLink() {
	
	var lnkId = getPageVar( "share" );
	
	if( ! lnkId || lnkId == "" )
		return;
	
	toggleCloudButton();
	
	share = true;
	
	showSplash( false );
	
	$( '.tab-private' ).css( "display", "none" );
	$( '#tabRecent' ).css( "display", "none" );
	
	$( '#tabStatic' ).css( "display", "inline" );
	$( '#tabStatic a' ).click();
	
	onResize();
		
	$.ajax({
		type: 'POST',
		url: "srv/getShared",
		data: { lnkid: lnkId },
		dataType: 'json',
		success: function( res ) {

			if( res.status == "success" ) {
				deselect();
				var entry = entries.getOrInsert( res.eq );
				entry.extern = true;
				shared.push( entry );
				showEntries( shared );
								
				visualize( res.eq._id );
				//map.panTo( { lat: Number(res.pos.lat), lng: Number(res.pos.lon) } );
				//map.setZoom( res.pos.zoom );
			}
		},
		error: function() {
		},
		complete: function() {
		}
	});
}

function shareOnClick() {
	
	var entry = $(this).parents( ".entry" ).data( "entry" );
	
	createStaticLink( entry );
}

function createStaticLink( entry ) {
	
	if( !loggedIn ) {
		
		signTarget = createStaticLink.bind( this, entry );
		$( "#SignInDialog" ).modal("show");
		return;
	}

	var id = entry._id;
	
	var pos = map.getCenter();
	
	$.ajax({
		type: 'POST',
		url: "srv/staticLnk",
		data: { id: id, lon: pos.lng(), lat: pos.lat(), zoom: map.getZoom() },
		dataType: 'json',
		success: function( result ) {

			if( result.status == "success" ) {
				var lnkKey =  result.key;				
				//var link = window.location.origin + window.location.pathname + "?share=" + lnkKey;
				var link = getURL() + "?share=" + lnkKey;
				var link_enc = encodeURIComponent( link );
				$( '#sharedLnk' ).html( link );
				$( "#lnkTwitter" ).attr("href", "http://twitter.com/home?status=" + link_enc );
				$( "#lnkGplus" ).attr("href", "https://plus.google.com/share?url=" + link_enc );
				$( "#lnkFace" ).attr("href", "http://www.facebook.com/share.php?u=" + link_enc );
				$( '#shareDia' ).modal('show');
			}
		},
		error: function() {
			console.log( "#error" );
		},
		complete: function() {
		}
	});
}

function toggleCloudButton() {
	
	if( loggedIn ) {
		
		$( '#btnDeselect span' ).removeClass( 'glyphicon-globe' );
		$( '#btnDeselect span' ).addClass( 'glyphicon-cloud-upload' );
		
		$( '#btnDeselect' ).unbind('click');
		$( '#btnDeselect' ).click( reload );
		$( '#btnDeselect' ).data('bs.tooltip').options.title = "Back to Cloud";
		
	} else {
		
		$( '#btnDeselect span' ).addClass( 'glyphicon-globe' );
		$( '#btnDeselect span' ).removeClass( 'glyphicon-cloud-upload' );
		
		$( '#btnDeselect' ).unbind('click');
		$( '#btnDeselect' ).click( deselect );
		$( '#btnDeselect' ).data('bs.tooltip').options.title = "Deselect and show map only";
	}
}

function dialogOnDisplay() {
	
	/* we must make the textarea visible first before the height can be read */
	var display = $( '#msgText .grpContent' ).css( "display" );
	$( '#msgText .grpContent' ).css( "display", "inline" );
	
	var h = $( "#mailText" )[0].scrollHeight;
    $( "#mailText" ).outerHeight( h );
    
    $( '#msgText .grpContent' ).css( "display", display );
    
    /* we must make the textarea visible first before the height can be read */
    var hidden = $( '#msgSMS .grpContent' ).css( "display" ) == "none";
    if( hidden )
    	$( '#msgSMS .lnkGroup' ).click();
    
    h = $( "#smsText" )[0].scrollHeight;
    $( "#smsText" ).outerHeight( h );
    
    if( hidden )
    	$( '#msgSMS .lnkGroup' ).click();
	
}

function onResize() {
	
	/* check if fullscreen */
	if( window.screenTop == 0 && window.screenY == 0 )
		return;
	
	/* adjust anything that was dynamically sized */
	var h = $( '.tabs-head' ).css( "height" );
	$( '.tab-pane' ).css( "top", h );
	
	var width = $( "#splash-video" ).width();
	var height = width * 0.5625;
	
	//$( "#youtube" ).attr( "width", width );
	//$( "#youtube" ).attr( "height", height );
	
	/* force a reload of the iframe that displays the youtube video */
	//$( "#youtube" )[0].src = $( "#youtube" )[0].src;
	
	$( "#splash-login" ).height( height );
	$( "#splash" ).css( "min-height", height );
	
	var iframe = '<iframe id="youtube" width="' + width + '" height="' + height + '" src="//www.youtube.com/embed/6xFJZzWNi7o?rel=0" frameborder="0" allowfullscreen></iframe>';
	
	$( "#splash-video" ).html( iframe );
	
	google.maps.event.trigger( map, 'resize' );
}

function getURL() {
	
	var url;
	
	// remove trailing '#' first
	url = window.location.href.replace(/\#$/, "");
	url = url.replace(/\?.*/, "");
	
	return url;
}

function reload() {
	window.location.href = getURL();
}

/* list must be sorted */
function getUniqueList( list ) {
	
	if( list.length == 0 )
		return list;
	
	var sort = list.sort();
	var unique = [sort[0]];
	
    for( var i = 1; i < sort.length; i++ ) {
        if( sort[i-1] !== sort[i] ) {
        	unique.push( sort[i] );
        }
    }
    	
    return unique;
}

function showSplash( show ) {
		
	$( "#splash" ).css( "display", show ? "block" : "none" );
	$( ".mainview" ).css( "display", show ? "none" : "block" );
	
	if( show == true ) {
		
		if( $.cookie('username') ) {
			
			$('#splashUser').val( $.cookie('username') );
			$('#splashPass').focus();
			
		} else {
			
			$('#splashUser').focus();
		}
		
	}
	
	onResize();
	
	map.setCenter( new google.maps.LatLng(0,0) );
}
