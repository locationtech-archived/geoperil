var map;

function CustomList( widget, sortFun ) {
	
   this.list = [];
   this.startIdx = 0;
   this.endIdx = 19;
   this.widget = widget;
   
   this.sortFun = (typeof sortFun === "undefined") ? sort_date : sortFun;
   
   this.setSortFun = function( sortFun ) {
		this.sortFun = sortFun;
	};
   
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
	   	   								   	   	   	   	   	   
	   for( var i = 0; i < this.list.length; i++ ) {
		   
		   if( this.sortFun( entry, this.list[i] ) == -1 ) {
			   
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

function Earthquake( meta ) {
	
	this.stations = null;
	
	/* add all attributes of the passed meta object to this object - be careful to not override existing fields */
	$.extend( this, meta );
	
	this.loadStations = function() {
				
		/* nothing to do if stations were already loaded */
		if( this.stations != null ) {
			this.showStations();
			return;
		}
				
		/* get list of stations from server - could be restricted to effected stations */
		getStationList( this.loadStationData.bind( this ) );
	};
	
	/* will be called asynchronously as soon as the server request, that returns the station list, has completed */
	this.loadStationData = function( result ) {
		
		if( ! result )
			return;
		
		var lat = this.prop.latitude;
		var lon = this.prop.longitude;
		
		/* create new container that holds all the stations */
		this.stations = new Container( 'name', sort_dist.bind( this, lat, lon ) );
		
		/* instantiate each station accordingly and add it to the data container */
		var list = result.stations;
		for( var i = 0; i < list.length; i++ ) {
											
			var stat = new Station( list[i], this );
			stat.load();
			this.stations.insert( stat );
		}
				
		this.showStations();
	};
	
	this.showStations = function() {
		/* TODO: this is really not the right place here, but how to make it cleaner? */
		stationView.setData( this.stations );
		stationView.enableLines( $( '#stat-chk' ).is(':checked') );
		stationSymbols.setData( this.stations );
	};
	
	this.hasCompParams = function() {
		var p = this.prop;
		var ret = p.latitude && p.longitude && p.depth && p.magnitude && p.dip && p.strike && p.rake;
		return ret;
	};
	
	this.getAccel = function() {
		
		var ret = 1;
		
		/* TODO: this is for compatibility reasons only - can be removed in future releases */
		if( this.process && this.process.length > 0 && this.process[0].accel )
			ret = this.process[0].accel;
		
		if( this.accel )
			ret = this.accel;
		
		return ret;
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
		
		var result = this.map[ entry['_id'] ] = new Earthquake( entry );
		
		result['arrT'] = 0;
		result['polygons'] = {};
		result['rectangle'] = null;
		result['show_grid'] = false;
		result['pois'] = null;
		result['heights'] = {};
		
		return result;
	};
	
	this.get = function( id ) {
		return this.map[ id ];
	};
	
	this.getOrInsert = function( entry ) {
		
		var result = this.map[ entry['_id'] ];
				
		if( ! result )
			return this.add( entry );
		
		return result;
	};
}

function Container( key, sortFun ) {
	
	this.map = {};
	this.list = [];
	this.sortFun = sortFun;
	
	this.length = function() {
		return this.list.length;
	};
	
	this.get = function( i ) {
		return this.list[i];
	};
	
	this.insert = function( item ) {
		
		this.map[ item[ key ] ] = item;
		
		for( var i = 0; i < this.list.length; i++ ) {
		   
		   if( this.sortFun( item, this.list[i] ) == -1 ) {
			   
			   this.list.splice( i, 0, item );
			   return;
		   }
	   }
	   
	   this.list.push( item );
	};
	
	this.clear = function() {
		this.list.length = 0;
	};
	
	this.sort = function() {
		
		this.list.sort( this.sortFun );
	};
	
	this.setSortFun = function( sortFun ) {
		
		this.sortFun = sortFun;
	};
	
	this.print = function() {
		
		for( var i = 0; i < this.list.length; i++ ) {
			
			console.log( this.list[i] );
		}
	};
}

function Station( meta, eq ) {
		
	/* these are constant fields that should not change during the lifetime of this object */
	this.eq = eq;
	this.range = 0; 
	this.startTime = null;
	this.endTime = null;
	
	/* dynamic fields */
	this.active = false;
	this.curLiveTime = null;
	this.curSimTime = null;
	
	this.noup = 0;
	this.noupMax = 1;
		
	/* one table that holds the live data */
	this.table1 = new google.visualization.DataTable();
	this.table1.addColumn('datetime', 'Date');
	this.table1.addColumn('number', 'Live-Data');
	
	/* another table to hold the simulation data */
	this.table2 = new google.visualization.DataTable();
	this.table2.addColumn('datetime', 'Date');
	this.table2.addColumn('number', 'Sim-Data');
		
	/* and the final table that is either just a reference to the first table or arises from joining both upper tables */
	this.table = this.table1;
	
	/* treat data as UTC */
	this.formatter = new google.visualization.DateFormat( { timeZone: 0 } );
	
	this.updateHandler = [];
	
	this.pickData = null;
	
	this.profile1 = { stime: 0, etime: 0 };
	this.profile2 = { stime: 0, etime: 0 };
	
	/* add all attributes of the passed meta object to this object - be careful to not override existing fields */
	$.extend( this, meta );
		
	/* start fetching the data */
	this.load = function() {
				
		if( ! this.eq ) {
			
			/* no event selected */
			 						
			/* set start time 180 minutes prior to the current server time */
			this.range = 180 * 60 * 1000;
			this.startTime = new Date( serverTime.getTime() - this.range );
			this.endTime = null;
						
		} else {
			
			/* there is a selected event */
			this.noupMax = 2;			
									
			/* set range to 375 minutes - 15m prior to the origin time and 360m afterwards  */
			this.prior = 15 * 60 * 1000;
			this.range = this.prior + 360 * 60 * 1000;
			this.startTime = new Date( new Date( this.eq.prop.date ).getTime() - this.prior );
			this.endTime = new Date( this.startTime.getTime() + this.range );
			
			this.curSimTime = this.startTime;
			
			//this.fetchSimData( 1, true );
		}
				
		this.curLiveTime = this.startTime;
		//this.update( 15, true );
	};
	
	this.setPickData = function( pickData ) {
		this.pickData = pickData;
	};
	
	this.activate = function() {
		
		if( this.active )
			return false;
		
		this.active = true;
				
		if( this.eq )
			this.fetchSimData( 1, true );
		
		this.update( 15, true );
		
		return true;
	};
	
	this.deactivate = function() {
		this.active = false;
	};
	
	/* most of the time this method will be called asynchronously via setTimeout */
	this.update = function( interval, reactivated ) {
				
		/* check if the station is active; that is, we want to get updates */
		if( ! this.active )
			return;
		
		console.log("update");
		
		var data = { station: this.name,
					 start: this.curLiveTime.toISOString(),
					 inst: !checkPerm("vsdb") ? "gfz_ex_test" : curuser.inst.name
				    };
		
		/* append the end time only if it is explicitly given */
		if( this.endTime != null )
			data.end = this.endTime.toISOString();
		
		this.profile1.stime = Date.now();
		$.ajax({
			type: 'POST',
			url: "webguisrv/getdata",
			dataType: 'json',
			data: data,
			success: (function( result ) {
				
				//console.log( this.name, ": Fetched", result.data.length, "live values in", Date.now() -  this.profile1.stime, "ms");
				
				//console.log( result );
				
				/* remove all elements that are out of range now - only relevant if no event selected */
				if( ! this.eq ) {
					var lbound = new Date( serverTime.getTime() - this.range );
					var outs = this.table1.getFilteredRows( [{column: 0, maxValue: lbound}] );
					this.table1.removeRows( 0, outs.length );
				}
				
				if( result.data.length > 0 ) {
									
					/* add new data to the live data table */
					for( var i = 0; i < result.data.length; i++ ) {
						this.table1.addRow( [ new Date( result.data[i][0] ), Number( result.data[i][1] ) ] );
					}
					
					/* if an event is selected, join with the simulation data to create the final table */
					if( this.eq ) {
						this.profile1.stime = Date.now();
						this.table = google.visualization.data.join( this.table1, this.table2, 'full', [[0,0]], [1], [1] );
						console.log( this.name, ": Joined", result.data.length, "live values in", Date.now() -  this.profile1.stime, "ms");
					}
					
					/* update private start time for next call */
					if( result.last )
						this.curLiveTime = new Date( result.last * 1000 );
					
					/* if the data has changed, notify everyone who is interested */
					console.log( this.name, "live notifyUpdate" );
					this.notifyUpdate();
					
				} else if( reactivated ) {
					
					/* nothing has changed after re-activating, inform listeners about that */
					console.log( this.name, "live notifyNoUpdate" );
					this.notifyNoUpdate();
				}
				
				/* call update again after 'interval' seconds */
				setTimeout( this.update.bind(this, interval), interval * 1000 );
				
			}).bind(this)
		});
	};
	
	this.fetchSimData = function( interval, reactivated ) {
								
		/* check if the station is active; that is, we want to get updates */
		if( ! this.active )
			return;
		
		var data = { station: this.name,
					 start: this.curSimTime.toISOString(),
					 end: this.endTime.toISOString(),
					 evid: this.eq._id
				    };
		
		/* is there still anything to fetch? */
		if( this.curSimTime >= this.endTime ) {
			if( reactivated )
				/* nothing has changed after re-activating, inform listeners about that */
				console.log( this.name, "sim notifyNoUpdate" );
				this.notifyNoUpdate();
			return;
		}
		
		this.profile2.stime = Date.now();
		$.ajax({
			type: 'POST',
			url: "webguisrv/getsimdata",
			dataType: 'json',
			data: data,
			success: (function( result ) {
				
				//console.log( this.name, ": Fetched", result.data.length, "sim values in", Date.now() -  this.profile2.stime, "ms");
					
				if( result.data.length > 0 ) {
										
					/* add new data to the simulation data table */
					for( var i = 0; i < result.data.length; i++ ) {
						this.table2.addRow( [ new Date( result.data[i][0] ), Number( result.data[i][1] ) ] );
					}
					
					/* join the simulation with the live data to create the final table */
					this.profile2.stime = Date.now();
					this.table = google.visualization.data.join( this.table1, this.table2, 'full', [[0,0]], [1], [1] );
					//console.log( this.name, ": Joined", result.data.length, "sim values in", Date.now() -  this.profile2.stime, "ms");
					
					/* update start time for next call */
					if( result.last )
						this.curSimTime = new Date( result.last * 1000 );
					
					/* notify everyone who is interested */
					console.log( this.name, "sim notifyUpdate" );
					this.notifyUpdate();
					
				} else if( reactivated ) {
					
					/* nothing has changed after re-activating, inform listeners about that */
					console.log( this.name, "sim notifyNoUpdate" );
					this.notifyNoUpdate();
				}
								
				/* call update again after 'interval' seconds */
				setTimeout( this.fetchSimData.bind(this, interval), interval * 1000 );
				
			}).bind(this)
		});
	};

	/* register handler and return the index into the array */
	this.setOnUpdateListener = function( handler ) {
		for( var i = 0; i < this.updateHandler.length; i++ )
			if( ! this.updateHandler[i] ) {
				this.updateHandler[i] = handler;
				return i;
			}
				
		return this.updateHandler.push( handler ) - 1;
	};
	
	/* remove a registered handler specified by the corresponding index */
	this.removeOnUpdateListener = function( idx ) {
		this.updateHandler[idx] = null;
	};
	
	this.notifyUpdate = function() {
		/* treat values in DataTable as UTC dates */
		this.formatter.format( this.table, 0 );
		
		/* inform anyone interested */
		for( var i = 0; i < this.updateHandler.length; i++ )
			if( this.updateHandler[i] )
				this.updateHandler[i]();
	};
	
	/* this method is used to inform all listeners that the diagram did not change after activating and
	 * thus the loading overlay can be removed */
	this.notifyNoUpdate = function() {
		
		if( ++this.noup == this.noupMax ) {
			this.notifyUpdate();
			this.noup = 0;
		}
	};
}

function Chart( data, width, height ) {
	
	this.data = data;
	this.div = $( '#chart-div' ).clone().removeAttr( "id" );
	this.dia = null;
		
	this.div.height( height );
	this.div.width( width );
	
	this.handler = null;
	
	this.profile = { stime: 0 };
			
	this.options = {
		curveType: 'function',
		width: width,
		height: height,
		interpolateNulls: true,
		legend: { position: 'none' }
	};
	
	this.listenerID = null;
	
	this.init = function( data ) {
		
		/* make sure that a chart has never more than one listener registered */
		this.dispose();
		
		this.data = data;
		
		/* register handler that will be called if the underlying station data changes */
		this.listenerID =
			this.data.setOnUpdateListener( (function(_this) {
				return function() {
					_this.refresh();
				};
			} )(this) );
				
		this.options.title = data.name;		
	};
	
	this.refresh = function() {
		
		/* get x-range that should be used when displaying the chart */
		var xmin = this.data.eq ? this.data.startTime : new Date(serverTime - this.data.range);
		var xmax = this.data.eq ? this.data.endTime : serverTime;
				
		if( this.data.eq ) {
			var range = this.data.endTime.getTime() - this.data.startTime.getTime();
			xmin = new Date( this.data.startTime.getTime() + this.data.prior - this.data.prior / this.data.eq.getAccel() );
			xmax = new Date( this.data.startTime.getTime() + range / this.data.eq.getAccel() );
		}
		
		/* set 5 ticks on x-axis explicitly */
		var ticks = [];
		var parts = [0.0, 0.25, 0.5, 0.75, 1.0];
		for( var i = 0; i < parts.length; i++ ) {
			/* because Google Charts does not support displaying the x-axis in UTC time,
			 * specify tick labels explicitly */
			var tick = new Date( xmin.getTime() + (xmax.getTime() - xmin.getTime()) * parts[i] );
			var hours = (tick.getHours() + 24 + tick.getTimezoneOffset() / 60) % 24;
			ticks.push( { v:tick, f: zeroPad(hours, 2) + ':' + zeroPad( tick.getMinutes(), 2) } );
		}
		
		/* update hAxis */
		this.options.hAxis = {
			viewWindow: {
				min: xmin,
				max: xmax
			},
			ticks: ticks
		};
		
		this.profile.stime = Date.now();
		
		this.div.css('display','none');
		
		/* lazy one time initialization */
		if( this.dia == null ) {
			this.dia = new google.visualization.LineChart( this.div.find('.dia')[0] );
			google.visualization.events.addListener( this.dia, 'ready', this.ready.bind(this) );
		}
		
		this.dia.draw( this.data.table, this.options );
		this.div.css('display','inline-block');
	};
	
	this.ready = function() {
		console.log("Chart", this.data.name, "drawn in", Date.now() - this.profile.stime, "ms");
		this.div.find('.spanLoad').css('display','none');
	};
	
	this.dispose = function() {
				
		if( this.listenerID != null )
			this.data.removeOnUpdateListener( this.listenerID );
		
		this.listenerID = null;
	};
		
	this.registerMouseListener = function( handler ) {
		this.handler = handler;
	};
	
	this.chartOnEnter = function() {
		
		this.div.css( "outline", "2px solid #428bca" );
		
		if( this.handler )
			this.handler('enter');
	};
	
	this.chartOnLeave = function() {
		
		this.div.css( "outline", "1px solid #acaaa7" );
		
		if( this.handler )
			this.handler('leave');
	};
	
	this.chartOnClick = function() {
				
		if( this.handler )
			this.handler('click');
	};
		
	/* check if the chart is visible inside the scroll pane */
	this.isVisible = function() {
		var left = this.div.parent().offset().left;
		var right = this.div.parent().offset().left + this.div.parent().width();
		return this.div.offset().left + this.div.width() > left && this.div.offset().left < right;
	};
	
	/* display loading overlay */
	this.setLoading = function() {
		this.div.find('.spanInactive').css('display','none');
		this.div.find('.spanLoad').css('display','block');
	};
	
	this.div.hover( this.chartOnEnter.bind(this), this.chartOnLeave.bind(this) );
	this.div.click( this.chartOnClick.bind(this) );
	
	this.init( this.data );
}

function MainChartDialog( widget ) {
	
	this.dialog = widget;
	this.chart = new MainChart( $( '#mainchart-div' ), 500, 400 );
	this.data = null;
	
	this.multi = 0;
	
	/* hide picker by default */
	this.picker = false;
	$('#picker .lnkGroup span').removeClass("glyphicon-chevron-up");
	$('#picker .lnkGroup span').addClass("glyphicon-chevron-down");
	$('#picker .grpContent').css( "display", "none");
	
	this.show = function( data ) {
		this.data = data;
		
		/* toggle view depending on earthquake selection */
		if( this.data.eq ) {
			widget.find('.spanHead').show();
			widget.find('.spanNoPick').hide();
			$('#pickerEnable').prop('disabled', false);
			$('#picker').show();
		} else {
			widget.find('.spanHead').hide();
			widget.find('.spanNoPick').show();
			$('#pickerEnable').prop('disabled', true);
			$('#picker').hide();
		}
				
		this.dialog.modal( 'show' );		
	};
	
	this.hide = function() {
		this.dialog.modal( 'hide' );
	};
	
	/* this method will be called if the dialog is ready */
	this.ready = function() {
		this.chart.init( this.data );
		this.chart.setOnSlideListener( 0, this.onAmplSliderChange.bind(this) );
		this.chart.setOnSlideListener( 1, this.onFreqSliderChange.bind(this) );
		this.chart.setOnSlideListener( 2, this.onFreqSliderChange.bind(this) );
		this.chart.showSliders( this.picker );
		
		this.loadFormData();
	};
	
	this.onClose = function() {
		this.saveFormData();
	};
	
	this.onAmplSliderChange = function() {
		$('#pickerAmpl').val( this.chart.getSliderValue(0).toFixed(2) );
		this.updatePreview();
	};
	
	this.onFreqSliderChange = function() {
		var freq = Math.abs( this.chart.getSliderValue(1) - this.chart.getSliderValue(2) );
		freq = freq / 1000.0 / 60.0;
		$('#pickerFreq').val( freq.toFixed(2) );
		this.setTotalFreq();
	};
	
	this.onFreqInputChange = function( val ) {
		this.setTotalFreq();
	};
	
	this.onAmplInputChange = function( val ) {
		this.chart.setSliderValue(0, $('#pickerAmpl').val());
	};
		
	this.onMultiplierChange = function( e ) {
		var elem = $(e.delegateTarget);
		$('#pickerDropDown button span').first().text( elem.text() );
		this.multi = elem.parent().index();
		this.setTotalFreq();
	};
	
	this.setTotalFreq = function() {
		var multi = $('#pickerDropDown button span:first').html();
		var freq = $('#pickerFreq').val();
		$('#pickerFreqTotal').val( freq * multi );
		this.updatePreview();
	};
	
	this.onTimeChange = function() {
		this.updatePreview();
	};
	
	this.showPicker = function() {
		this.picker = ! this.picker;
		this.chart.showSliders( this.picker );
	};
	
	this.updatePreview = function() {
		var text = "Period: " + $('#pickerFreqTotal').val() + " minutes &#183; "
				 + "Amplitude: " + $('#pickerAmpl').val() + " meters &#183; "
				 + "Time of Arrival: " + $('#pickerTime').val() + " UTC";
		
		widget.find('.spanValues').html( text );
	};
	
	this.updateTime = function() {
		
		if( ! serverTime )
			return;
		
		var sec = zeroPad( serverTime.getSeconds(), 2);
		
		widget.find('.localTime').html( getLocalDateString( serverTime ) + ':' + sec );
		widget.find('.utcTime').html( getDateString( serverTime ) + ':' + sec );
	};
	
	this.saveFormData = function() {
		var formData = {};
			
		formData.sliders = new Array(3);
		for( var i = 0; i < 3; i++ )
			formData.sliders[i] = this.chart.getSliderValue(i);
		
		formData.zoom = this.chart.zoom;
		formData.left = this.chart.left;
		
		formData.multi = this.multi;
		formData.period = new Number( $('#pickerFreqTotal').val() );
		formData.ampl = new Number( $('#pickerAmpl').val() );
		formData.time = $('#pickerTime').val();
		formData.pick = $('#pickerEnable').prop('checked');
				
		this.data.setPickData( formData );
	};
	
	this.loadFormData = function() {
		var formData = this.data.pickData;
		var bounds = this.chart.getAxisBounds();
		
		if( formData ) {
			for( var i = 0; i < 3; i++ )
				this.chart.setSliderValue(i, formData.sliders[i]);
			
			this.chart.setState( formData.zoom, formData.left );
			
			$('#pickerDropDown li a')[ formData.multi ].click();
			$('#pickerTime').val( formData.time );
			$('#pickerEnable').prop('checked', formData.pick);
			
		} else {
			
			this.chart.setState( 1, 0 );
			this.chart.setSliderValue(0, 0);
			this.chart.setSliderValue(1, bounds.xmin);
			this.chart.setSliderValue(2, bounds.xmax);
			
			var time = zeroPad( bounds.xmin.getUTCHours(), 2 ) + ':' + zeroPad( bounds.xmin.getUTCMinutes(), 2 );
			
			$('#pickerDropDown li a')[0].click();
			$('#pickerTime').val( time );
			$('#pickerEnable').prop('checked', false);
		}
		
		this.updatePreview();
	};
		
	/* register all handlers used within this dialog */
	this.dialog.on('shown.bs.modal', this.ready.bind(this) );
	this.dialog.on('hidden.bs.modal', this.onClose.bind(this) );
	$('#pickerFreq').change( this.onFreqInputChange.bind(this) );
	$('#pickerAmpl').change( this.onAmplInputChange.bind(this) );
	$('#pickerTime').change( this.onTimeChange.bind(this) );
	$('#pickerDropDown li a').click( this.onMultiplierChange.bind(this) );
	$('#picker .lnkGroup').click( this.showPicker.bind(this) );
		
	/* update time every second */
	setInterval( this.updateTime.bind(this), 1000 );
}

function Slider( vertical, off, len, middle, min, max, widget ) {
	
	this.widget = widget;
	this.canvas_slider = $('<canvas class="canvas-gen" />').appendTo( widget );
	this.canvas_line   = $('<canvas class="canvas-gen" />').appendTo( widget );
	
	this.vertical = vertical;
	this.pos = { off: off, len: len, middle: 0 };
	this.range = { min: min, max: max };
		
	this.down = null;
	this.handler = null;
	
	this.setValue = function( val ) {
		/* set value and adjust if outside the range */
		this.pos.middle = Math.max( Math.min( val, this.range.max ), this.range.min );
		this.draw();
	};
	
	this.getValue = function() {
		return this.pos.middle;
	};
	
	this.onMouseDown = function( e ) {

		/* other elements should not react on this event */
		e.preventDefault();
		e.stopPropagation();
		
		$(window).on( 'mousemove', this.onMouseMove.bind(this) );
		$(window).on( 'mouseup', this.onMouseUp.bind(this) );
	
		this.down = { x: e.pageX, y: e.pageY };
	};
	
	this.onMouseMove = function( e ) {
				
		/* other elements should not react on this event */
		e.preventDefault();
		e.stopPropagation();
		
		var diff = 0;
		
		if( this.vertical == false ) {
			diff = e.pageY - this.down.y;
		} else {
			diff = e.pageX - this.down.x;
		}
		
		this.pos.middle += diff;
		
		if( this.pos.middle < this.range.min ) {
			this.pos.middle = this.range.min;
		} else if( this.pos.middle > this.range.max ) {
			this.pos.middle = this.range.max;
		} else {
			this.down.y += diff;
			this.down.x += diff;
		}
		
		this.draw();
						
		if( this.handler )
			this.handler( this.pos.middle );
	};
	
	this.onMouseUp = function( e ) {

		/* other elements should not react on this event */
		e.preventDefault();
		e.stopPropagation();
		
		$(window).off( 'mousemove' );
		$(window).off( 'mouseup' );
		this.down = null;
	};
		
	this.setOnChangeListener = function( handler ) {
		
		this.handler = handler;
	};
	
	this.dispose = function() {
		this.canvas_slider.remove();
		this.canvas_line.remove();
	};
		
	this.draw = function() {
		
		var size = 15;	
		var left, top;		
		
		this.canvas_slider.width( size );
		this.canvas_slider.height( size );
		
		if( this.vertical == false ) {
			left = this.pos.off;
			top = this.pos.middle - size / 2;
		} else {
			left = this.pos.middle - size / 2;
			top = this.pos.off + this.pos.len - size;
		}
		
		this.canvas_slider.css( "left", left + "px" );
		this.canvas_slider.css( "top", top + "px" );
		
		var canvas = this.canvas_slider[0];
		canvas.width  = this.canvas_slider.width();
		canvas.height = this.canvas_slider.height();
		
		var ctx = canvas.getContext('2d');
		
		ctx.fillStyle = 'black';
		ctx.lineWidth = 1;
		ctx.beginPath();
		
		if( this.vertical == false ) {
			ctx.moveTo( 0, 0 );
			ctx.lineTo( size, size / 2.0 );
			ctx.lineTo( 0, size );
		} else {
			ctx.moveTo( 0, size );
			ctx.lineTo( size / 2.0, 0 );
			ctx.lineTo( size, size );
		}
		ctx.closePath();
		ctx.fill();
		
		/* draw line */
		var thick = 1;
		
		if( this.vertical == false ) {
			this.canvas_line.width( this.pos.len - size + 1 );
			this.canvas_line.height( thick );
			
			left = left + size - 1;
			top = this.pos.middle - thick / 2.0;
		} else {
			this.canvas_line.width( thick );
			this.canvas_line.height( this.pos.len - size + 1 );
			
			left = this.pos.middle - thick / 2.0;
			top = this.pos.off;
		}
		
		this.canvas_line.css( "left", left + "px" );
		this.canvas_line.css( "top", top + "px" );
		
		canvas = this.canvas_line[0];
		canvas.width  = this.canvas_line.width();
		canvas.height = this.canvas_line.height();
		
		ctx = canvas.getContext('2d');
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 1;
		ctx.beginPath();
		
		if( this.vertical == false ) {
			ctx.moveTo( 0, thick / 2.0 );
			ctx.lineTo( canvas.width, thick / 2.0 );
		} else {
			ctx.moveTo( thick / 2.0, 0 );
			ctx.lineTo( thick / 2.0, canvas.height );
		}
		
		ctx.closePath();
		ctx.stroke();
	};
	
	this.show = function( val ) {
		var cssVal = val ? 'block' : 'none'; 
		this.canvas_line.css( 'display', cssVal );
		this.canvas_slider.css( 'display', cssVal );
	};
	
	this.canvas_slider.on( 'mousedown', this.onMouseDown.bind(this) );
	
	this.setValue( middle );
}

function MainChart( widget, width, height ) {
	
	this.data = null;
	this.div = widget;
	this.dia = new google.visualization.LineChart( this.div[0] );
	
	/* bounding box that contains the real diagram area */
	this.bbox = null;
	
	this.slider = [];
	this.handler = [];
	this.listenerID = null;
	
	this.zoom = 1;
	this.left = 0;
	this.drag = null;
		
	this.values = [];
			
	this.options = {
		curveType: 'function',
		width: width,
		height: height,
		interpolateNulls: true
	};
	
	this.init = function( data ) {
		
		this.dispose();
		
		this.data = data;
		this.options.title = data.name;
							
		/* register handler that will be called if the underlying station data changes */
		this.listenerID =
			this.data.setOnUpdateListener( (function(_this) {
				return function() {
					_this.refresh();
				};
			} )(this) );
		
		this.refresh();
	};
	
	this.dispose = function() {
		for( var i = 0; i < this.slider.length; i++ )
			this.slider[i].dispose();
		
		this.slider = [];
	};
	
	this.refresh = function() {
				
		/* get x-range that should be used when displaying the chart */
		var xmin = this.data.eq ? this.data.startTime : new Date(serverTime - this.data.range);
		var xmax = this.data.eq ? this.data.endTime : serverTime;
				
		if( this.data.eq ) {
			var range = this.data.endTime.getTime() - this.data.startTime.getTime();
			xmin = new Date( this.data.startTime.getTime() + this.data.prior - this.data.prior / this.data.eq.getAccel() );
			xmax = new Date( this.data.startTime.getTime() + range / this.data.eq.getAccel() );
		}
		
		var diff = xmax.getTime() - xmin.getTime();
		var hiddenPart = diff * (1 - this.zoom);
		xmin = new Date( xmin.getTime() + hiddenPart + this.left * hiddenPart );
		xmax = new Date( xmax.getTime() + this.left * hiddenPart );
		
		/* set 5 ticks on x-axis explicitly */
		var ticks = [];
		var parts = [0.0, 0.25, 0.5, 0.75, 1.0];
		for( var i = 0; i < parts.length; i++ ) {
			/* because Google Charts does not support displaying the x-axis in UTC time,
			 * specify tick labels explicitly */
			var tick = new Date( xmin.getTime() + (xmax.getTime() - xmin.getTime()) * parts[i] );
			var hours = (tick.getHours() + tick.getTimezoneOffset() / 60 + 24) % 24;
			ticks.push( { v:tick, f: zeroPad(hours, 2) + ':' + zeroPad( tick.getMinutes(), 2) } );
		}
					
		/* update hAxis */
		this.options.hAxis = {
			viewWindow: {
				min: xmin,
				max: xmax
			},
			ticks: ticks
		};
				
		this.dia.draw( this.data.table, this.options );
	};
	
	this.ready = function() {
		
		/* do one time initializations here */
		if( this.slider.length == 0 ) {
			
			var cli = this.dia.getChartLayoutInterface();
			var box = cli.getChartAreaBoundingBox();
			var ampl = cli.getYLocation( 0 );
								
			this.slider.push( new Slider( false, box.left - 50, box.width + 50, ampl, box.top, box.top + box.height, widget ) );
			this.slider.push( new Slider( true, box.top, box.height + 50, box.left, box.left, box.left + box.width, widget ) );
			this.slider.push( new Slider( true, box.top, box.height + 50, box.left + box.width, box.left, box.left + box.width, widget ) );
			
			for( var i = 0; i < this.slider.length; i++ ) {
				this.handler.push( null );
				this.values.push( null );
				this.slider[i].setOnChangeListener( this.onControlChange.bind(this,i) );
			}
			
			/* set bounding box with relative coordinates */
			this.bbox = box;
		}
		
		/* update sliders according to new diagram range */
		for( var i = 0; i < this.slider.length; i++ ) {
			if( this.values[i] != null )
				this.setSliderValue( i, this.values[i] );
		}
	};
	
	this.setState = function( zoom, left ) {
		this.zoom = zoom;
		this.left = left;
		this.refresh();
	};
	
	this.setOnSlideListener = function( idx, handler ) {
		
		if( idx >= this.slider.length )
			return;
		
		this.handler[idx] = handler;
	};
	
	this.onControlChange = function( idx, val ) {
		
		var val = this.slider[idx].pos.middle;
		
		if( idx == 0 )
			this.values[idx] = this.dia.getChartLayoutInterface().getVAxisValue( val );
		else
			this.values[idx] = this.dia.getChartLayoutInterface().getHAxisValue( val );
		
		if( this.handler[idx] )
			this.handler[idx]( this.values[idx] );
	};
	
	this.getSliderValue = function( idx ) {		
		return this.values[idx];
	};
	
	this.setSliderValue = function( idx, val ) {
		
		var trans;
		
		this.values[idx] = val;
		
		if( idx == 0 )
			trans = this.dia.getChartLayoutInterface().getYLocation( val );
		else
			trans = this.dia.getChartLayoutInterface().getXLocation( val );
		
		this.slider[idx].setValue( trans );
		
		if( this.handler[idx] )
			this.handler[idx]( this.values[idx] );
	};
	
	this.showSliders = function( val ) {
		for( var i = 0; i < this.slider.length; i++ )
			this.slider[i].show( val );
	};
	
	this.getAxisBounds = function() {
		var win = this.options.hAxis.viewWindow;
		return { xmin: win.min, xmax: win.max };
	};
	
	/* */
	this.onMouseDown = function(e) {
		
		/* check if the event refers to the chart area and not something around it (e.g the label) */
		if( ! this.isInsideBBox( {x: e.clientX, y: e.clientY} ) )
			return;
		
		this.drag = { x: e.clientX, y: e.clientY };
		$(window).mousemove( this.onMouseDrag.bind(this) );
		$(window).mouseup( this.onMouseUp.bind(this) );
	};
	
	this.onMouseUp = function(e) {
		this.drag = null;
		$(window).unbind( 'mousemove' );
	};
	
	this.onMouseDrag = function(e) {
		var diff = this.drag.x - e.clientX;
		this.drag = { x: e.clientX, y: e.clientY };
		
		this.left += (diff / this.options.width);
		this.left = Math.min( this.left, 0 );
		this.left = Math.max( this.left, -1 );
		
		this.refresh();
	};
	
	this.onMouseWheelFF = function(e) {
		
		/* check if the event refers to the chart area and not something around it (e.g the label) */
		if( ! this.isInsideBBox( {x: e.clientX, y: e.clientY} ) )
			return;

		this.zoomDia( - e.originalEvent.detail );
	};
	
	this.onMouseWheel = function(e) {
				
		/* check if the event refers to the chart area and not something around it (e.g the label) */
		if( ! this.isInsideBBox( {x: e.clientX, y: e.clientY} ) )
			return;
		
		this.zoomDia( e.originalEvent.wheelDelta );
	};
	
	this.zoomDia = function( offset ) {
		
		var delta = offset > 0 ? 0.5 : 2;
		this.zoom *= delta;
		this.zoom = Math.max( this.zoom, 0.125 );
		this.zoom = Math.min( this.zoom, 1 );
		
		this.refresh();
	};
	
	this.isInsideBBox = function( p ) {
		
		/* get relative coordinates of given point */
		var x = p.x - this.div.offset().left;
		var y = p.y - this.div.offset().top;
		
		/* check if point lies inside the bounding box */
		if( x < this.bbox.left || x > this.bbox.left + this.bbox.width ||
			y < this.bbox.top  || y > this.bbox.top + this.bbox.height )
			return false;
		
		return true;
	};
	
	this.div.mousedown( this.onMouseDown.bind(this) );
	
	this.div.bind( 'mousewheel', this.onMouseWheel.bind(this) );
	this.div.bind( 'DOMMouseScroll', this.onMouseWheelFF.bind(this) );
	
	google.visualization.events.addListener( this.dia, 'ready', this.ready.bind(this) );
}

function StationView( widget, data ) {
	
	this.widget = widget;
	this.data = data;
	this.box_list = [];
	
	this.lines_on = false;
	this.timer = null;
			
	/* should be called after stations were added to the data container */   
	this.reload = function() {
		
		this.widget.empty();	
		
		if( ! this.widget.is(':visible') || this.data.length() == 0 ) {
			this.widget.append('<div class="lnkSelect"><a href="javascript:showProp(null,\'#propTabStations\')">Select stations</a></div>');
			return;
		}
				
		this.dispose();
					
		var width = 200;
		var height = this.widget[0].clientHeight - 30;
	
		/* make the widget invisible to speed up appending new charts inside the following loop */
		this.widget.css('display','none');
		
		for( var i = 0; i < this.data.length(); i++ ) {
			
			var item = this.data.get(i);
			
			if( this.box_list.length - 1 < i ) {
				var chart = new Chart( item, width, height );
				chart.registerMouseListener( this.onMouseAction.bind(this,i) );
				this.box_list.push( chart );
			} else {
				this.box_list[i].init( item );
			}

			this.widget.append( this.box_list[i].div );
		}
		
		this.widget.css('display','block');
		
		this.activate();
	};
	
	this.dispose = function() {
		
		this.deactivate();
		
		for( var i = 0; i < this.box_list.length; i++ )
			this.box_list[i].dispose();
				
		this.box_list = [];
	};
		
	/* should be called after sorting stations in the data container */
	this.update = function() {
				
		for( var i = 0; i < this.data.length(); i++ )
			this.box_list[i].init( this.data.get(i) );
		
		this.activate();
	};
	
	this.enableLines = function( on ) {
		this.lines_on = on;
	};
	
	this.scrollTo = function( idx, step_fun, done_fun ) {
		
		var box = this.box_list[idx].div;
		var ref = this.widget.scrollLeft();
		
		var val = ref + box.position().left - (this.widget.width() - box.width() ) / 2;
		    val = Math.max( 0, val );
		    	
		this.widget.animate({
			scrollLeft: val
        }, { duration: 750, step: step_fun, done: done_fun });
		    
		//this.widget.scrollLeft( val );
	};
	
	this.drawLine = function( idx ) {
		
		var box = this.box_list[idx].div;
		var p1 = box.offset();
		p1.left += box.width() / 2;
			
		var item = this.data.get(idx);
		var pixel = LatLonToPixel( item.lat, item.lon );
		var p2 = $( '#mapview' ).offset();
		
		p2.left += pixel.x;
		p2.top += pixel.y;
		
		canvas.drawLine( p1, p2 );
	};
	
	this.onMouseAction = function( idx, type ) {
		
		if( type == 'enter' ) {
			
			stationSymbols.highlight( idx, true );
			if( this.lines_on )
				this.drawLine( idx );
			
		} else if( type == 'leave' ) {
			
			stationSymbols.highlight( idx, false );
			canvas.clearCanvas();
			
		} else if( type == 'click' ) {
			
			if( this.lines_on ) {
				map.panTo( stationSymbols.symbols[idx].marker.getPosition() );
				this.drawLine( idx );
			}
			dialogs.chart.show( this.data.get(idx) );
		}
	};
	
	this.setData = function( data ) {
		
		this.deactivate(); 
		
		this.data = data;
		this.reload();
	};
	
	/* return list of visible stations */
	this.getVisible = function() {
		var list = [];
		for( var i = 0; i < this.data.length(); i++ )
			if( this.box_list[i].isVisible() )
				list.push( i );
		return list;
	};
	
	/* call function 'activate' 0.5 sec after a scroll action is finished */
	this.onScroll = function() {
		if( this.timer )
			clearTimeout( this.timer );
		
		this.timer = setTimeout( this.activate.bind(this), 500 );
	};
	
	/* activate all visible stations */
	this.activate = function() {
		this.timer = null;		
		var visibles = this.getVisible();
		this.deactivateAll(visibles);
		
		for( var i = 0; i < visibles.length; i++ ) {
			var idx = visibles[i];
			if( this.data.get( idx ).activate() )
				this.box_list[ idx ].setLoading();
		}
	};
	
	/* deactivate all stations except the given list */
	this.deactivateAll = function( excepts ) {
		var start = 0;
		
		for( var j = 0; j < excepts.length; j++ ) {
			for( var i = start; i < excepts[j]; i++ ) {
				this.data.get( i ).deactivate();
			}
			start = excepts[j] + 1;
		}
		
		for( var i = start; i < this.data.length(); i++ ) {
			this.data.get( i ).deactivate();
		}
	};
	
	/* deactivate all stations */
	this.deactivate = function() {
		if( this.data ) {
			for( var i = 0; i < this.data.length(); i++ )
				this.data.get(i).deactivate();
		}
	};
	
	this.widget.scroll( this.onScroll.bind( this ) );
}

function Symbol( marker, idx, list ) {
	
	this.marker = marker;
	this.idx = idx;
	this.list = list; /* StationSymbols */
	
	this.mouseIn = false;
	
	with( { _this: this } ) {
		google.maps.event.addListener( this.marker, 'click', function() {
			
			_this.list.symbolOnClick( _this );
		});
	}
	
	with( { _this: this } ) {
		google.maps.event.addListener( this.marker, 'mouseover', function() {
			
			_this.mouseIn = true;
			_this.highlight( true );
			_this.list.symbolOnMouseEnter( _this );
		});
	}

	with( { _this: this } ) {
		google.maps.event.addListener( this.marker, 'mouseout', function() {
			
			_this.mouseIn = false;
			_this.highlight( false );
			_this.list.symbolOnMouseLeave( _this );
		});
	}
	
	this.highlight = function( yes ) {
		
		var weight = yes ? 1.5 : 1.0;
		
		var icon = this.marker.getIcon();
		icon.strokeWeight = weight;
		this.marker.setIcon( icon );
	};
	
	this.show = function( yes ) {
		
		this.marker.setMap( yes ? map : null );
	};
	
	this.destroy = function() {
		
		this.show( false );
		this.marker = null;
	};
}

function StationSymbols( data, show ) {
	
	this.symbols = [];
	this.showLines = false;
	this.data = data;
	this.visible = show;
	
	this.info = new google.maps.InfoWindow();
		
	this.create = function() {
				
		for( var i = 0; i < this.data.length(); i++ ) {
			
			var item = this.data.get(i);
			var pos = new google.maps.LatLng( item.lat, item.lon );
									
			var marker = new google.maps.Marker ({
				position: pos,
				map: null,
				icon: {
					anchor: new google.maps.Point( 0, 2 ),
					path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
				    fillOpacity: 0.7,
				    fillColor: 'green',
				    strokeOpacity: 1.0,
				    strokeColor: "white",
				    strokeWeight: 1.0,
				    scale: 3.5 //pixels
				}
			});
						
			this.symbols.push( new Symbol( marker, i, this ) );
		}
		
		this.show( this.visible );
	};
	
	this.setData = function( data ) {
		this.data = data;
		this.recreate();
	};
	
	this.removeAll = function() {
		
		for( var i = 0; i < this.symbols.length; i++ )
			this.symbols[i].destroy();
		
		this.symbols.length = 0;
	};
	
	this.recreate = function() {
		
		this.removeAll();
		this.create();
	};
		
	this.drawLine = function( idx, marker ) {
				
		var box = stationView.box_list[idx].div;
		var p1 = box.offset();
		p1.left += box.width() / 2;
			
		var latlng = marker.getPosition();
		var pixel = LatLonToPixel( latlng.lat(), latlng.lng() );
		
		var p2 = $( '#mapview' ).offset();
		p2.left += pixel.x;
		p2.top += pixel.y;
								
		canvas.drawLine( p1, p2 );
	};
	
	this.removeLine = function() {
		
		canvas.clearCanvas();
	};
	
	this.symbolOnClick = function( symbol ) {
						
		var item = this.data.get( symbol.idx );
				
		/* scroll to diagram and redraw the line */
		with( { _this: this } ) {
			stationView.scrollTo( symbol.idx, function() {
				_this.removeLine();
				if( _this.showLines )
					_this.drawLine( symbol.idx, symbol.marker );
			}, function() {
				if( ! symbol.mouseIn )
					_this.removeLine();
			});
		}
		
		this.info.setContent( item.name );
		this.info.open( map, symbol.marker );
	};
	
	this.symbolOnMouseEnter = function( symbol ) {
				
		if( this.showLines )
			this.drawLine( symbol.idx, symbol.marker );
	};
	
	this.symbolOnMouseLeave = function( symbol ) {
				
		this.info.close();
		this.removeLine();
	};
		
	this.show = function( yes ) {
		
		this.visible = yes;
		
		for( var i = 0; i < this.symbols.length; i++ )
			this.symbols[i].show( yes );
	};
	
	this.highlight = function( idx, yes ) {
				
		this.symbols[idx].highlight( yes );
	};
	
	this.enableLines = function( enable ) {
		
		this.showLines = enable;
	};
	
	this.create();
}

function sort_string( field, a, b ) {
		
	if( a[ field ] < b[ field ] )
		return -1;
	
	if( a[ field ] > b[ field ] )
		return 1;
	
	return 0;
}

function sort_dist( lat, lon, a, b ) {
		
	/* calculating the distance between two longitudes must respect the wrap around -180 and +180 degree */
	var a_lon = Math.min( Math.abs(a.lon - lon), 180 - Math.abs( lon ) + 180 - Math.abs( a.lon ) );
	var b_lon = Math.min( Math.abs(b.lon - lon), 180 - Math.abs( lon ) + 180 - Math.abs( b.lon ) );
		
	var dist_a = Math.sqrt( Math.pow( a.lat - lat, 2 ) + Math.pow( a_lon, 2 ) );
	var dist_b = Math.sqrt( Math.pow( b.lat - lat, 2 ) + Math.pow( b_lon, 2 ) );
	
	if( dist_a < dist_b )
		return -1;
	
	if( dist_a > dist_b )
		return 1;
	
	return 0;
}

function sort_date( a, b ) {
		
	if( new Date(a.prop.date) < new Date(b.prop.date) )
		return -1;
	else if( new Date(a.prop.date) > new Date(b.prop.date) )
		return 1;
		
	return 0;
}

function sort_timeline( a, b ) {
	
	/* because of inconsistent field naming, we have to distinguish at this point :( */
	var a_date = a.timestamp ? a.timestamp : a.CreatedTime;
	var b_date = b.timestamp ? b.timestamp : b.CreatedTime;
		
	if( new Date(a_date) < new Date(b_date) )
		return -1;
	else if( new Date(a_date) > new Date(b_date) )
		return 1;
		
	return 0;
}

function VsdbPlayer( div ) {
	
	/* jquery objects */
	this.div = div;
	this.base = null;
	this.btnPlay = this.div.find('.btnPlay');
	this.drpNames = this.div.find('.drpNames');
	this.drpAccel = this.div.find('.drpAccel');
	this.progess = this.div.find('.progress-bar');
	
	this.running = false;
	this.scenarios;
	this.scenario = null;
	this.accel = null;
	this.cancelled = false;
		
	this.init = function() {
		
		function success( obj ) {
						
			this.drpNames.find('ul').empty();
			
			this.scenarios = obj.result.list;
									
			for( var i = 0; i < this.scenarios.length; i++ ) {
				var name = this.scenarios[i].name;
				var id = this.scenarios[i].id;
				this.drpNames.find('ul').append('<li class="id_' + id +'"><a href="#">' + name + '</a></li>');
				
				var sensors = [];
				for( var j = 0; j < this.scenarios[i].sensors.length; j++ ) {
					if( this.scenarios[i].sensors[j].type != "UshahidiSensor" )
						sensors.push( this.scenarios[i].sensors[j].urn );
				}
				this.scenarios[i].sensors = sensors;
			}
									
			this.drpNames.find('a').click( this.onDrpChange.bind(this) );
			this.update();
		};
		
		if( this.base == null )
			return;
				
		this.drpAccel.find('ul').empty();
		
		for( var k = 1; k <= 10; k++ )
			this.drpAccel.find('ul').append('<li><a href="#">' + k + '</a></li>');
		
		this.drpAccel.find('ul').append('<li><a href="#">' + 16 + '</a></li>');
		
		this.drpAccel.find('a').click( this.onDrpChange.bind(this) );
		
		this.btnPlay.find('.load').hide();
		
		this.request( 'simlist', [], success.bind(this) );
	};
	
	this.setBase = function( base ) {
		this.base = base;
		this.init();
	};
	
	this.start = function() {
			
		function success( result ) {
			console.log( result );
		};
				
		var params;
		params = [this.scenario.id, null, this.accel, this.scenario.sensors];
		
		this.drpNames.find('button').prop('disabled', true);
		this.drpAccel.find('button').prop('disabled', true);
		this.btnPlay.prop('disabled', true);
		
		this.btnPlay.find('.ready').hide();
		this.btnPlay.find('.load').show();
				
		this.cancelled = false;
		this.request( 'startsim', params, success.bind(this) );
	};
	
	this.stop = function() {
				
		function success( result ) {
			console.log( result );
		}
		
		this.cancelled = true;
		this.request( 'stopsim', [], success.bind(this) );
	};
	
	this.update = function() {
		
		function success( obj ) {
			
			var status = obj.result;
											
			/* toggle buttons if the state changes */
			if( status.running != this.running ) {
				this.running = status.running;
				this.btnPlay.find('span').toggleClass('glyphicon-play');
				this.btnPlay.find('span').toggleClass('glyphicon-stop');
				this.drpNames.find('button').prop('disabled', this.running);
				this.drpAccel.find('button').prop('disabled', this.running);
				this.btnPlay.prop('disabled', false);
				
				/* show progress bar and resize the entire page */
				this.div.find('.progress').show();
				onResize();
				
				if( ! this.running ) {
					this.btnPlay.removeClass("btn-danger");
					this.btnPlay.addClass("btn-success");
				} else {
					this.btnPlay.addClass("btn-danger");
					this.btnPlay.removeClass("btn-success");
				}
				
				if( this.running == false && this.cancelled ) {
					this.progess.find('.progress-txt').html( "Scenario cancelled." );
				}
				
				this.btnPlay.find('.load').hide();
				this.btnPlay.find('.ready').show();
			}
						
			/* set acceleration factor if player was already running */
			if( status.ff && status.ff != this.accel ) {
				this.drpAccel.find('button').html(status.ff + ' <span class="caret"></span>');
				this.accel = status.ff;
			}
			
			/* set scenario if player was already running */
			if( status.simname && ! this.scenario ) {
				var idx = this.drpNames.find('.id_' + status.simid).index();
				this.scenario = this.scenarios[idx];
				this.drpNames.find('button').html(status.simname + ' <span class="caret"></span>');
			}
			
			/* update progress */
			if( status.starttime ) {
				var text;
				var progress = 0;
				
				if( status.pos < 0 ) {
					var dur = -status.pos / 1000 / this.accel;
					text = "Starting in " + dur.toFixed() + " seconds...";
				} else {
					progress = (status.pos / status.end) * 100;
					text = progress.toFixed(1) + " %";
				}
								
				this.progess.css('width', progress + '%');
				this.progess.find('.progress-txt').html( text );
			}
						
			setTimeout( this.update.bind(this), 1000 );
		};
		
		this.request( 'status', [], success.bind(this) );
	};
	
	this.request = function( method, params, callback ) {
		
		var data = { jsonrpc: '2.0',
				 	 method: method,
				 	 params: params,
				 	 id: "id"
			    	};
		
		$.ajax({
	        type: 'POST',
	        contentType: 'application/json; charset=utf-8',
	        url: this.base + '/services/',
	        data: JSON.stringify( data ),
	        dataType:"json", 
	        success: function( result ) {
	        	if( callback )
	        		callback(result);
	        },
	        error: function() {
	        	console.log( 'Error while sending a request to the VSDB-Player.' );
	        }
	    });
	};
	
	/* will be called if the play/stop button is pressed */
	this.onClick = function() {
		
		/* everything must be specified */
		if( ! this.scenario || ! this.accel )
			return;
		
		if( this.running == false ) {
			this.start();
		} else {
			this.stop();
		}
	};
	
	this.onDrpChange = function( e ) {
		var item = $(e.delegateTarget);
		var dropdown = item.closest('.dropdown');
		dropdown.find('button').html( item.html() + " " );
		dropdown.find('button').append('<span class="caret"></span>');
		
		if( dropdown.is( this.drpNames ) ) {
			this.scenario = this.scenarios[ item.closest('li').index() ];
		} else if( dropdown.is( this.drpAccel ) ) {
			this.accel = item.html();
		}
		
		if( this.scenario && this.accel ) {
			this.btnPlay.prop('disabled', false);
		}
	};
	
	/* register event handlers */
	this.btnPlay.click( this.onClick.bind(this) );
	
	this.init();
}

var eqlist = new CustomList( '#sidebar' );
var saved = new CustomList( '#saved' );
var timeline = new CustomList( '#timeline-data', sort_timeline );
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

var stations;
var stationView;
var stationSymbols;
var canvas;
var vsdbPlayer;
var splash;

var loaded = 0;

var serverTime = null;

var dialogs;

google.load("visualization", "1", {packages:["corechart"]});
google.maps.event.addDomListener(window, 'load', init_maps );
google.setOnLoadCallback( init_charts );

function init_maps() {

	loaded++;
	initialize();
}

function init_charts() {
	
	loaded++;
	initialize();
}

function initialize() {
	
	if( loaded < 2 )
		return;
		
	dialogs = { chart: new MainChartDialog( $('#chartDia') ) };
	
	stations = new Container( 'name', sort_string.bind( this, 'name' ) );
	stationView = new StationView( $('#stat-dias'), stations, $( '#stat-chk' ).is(':checked') );
	canvas = new Canvas( $('#canvas-line'), null );
	stationSymbols = new StationSymbols( stations, $( '#stat-chk' ).is(':checked') );
	stationSymbols.enableLines( $('#stat-dias').css( "display" ) != "None" );
			
	vsdbPlayer = new VsdbPlayer( $('#vsdbPlayer') );
	
	splash = new Splash(); 
	
	var mapOptions = {
			zoom: 2,
			center: new google.maps.LatLng(0,0),
			mapTypeId: google.maps.MapTypeId.SATELLITE
	};

	map = new google.maps.Map( document.getElementById('mapview'), mapOptions );
    		
	google.maps.event.addListener( map, 'click', clickMap );
	google.maps.event.addListener( map, 'zoom_changed', mapZoomed );
	google.maps.event.addListener( map, 'resize', mapResized );
	
	google.maps.event.addListener( map, 'projection_changed', projection_changed );
	
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
	$( '.lnkGroup' ).click( groupOnClick );
		
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
	
	$( '#stat-toggle-lnk' ).click( toggleStationView );
	$( '#stat-chk' ).change( toggleStations );
	
	/* accept enter key on splash screen to log in */
	$( '#splashPass, #splashUser' ).keypress( function(e) { if(e.which == 13) $('#splashSignIn').click();  } );
	
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
			
			serverTime = new Date( result['serverTime'] );
				    		
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
										
					var parent = eqlist.find( obj['id'] );
					var entry = entries.add( obj );
				
					// insert obj sorted again
					eqlist.removeById( obj['id'] );
					eqlist.push( entry );
					
					madd = true;
					
					if( parent && parent._id == active )
						active = obj._id;
					
					if( searched( entry ) ) {
						timeline.push( entry );
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
	
	var dip = prop['dip'] ? prop['dip'] + '&deg;' : "n/a";
	var strike = prop['strike'] ? prop['strike'] + '&deg;' : "n/a";
	var rake = prop['rake'] ? prop['rake'] + '&deg;' : "n/a";
	
	$div.find( '.region' ).text( prop['region'] );
	$div.find( '.mag').text( prop['magnitude'] );
	$div.find( '.datetime' ).html( datestr + " &#183; " + timestr + " UTC" + " &#183; " + txtId );
	$div.find( '.lonlat' ).html( 'Lat ' + prop['latitude'] + '&deg; &#183;  Lon ' + prop['longitude'] + '&deg; &#183;  Depth ' + prop['depth'] + ' km' );
	$div.find( '.dip' ).html( 'Dip ' + dip + ' &#183; Strike ' + strike + ' &#183; Rake ' + rake );
	
	if( checkPerm("vsdb") )
		$div.find( '.accel' ).html( 'Acceleration ' + data.getAccel() + "x" );
	
	if( widget.attr('id') == 'sidebar' && curuser.inst && curuser.inst.name == "gfz" ) {
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
				
		if( ! data.hasCompParams() ) {
			$div.find( '.status' ).html( "Missing parameters" );
		} else if( ! prop['sea_area'] ) {
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
	
	var subject = data['Subject'] ? data['Subject'] : "No subject";
	
	$div.find( '.msgIcon').css( "color", color );
	$div.find( '.msgIcon').attr( "class", cls );
	$div.find( '.msgType').text( type );
	$div.find( '.subject' ).text( subject );
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
	
	console.log( entry );

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
				
				var txt = "<b>" + poi.country + " - " + poi.name + " (" + poi.code + ")</b><br>";
				
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
	
	if( id == null /*|| id == active*/ )
		return;
	
	active = id;
	
	var entry = entries.get( active );
		
	if( ! entry )
		return;
	
	for( var key in entry.div ) {
		entry.div[key].css( "border-left", "8px solid #C60000" );
		entry.div[key].css( "background-color", "#c3d3e1" );
	}	
	
	entry.loadStations();
}

function deselect() {
			
	if( active == null )
		return;
	
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
	
	stationView.setData( stations );
	stationSymbols.setData( stations );
	
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
				
				/* to avoid caching problems, simply reload the page and start from session again */
				window.location.reload();
				
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
	
	// show disclaimer - redirect to xkcd if not accepted
	if( ! $.cookie('disclaimer') ) {
		$( '.disClose' ).click( function() { window.location.href = "http://dynamic.xkcd.com/random/comic/"; } );
		$( '#disAccept' ).click( function() { $.cookie('disclaimer', 'true'); } );
		$( '#DisclaimDia' ).modal( { show: true, backdrop: 'static' } );
	}
	
	loggedIn = true;
	
	console.log( curuser );
	
	getStationList( addGlobalStations );
	
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
	
	/* check chart permission */
	if( checkPerm("chart") ) {
		/* show charts */
		showStationView( true );
		$( '#statview' ).show();
		/* show station properties */
		$( '#propTabStations' ).show();	
	} else {
		/* hide charts */
		showStationView( false );
		$( '#statview' ).hide();
		/* hide station properties */
		$( '#propTabStations' ).hide();
	}
		
	if( checkPerm("vsdb") ) {
		$( '#vsdbPlayer' ).show();
		vsdbPlayer.setBase( curuser.inst.vsdblink );
	} else {
		$( '#vsdbPlayer' ).css( "display", "none" );
	}
	
	onResize();
		
	shared.reset();
	checkStaticLink();
	
	configMailDialog();
	
	$( '#lnkUser' ).html( curuser.username );
	if( curuser.inst )
		$( '#lnkUser' ).append( " &nbsp;&#183;&nbsp; " + curuser.inst.descr );
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
		params['date'] = $('#inDate').data( "dateObj" ).toISOString();
	
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
	
	/* do not set parent and root ID if this is a preset event */
	if( entry['_id'] ) {
		$( '#inParentId' ).html( entry['_id'] );
		
		if( entry['root'] ) {
			$( '#inRootId' ).html( entry['root'] );
		} else {
			$( '#inRootId' ).html( entry['_id'] );
		}
	} else {
		$( '#inParentId' ).html("");
		$( '#inRootId' ).html("");
	}
	
	if( prop['date'] ) {
		var date = new Date( prop['date'] );
		$( '#inDate' ).html( getDateString( date ) + " UTC" );
		$( '#inDate' ).data( "dateObj", date );
	} else {
		$( '#inDate' ).html( "" );
	}
		
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
			
	if( curuser.properties ) {
		$( "#ftpTo").html( curuser.properties.FtpHost + curuser.properties.FtpPath );
		if( curuser.properties.FtpFile && curuser.properties.FtpFile != "" ) {
			$( "#ftpToFile").val( curuser.properties.FtpFile );
		} else {
			$( "#ftpToFile").val( zeroPad( msgnr, 3 ) + ".txt" );
		}
	}
	
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
	
	/* station data */
	$( '#mailWaveActData' ).html( getStationData( entry ) );
	
	changeMsgText();
	
	$( "#EmailDia" ).modal("show");
}

function getStationData( eq ) {
	
	var text = "";
	var headlen = "GAUGE LOCATION".length;
	
	if( ! eq.stations )
		return "";
		
	/* iterate once to get the length of the headline */
	for( var i = 0; i < eq.stations.length(); i++ ) {
		
		var stat = eq.stations.get(i);
		var pickData = stat.pickData;
		
		if( ! pickData || ! pickData.pick )
			continue;
		
		headlen = Math.max( headlen, stat.name.length );
	}
	
	for( var i = 0; i < eq.stations.length(); i++ ) {
		
		var stat = eq.stations.get(i);
		var pickData = stat.pickData;
		
		if( ! pickData || ! pickData.pick )
			continue;
		
		var pretty_lat = charPad( Math.abs( stat.lat ).toFixed(2), 5, ' ' ) + (stat.lat < 0 ? "S" : "N");
		var pretty_lon = charPad( Math.abs( stat.lon ).toFixed(2), 6, ' ' ) + (stat.lon < 0 ? "W" : "E");
		var pretty_time =  charPad( pickData.time.replace(/\D/g,''), 4, '0' );
		var pretty_ampl = charPad( pickData.ampl.toFixed(2), 5, ' ');
		var pretty_period = charPad( pickData.period.toFixed(2), 6, ' ');
		
		text += withPadding( stat.name, headlen, " " ) + " "
		     +  pretty_lat + " "
		     + pretty_lon + " "
		     + pretty_time + "Z "
		     + pretty_ampl + "M "
		     + pretty_period + "MIN\n";
	}
		
	var head  = withPadding( "GAUGE LOCATION", headlen, " " ) + " "
	          + "LAT    LON     TIME  AMPL   PER      \n"
	          + withPadding( "", headlen, "-" ) + " "
	          + "------ ------- ----- ------ ---------\n";
	
	if( text != "" )
		text = head + text;
	    
	return text;
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
		
		if( ! $("#mailWaveActData").is(':empty') )
			msgText += getPlainText( $( "#mailWaveAct" ) );
				
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
		
		if( ! $("#mailWaveActData").is(':empty') )
			msgText += getPlainText( $( "#mailWaveAct" ) );
		
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
		
		if( ! $("#mailWaveActData").is(':empty') )
			msgText += getPlainText( $( "#mailWaveAct" ) );
		
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
	var ftpChk = $( "#ftpChk" ).prop("checked");
	var ftpFile = $( "#ftpToFile" ).val();
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
			data: { apiver: 1, fname: ftpFile, text: text, evid: root, parentid: parent, msgnr: msgnr }, 
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

function showProp( e, activeTab ) {
	
	var prop = curuser.properties;
	var perm = curuser.permissions;
	var notify = curuser.notify;
		
	/* clear all input fields to avoid displaying old data from another user! */
	$( '#PropDia :input' ).val( "" );
	
	$( '#propUser' ).html( curuser.username );
	
	if( perm && ( perm.fax || perm.ftp || perm.sms ) ) {
	
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
			$( '#propFTPFile' ).val( prop.FtpFile );
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
	
	if( notify ) {
		$( '#propNotifySms' ).val( notify.sms );
		$( '#propNotifyMail' ).val( notify.mail );
		$( '#propNotifyMag' ).val( notify.mag );
	}
	
	/* stations */
	if( curuser.countries ) {
		var widget = $( '#propStations .countries' );
		widget.empty();
		for( var i = 0; i < curuser.countries.length; i++ ) {
			var span = $('<span class="country-code"><input type="checkbox">' + curuser.countries[i]._id + ' (' + curuser.countries[i].count + ')</span>');
			var checkbox = span.find('input');
			checkbox.prop( 'checked', curuser.countries[i].on );
			checkbox.change( onCountrySelect );
			widget.append( span );
		}
		onCountrySelect();
	}
	
	if( activeTab )
		$( activeTab + ' a' ).click();
	
	$( '#PropDia' ).modal('show');
}

function onCountrySelect() {
	
	var chkBoxes = $( '#propStations .countries' ).find( 'input' );
	var sum = 0;
	
	for( var i = 0; i < chkBoxes.length; i++ ) {
		if( chkBoxes.eq(i).is(':checked') )
			sum += curuser.countries[i].count;
	}
	
	
	$('#propStations .count').html( "Selected stations in total: " + sum );
		
	if( sum > 100 ) {
		$('#propStations .warn').html( "Using more than 100 stations may lead to a noticeable slowdown of the entire page!" );
	} else {
		$('#propStations .warn').html("");
	}
}

function groupOnClick() {
			
	var content = $(this).parents('.group').children('.grpContent');
	var arrow =  $(this).children('.grpArrow');
			
	content.css( "display", arrow.hasClass( 'glyphicon-chevron-up' ) ? "none" : "inline" );
		
	arrow.toggleClass( 'glyphicon-chevron-up' );
	arrow.toggleClass( 'glyphicon-chevron-down' );
}

function configMailDialog() {
		
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
	$( '#msgCloud .lnkGroup' ).click();
	$( '#msgFtp .lnkGroup' ).click();
	$( '#msgFax .lnkGroup' ).click();
	$( '#msgSMS .lnkGroup' ).click();
	$( '#msgEvents .lnkGroup' ).click();
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
						&& checkProp( prop.FtpPath );
	
	if( type == "sms" )
		return perm.sms && prop
						&& checkProp( prop.TwilioSID )
						&& checkProp( prop.TwilioToken )
						&& checkProp( prop.TwilioFrom );
	
	if( type == "vsdb" )
		return ( curuser.inst && curuser.inst.vsdblink );
	
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
				 "FtpFile": $( '#propFTPFile' ).val(),
				 "TwilioSID": $( '#propSmsSID' ).val(),
				 "TwilioToken": $( '#propSmsToken' ).val(),
				 "TwilioFrom": $( '#propSmsFrom' ).val()
				};

	var inst = { "descr": $( '#propInstName' ).val(),
			 	 "msg_name": $( '#propInstMsgName' ).val(),
		       };
	
	var notify = { "sms": $( '#propNotifySms' ).val(),
				   "mail": $( '#propNotifyMail' ).val(),
				   "mag":  $( '#propNotifyMag' ).val()
				 };
					
	$( '#propStatus' ).html("");
	
	if( newpwd != confpwd ) {
		$( '#propStatus' ).html("Error: The given passwords differ.");
		return;
	}
	
	var data = { prop: JSON.stringify( prop ),
				 inst: JSON.stringify( inst ),
				 notify: JSON.stringify( notify ),
	   			};
		
	/* stations */
	var statChanged = false;
	if( curuser.countries ) {
		var widget = $( '#propStations .countries' );
		var clist = [];
		
		for( var i = 0; i < curuser.countries.length; i++ ) {
			var checked = widget.find('input').eq(i).is(':checked');
			if( checked != curuser.countries[i].on )
				statChanged = true;
			if( checked == true )
				clist.push( curuser.countries[i]._id );
		}
		
		if( statChanged )
			data.stations = JSON.stringify( clist );
	}
	
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
				configMailDialog();
				
				/* TODO: generalize and support eq related stations too */
				if( statChanged )
					getStationList( addGlobalStations );
				
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

function getLocalDateString( date ) {
	
	var year = date.getFullYear();
	var month = date.getMonth() + 1;
	var day = date.getDate();
	var hour = date.getHours();
	var minutes = date.getMinutes();
	
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
	var playerHeight = $('#vsdbPlayer').is(':visible') ? $('#vsdbPlayer').outerHeight() : 0;
	var h = $('.tabs-head').height() + playerHeight + 1;
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

function mapResized() {
		
	/* get size and position used for canvas */
	var pad_top = $( "#stat-dias" ).innerHeight() - $( "#stat-dias" ).height();
	var rect = $( "#mapview" ).offset();
	rect.width = $( "#mapview" ).width();
	rect.height = $( "#mapview" ).height() + pad_top;
	
	canvas.resize( rect );
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
	$( "#splash-new" ).css( "display", show ? "block" : "none" );
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

function toggleStationView() {
	
	var lnk = $( '#stat-toggle-lnk span' );
	var visible = lnk.hasClass( 'glyphicon-chevron-down' );
			
	lnk.toggleClass( 'glyphicon-chevron-up' );
	lnk.toggleClass( 'glyphicon-chevron-down' );
	
	showStationView( ! visible );
	stationSymbols.enableLines( ! visible );
}

function showStationView( flag ) {
	
	if( flag == true ) {
		$( '#stat-dias' ).css( "display", "block" );		
		$( '#mapview' ).css( "height", "calc( 100% - " + $( '#stat-dias' ).css("height") + " )" );
		stationView.reload();
	} else {
		$( '#stat-dias' ).css( "display", "none" );
		$( '#mapview' ).css( "height", "100%" );
		stationView.deactivate();
	}
	
	google.maps.event.trigger( map, 'resize' );
}

function toggleStations() {
	
	var enabled = $(this).is(":checked");
	
	stationSymbols.show( enabled );
	stationView.enableLines( enabled );
}

function getStationList( handler ) {
		
	var data = {};
	
	if( ! checkPerm("chart") )
		handler( null );
	
	if( ! checkPerm("vsdb") )
		data['inst'] = "gfz_ex_test";
	else if( curuser.inst )
		data['inst'] = curuser.inst.name;
		
	$.ajax({
		type: 'POST',
		url: "webguisrv/stationlist",
		data: data,
		dataType: 'json',
		success: function( result ) {
			serverTime = new Date( result.serverTime );
			
			/* filter stations according to properties */
			var filtered = [];
			for( var i = 0; i < result.stations.length; i++ ) {
				var stat = result.stations[i];
				var elem = contains( curuser.countries, '_id', stat.country );
				var type_ok = (! stat.sensor || ["rad","prs","flt","pr1"].indexOf( stat.sensor ) >= 0 ); 
				if( elem && elem.on && type_ok ) {
					filtered.push( stat );
				}
			}
			result.stations = filtered;
			
			handler( result );
		}, 
		error: function() {
			handler( null );
		}
	});
}

function contains( array, field, value ) {
	
	for( var i = 0; i < array.length; i++ ) {
		if( array[i][field] == value ) {
			return array[i];
		}
	}
	
	return null;
}

function addGlobalStations( result ) {
	
	if( ! result )
		return;
	
	var list = result.stations;
	
	stations.clear();
	for( var i = 0; i < list.length; i++ ) {
		
		var stat = new Station( list[i] );
		stat.load();
		stations.insert( stat );
	}
	
	stationView.reload();
	stationView.enableLines( $( '#stat-chk' ).is(':checked') );
	stationSymbols.recreate();
}

var overlay;

function projection_changed() {
			
	overlay = new google.maps.OverlayView();
	overlay.draw = function() {};
	overlay.setMap( map );
}

function Canvas( widget, rect ) {

	this.widget = widget;
	
	this.resize = function( rect ) {
		
		this.rect = rect;
	};
	
	/* adjusts p1 according to the line created between p1 and p2 */
	this.adjust_point = function( p1, p2 ) {
		
		var p = this.rect;
		var left_adj, right_adj, top_adj, bottom_adj;
		
		var mx = (p2.top - p1.top) / (p2.left - p1.left);
		var my = (p2.left - p1.left) / (p2.top - p1.top);
		
		/* adjust point to the left */
		left_adj = Math.max( p1.left, p.left );
		p1.top = mx * (left_adj - p1.left) + p1.top;
		p1.left = left_adj;
		
		/* adjust point to the right */
		right_adj = Math.min( p1.left, p.left + p.width );
		p1.top = mx * (right_adj - p1.left) + p1.top;
		p1.left = right_adj;
		
		/* adjust point at top */
		top_adj = Math.max( p1.top, p.top );
		p1.left = my * (top_adj - p1.top) + p1.left;
		p1.top = top_adj;
		
		/* adjust point at bottom */
		bottom_adj = Math.min( p1.top, p.top + p.height );
		p1.left = my * (bottom_adj - p1.top) + p1.left;
		p1.top = bottom_adj;
		
		return p1;
	};
	
	this.drawLine = function( p1, p2 ) {
						
		if( this.rect != null ) {
			p1 = this.adjust_point( p1, p2 );
			p2 = this.adjust_point( p2, p1 );
		}
				
		var width = Math.abs(p1.left - p2.left);
		var height =  Math.abs(p1.top - p2.top);
		
		this.widget.width( width );
		this.widget.height( height );
		this.widget.css( "left", Math.min( p1.left, p2.left ) + "px" );
		this.widget.css( "top", Math.min( p1.top, p2.top ) + "px" );
		this.widget.css( "display", "block" );
		
		var canvas = this.widget[0];
		
		canvas.width  = width;
		canvas.height = height;
		
		var ctx = canvas.getContext('2d');
		
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 1;
		ctx.beginPath();
		
		if( p1.left < p2.left ) {
			ctx.moveTo( 0.5, canvas.height );
			ctx.lineTo( canvas.width, 0 );
		} else {
			ctx.moveTo( canvas.width, canvas.height );
			ctx.lineTo( 0, 0 );
		}
	
		ctx.closePath();
		ctx.stroke();
	};
	
	this.clearCanvas = function() {
		
		this.widget.css( "display", "none" );
		
		var canvas = this.widget[0];
		
		canvas.getContext('2d').clearRect( 0, 0, canvas.width, canvas.height );
	};

	this.resize( rect );
}

function LatLonToPixel( lat, lon ) {
	
	var latlon = new google.maps.LatLng( lat, lon );
	var pixel = overlay.getProjection().fromLatLngToContainerPixel( latlon );
	
	return pixel;
}

function Splash() {
		
	this.div = $( '#splash-new' );
	this.navArrow = this.div.find( '.nav-arrow' );
	this.slides = $('#splash-new .slide');
	
	this.last = new Array( this.slides.length );
	
	for( var i = 0; i < this.last.length; i++ )
		this.last[i] = 0;
	
	this.scrollMain = function( e ) {
			
		this.slides.each( this.scrollDiv.bind(this) );
		
		if( $(window).scrollTop() + $(window).height() == $(document).height() ) {
			this.navArrow.removeClass('glyphicon-download');
			this.navArrow.addClass('glyphicon-upload');
		} else {
			this.navArrow.addClass('glyphicon-download');
			this.navArrow.removeClass('glyphicon-upload');
		}
			
	};
	
	this.scrollDiv = function( idx, div ) {
				
		div = $(div);
		var scrollTop = div.scrollTop();
		var diff = $(document).scrollTop() - this.last[idx];
		
		var top = $(document).scrollTop() + $('.container').height();
		
		if( top > div.offset().top && $(document).scrollTop() < div.offset().top + div.height() ) {
			var val = Math.min( scrollTop - diff / 1.5, div.height() );
			val = Math.max( val, 0 );
			div.scrollTop( val );
		}
		
		this.last[idx] = $(document).scrollTop();
	};
	
	this.navigate = function() {
		
		var elem = $( document.elementFromPoint( 0, 0 ) );
		var pos = 0;
		
		elem = elem.closest( '.section, .slide' );
		
		if( elem.length == 0 ) {
			/* we are at the top */
			elem = this.div.find( '.section:first' );
		}
	
		elem = elem.nextAll( '.section' );
		
		if( elem.length > 0 && this.navArrow.hasClass('glyphicon-download') ) {
			/* we are not at the bottom */
			pos = elem.offset().top + 1;
		}
					
		$("html, body").animate( {
			scrollTop: pos
		}, 1000 );
	};
		
	$(window).scroll( this.scrollMain.bind(this) );
	
	$('#splash-new .slide').scrollTop( 5000 );
	
	this.navArrow.click( this.navigate.bind(this) );
}
