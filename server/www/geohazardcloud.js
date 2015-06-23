var map;

Earthquake.prototype = new ICallbacks();

function Earthquake(meta) {

	ICallbacks.call( this );
	
	this.init = function(meta) {
		/*
		 * add all attributes of the passed meta object to this object - be careful
		 * to not override existing fields
		 */
		$.extend(this, meta);		
		this.stations = null;
		this.cfzs = new Container(sort_string.bind(this,'code'));	
		this.jets = new Container(sort_string.bind(this,'ewh'));
		this.isos = new Container();
		this.tfps = new Container();
		
		this.show_cfzs = true;
		this.show_jets = true;
		this.show_isos = true;
		
		/* stores the arrival time upon new isolines should be fetch on the next update */
		this.last_arr = 0;
		
		/* we also want to be notified if the selection status of this event has changed */
		this.setCallback('select', this.select);
		this.setCallback('progress', this.progress);
	};
	
	this.select = function() {
		if( this.selected ) {
			this.loadStations();
			this.load();
		}
	};
		
	/* TODO: check if the type handling is suitable */
	this.load = function(callback,type) {
		/* if the following yields true, we already fetched the results from the server */
		if( this.isLoaded(type) )
			return true;
		
		if(callback)
			this.setCallback(type?'loaded_'+type:'loaded',callback);
		
		/* no simulations results yet, but they are coming soon */
		if( this.process[0].progress < 100 )
			return false;
		/* we need to load at least some missing data */
		if( ! type || type == 'TFPS' )
			this.loadTFPs();
		if( ! type || type == 'CFZS' )
			this.loadCFZs();
		if( ! type || type == 'JETS' )
			this.loadTsunamiJets();
		if( ! type )
			this.loadIsos();
		return false;
	};
	
	this.progress = function() {
		if( this.selected ) {
			this.loadIsos();
		}
	};
		
	this.loadTsunamiJets = function() {
		if( this.jets_loaded )
			return;
		ajax_mt('webguisrv/getjets', {evid:this._id}, (function(result) {
			/* traverse different EWH levels */
			if( !result.jets ) return;
			for (var i = 0; i < result.jets.length; i++) {
				/* each level contains multiple polygons */
				var jets = result.jets[i].points;
				for (var j = 0; j < jets.length; j++) {
					/* construct a single polygon here */
					var pol = new Polygon( [jets[j]], result.jets[i].color );
					pol.poly.setOptions({zIndex:i});
					pol.ewh = result.jets[i].ewh;
					pol.setInfoWin( new InfoWindow('<span>Wave heights greater than ' + pol.ewh + ' meter.</span>') );
					this.jets.insert(pol);
				}
			}
			this.jets_loaded = true;
			this.notifyOn('loaded_JETS');
			this.checkLoaded();
		}).bind(this));
	};
	
	this.loadCFZs = function() {
		if( this.cfzs_loaded )
			return;
		ajax_mt('webguisrv/getcomp', {evid:this._id, kind:'CFZ'}, (function(result) {
			if( !result.comp ) return;
			for( var i = 0; i < result.comp.length; i++ )
				this.cfzs.insert( new CFZResult(result.comp[i]) );
			this.cfzs_loaded = true;
			this.notifyOn('loaded_CFZS');
			this.checkLoaded();
		}).bind(this));
	};
	
	this.loadTFPs = function() {
		if( this.tfps_loaded )
			return;
		ajax_mt('webguisrv/gettfps', {evid:this._id}, (function(result) {
			console.log(result);
			if( !result.comp ) return;
			for (var i = 0; i < result.comp.length; i++) {
				var tfp = new TFP(result.comp[i]);
				tfp.point = new Point( tfp.lat_real, tfp.lon_real );
				tfp.point.setColor( getPoiColor(tfp) );
				tfp.point.setInfoWin( new InfoWindow(tfp.toHtml()) );
				this.tfps.insert( tfp );
			}
			this.tfps_loaded = true;
			this.notifyOn('loaded_TFPS');
			this.checkLoaded();
		}).bind(this));
	};
	
	this.loadIsos = function() {
		ajax_mt('webguisrv/getisos', {evid:this._id, arr:this.last_arr}, (function(result) {
			console.log(result);
			if( !result.comp ) return;
			for (var i = 0; i < result.comp.length; i++ ) {
				var isos = result.comp[i].points;
				for (var j = 0; j < isos.length; j++ ) {
					/* construct a single polyline here */
					var pol = new Polyline( [isos[j]], '#ccaacc' );
					pol.poly.setOptions({zIndex:100});
					this.isos.insert(pol);
				}
				this.last_arr += 10;
			}
			this.notifyOn('update');
		}).bind(this));
	};
		
	this.loadStations = function() {

		/* nothing to do if stations were already loaded */
		if (this.stations != null) {
			this.showStations();
			return;
		}

		/*
		 * get list of stations from server - could be restricted to effected
		 * stations
		 */
		getStationList(this.loadStationData.bind(this));
	};

	/*
	 * will be called asynchronously as soon as the server request, that returns
	 * the station list, has completed
	 */
	this.loadStationData = function(result) {

		if (!result)
			return;

		var lat = this.prop.latitude;
		var lon = this.prop.longitude;

		/* create new container that holds all the stations */
		this.stations = new Container(sort_dist.bind(this, lat, lon));

		/* instantiate each station accordingly and add it to the data container */
		var list = result.stations;
		for (var i = 0; i < list.length; i++) {

			var stat = new Station(list[i], this);
			stat.load();
			this.stations.insert(stat);
			
			/* load picked data for this station */
			var params = {
				evtid: this._id,
				station: stat.name
			};
			ajax('webguisrv/load_picking', params, (function(stat,result) {
				if(result.status == "success") {
					var data = result.data;
					/* transform date strings into date objects */
					data.sliders[1] = new Date(data.sliders[1]);
					data.sliders[2] = new Date(data.sliders[2]);
					stat.setPickData(data);
				}
			}).bind(this,stat));
		}

		this.showStations();
	};

	this.showStations = function() {
		/*
		 * TODO: this is really not the right place here, but how to make it
		 * cleaner?
		 */
		stationView.setData(this.stations);
		stationView.enableLines($('#stat-chk').is(':checked'));
		stationSymbols.setData(this.stations);
	};

	this.hasCompParams = function() {
		var p = this.prop;
		var ret = p.latitude && p.longitude && p.depth && p.magnitude && p.dip
				&& p.strike && p.rake;
		return ret;
	};

	this.getAccel = function() {

		var ret = 1;

		/*
		 * TODO: this is for compatibility reasons only - can be removed in
		 * future releases
		 */
		if (this.process && this.process.length > 0 && this.process[0].accel)
			ret = this.process[0].accel;

		if (this.accel)
			ret = this.accel;

		return ret;
	};

	this.isLoaded = function(type) {
		/* we are already done with loading, if there are no simulation results */
		if( ! this.process || this.process.length == 0 )
			return true;
		if( type == 'TFPS' && this.tfps_loaded )
			return true;
		if( type == 'CFZS' && this.cfzs_loaded )
			return true;
		if( type == 'JETS' && this.jets_loaded )
			return true;
		if( this.jets_loaded && this.cfzs_loaded && this.tfps_loaded )
			return true;
		return false;
	};
	
	this.checkLoaded = function() {
		this.notifyOn('update');
		if( this.isLoaded() )
			this.notifyOn('loaded');
	};
	
	this.init(meta);
}

function EntryMap() {

	this.map = {};

	this.reset = function() {
		this.map = {};
	};

	this.add = function(entry) {

		if (this.map[entry['_id']])
			console.log("Warning: entry with id " + entry['_id']
					+ " already in map.");

		var result = this.map[entry['_id']] = entry;

		result['rectangle'] = null;
		result['show_grid'] = false;
		result['pois'] = null;

		return result;
	};

	this.get = function(id) {
		return this.map[id];
	};

	this.getOrInsert = function(entry) {

		var result = this.map[entry['_id']];

		if (!result)
			return this.add(entry);

		return result;
	};
}

Container.prototype = new ICallbacks();

function Container(sortFun) {

	ICallbacks.call( this );
	
	this.list = [];
	this.sortFun = sortFun;

	this.handler = [];

	this.length = function() {
		return this.list.length;
	};

	this.get = function(i) {
		return this.list[i];
	};

	this.getByKey = function(key, val) {

		for (var i = 0; i < this.list.length; i++) {

			if (this.list[i][key] == val)
				return {
					idx : i,
					item : this.list[i]
				};
		}

		return {
			idx : -1,
			item : null
		};
	};

	this.insert = function(item) {
		
		for (var i = 0; i < this.list.length; i++) {

			if( ! this.sortFun )
				break;
			
			if (this.sortFun(item, this.list[i]) == -1) {

				this.list.splice(i, 0, item);
				return;
			}
		}

		this.list.push(item);
	};

	this.replace = function(key, item) {

		for (var i = 0; i < this.list.length; i++) {

			if (this.list[i][key] == item[key]) {
				this.list[i] = item;
				return;
			}
		}

		this.list.push(item);
	};
	
	this.remove = function(key, val) {
		var idx = this.getByKey(key, val).idx;
		if( idx >= 0 )
			this.list.splice(idx, 1);
	};
	
	this.filter = function(attr,val) {
		var ret = [];
		var f = attr;
		if (typeof(attr) != 'function')
			f = function(o){return o[attr];};
			
		for (var i = 0; i < this.list.length; i++) {
			if( f(this.list[i]) == val )
				ret.push(this.list[i]);
		}
		return ret;
	};

	this.clear = function() {
		this.list.length = 0;
	};

	this.sort = function() {

		this.list.sort(this.sortFun);
	};

	this.setSortFun = function(sortFun) {

		this.sortFun = sortFun;
	};

	this.print = function() {

		for (var i = 0; i < this.list.length; i++) {

			console.log(this.list[i]);
		}
	};
		
	this.sortarr = function(fun) {
		/* copy list */
		var ret = this.list.slice();
		ret.sort(fun);
		return ret;
	};
}

function Station(meta, eq) {

	/*
	 * these are constant fields that should not change during the lifetime of
	 * this object
	 */
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

	/*
	 * and the final table that is either just a reference to the first table or
	 * arises from joining both upper tables
	 */
	this.table = this.table1;

	/* treat data as UTC */
	this.formatter = new google.visualization.DateFormat({
		timeZone : 0
	});

	this.updateHandler = [];

	this.pickData = null;

	this.profile1 = {
		stime : 0,
		etime : 0
	};
	this.profile2 = {
		stime : 0,
		etime : 0
	};

	/*
	 * add all attributes of the passed meta object to this object - be careful
	 * to not override existing fields
	 */
	$.extend(this, meta);

	/* start fetching the data */
	this.load = function() {

		if (!this.eq) {

			/* no event selected */

			/* set start time 180 minutes prior to the current server time */
			this.range = 180 * 60 * 1000;
			this.startTime = new Date(serverTime.getTime() - this.range);
			this.endTime = null;

		} else {

			/* there is a selected event */
			this.noupMax = 2;

			/*
			 * set range to 375 minutes - 15m prior to the origin time and 360m
			 * afterwards
			 */
			this.prior = 15 * 60 * 1000;
			this.range = this.prior + 360 * 60 * 1000;
			this.startTime = new Date(new Date(this.eq.prop.date).getTime()
					- this.prior);
			this.endTime = new Date(this.startTime.getTime() + this.range);

			this.curSimTime = this.startTime;

			// this.fetchSimData( 1, true );
		}

		this.curLiveTime = this.startTime;
		// this.update( 15, true );
	};

	this.setPickData = function(pickData) {
		
		this.pickData = pickData;
	};

	this.activate = function() {

		if (this.active)
			return false;

		this.active = true;

		if (this.eq)
			this.fetchSimData(1, true);

		this.update(15, true);

		return true;
	};

	this.deactivate = function() {
		this.active = false;
	};

	/* most of the time this method will be called asynchronously via setTimeout */
	this.update = function(interval, reactivated) {

		/* check if the station is active; that is, we want to get updates */
		if (!this.active)
			return;

		//console.log("update");

		var data = {
			station : this.name,
			start : this.curLiveTime.toISOString(),
			inst : !checkPerm("vsdb") ? "gfz_ex_test" : curuser.inst.name
		};

		/* append the end time only if it is explicitly given */
		if (this.endTime != null)
			data.end = this.endTime.toISOString();

		this.profile1.stime = Date.now();
		$.ajax({
			type : 'POST',
			url : "webguisrv/getdata",
			dataType : 'json',
			data : data,
			success : (function(result) {

				// console.log( this.name, ": Fetched", result.data.length,
				// "live values in", Date.now() - this.profile1.stime, "ms");

				// console.log( result );

				/*
				 * remove all elements that are out of range now - only relevant
				 * if no event selected
				 */
				if (!this.eq) {
					var lbound = new Date(serverTime.getTime() - this.range);
					var outs = this.table1.getFilteredRows([ {
						column : 0,
						maxValue : lbound
					} ]);
					this.table1.removeRows(0, outs.length);
				}

				if (result.data.length > 0) {

					/* add new data to the live data table */
					for (var i = 0; i < result.data.length; i++) {
						this.table1.addRow([ new Date(result.data[i][0]),
								Number(result.data[i][1]) ]);
					}

					/*
					 * if an event is selected, join with the simulation data to
					 * create the final table
					 */
					if (this.eq) {
						this.profile1.stime = Date.now();
						this.table = google.visualization.data.join(
								this.table1, this.table2, 'full', [ [ 0, 0 ] ],
								[ 1 ], [ 1 ]);
						console.log(this.name, ": Joined", result.data.length,
								"live values in", Date.now()
										- this.profile1.stime, "ms");
					}

					/* update private start time for next call */
					if (result.last)
						this.curLiveTime = new Date(result.last * 1000);

					/*
					 * if the data has changed, notify everyone who is
					 * interested
					 */
					//console.log(this.name, "live notifyUpdate");
					this.notifyUpdate();

				} else if (reactivated) {

					/*
					 * nothing has changed after re-activating, inform listeners
					 * about that
					 */
					//console.log(this.name, "live notifyNoUpdate");
					this.notifyNoUpdate();
				}

				/* call update again after 'interval' seconds */
				setTimeout(this.update.bind(this, interval), interval * 1000);

			}).bind(this)
		});
	};

	this.fetchSimData = function(interval, reactivated) {

		/* check if the station is active; that is, we want to get updates */
		if (!this.active)
			return;

		var data = {
			station : this.name,
			start : this.curSimTime.toISOString(),
			end : this.endTime.toISOString(),
			evid : this.eq._id
		};

		/* is there still anything to fetch? */
		if (this.curSimTime >= this.endTime) {
			if (reactivated)
				/*
				 * nothing has changed after re-activating, inform listeners
				 * about that
				 */
				//console.log(this.name, "sim notifyNoUpdate");
			this.notifyNoUpdate();
			return;
		}

		this.profile2.stime = Date.now();
		$.ajax({
			type : 'POST',
			url : "webguisrv/getsimdata",
			dataType : 'json',
			data : data,
			success : (function(result) {

				// console.log( this.name, ": Fetched", result.data.length, "sim
				// values in", Date.now() - this.profile2.stime, "ms");

				if (result.data.length > 0) {

					/* add new data to the simulation data table */
					for (var i = 0; i < result.data.length; i++) {
						this.table2.addRow([ new Date(result.data[i][0]),
								Number(result.data[i][1]) ]);
					}

					/*
					 * join the simulation with the live data to create the
					 * final table
					 */
					this.profile2.stime = Date.now();
					this.table = google.visualization.data.join(this.table1,
							this.table2, 'full', [ [ 0, 0 ] ], [ 1 ], [ 1 ]);
					// console.log( this.name, ": Joined", result.data.length,
					// "sim values in", Date.now() - this.profile2.stime, "ms");

					/* update start time for next call */
					if (result.last)
						this.curSimTime = new Date(result.last * 1000);

					/* notify everyone who is interested */
					//console.log(this.name, "sim notifyUpdate");
					this.notifyUpdate();

				} else if (reactivated) {

					/*
					 * nothing has changed after re-activating, inform listeners
					 * about that
					 */
					//console.log(this.name, "sim notifyNoUpdate");
					this.notifyNoUpdate();
				}

				/* call update again after 'interval' seconds */
				setTimeout(this.fetchSimData.bind(this, interval),
						interval * 1000);

			}).bind(this)
		});
	};

	/* register handler and return the index into the array */
	this.setOnUpdateListener = function(handler) {
		for (var i = 0; i < this.updateHandler.length; i++)
			if (!this.updateHandler[i]) {
				this.updateHandler[i] = handler;
				return i;
			}

		return this.updateHandler.push(handler) - 1;
	};

	/* remove a registered handler specified by the corresponding index */
	this.removeOnUpdateListener = function(idx) {
		this.updateHandler[idx] = null;
	};

	this.notifyUpdate = function() {
		/* treat values in DataTable as UTC dates */
		this.formatter.format(this.table, 0);

		/* inform anyone interested */
		for (var i = 0; i < this.updateHandler.length; i++)
			if (this.updateHandler[i])
				this.updateHandler[i]();
	};

	/*
	 * this method is used to inform all listeners that the diagram did not
	 * change after activating and thus the loading overlay can be removed
	 */
	this.notifyNoUpdate = function() {

		if (++this.noup == this.noupMax) {
			this.notifyUpdate();
			this.noup = 0;
		}
	};
}

function Chart(data, width, height) {

	this.data = data;
	this.div = $('#chart-div').clone().removeAttr("id");
	this.dia = null;

	this.div.height(height);
	this.div.width(width);

	this.handler = null;

	this.profile = {
		stime : 0
	};

	this.options = {
		curveType : 'function',
		width : width,
		height : height,
		interpolateNulls : true,
		legend : {
			position : 'none'
		}
	};

	this.listenerID = null;

	this.init = function(data) {

		/* make sure that a chart has never more than one listener registered */
		this.dispose();

		this.data = data;

		/*
		 * register handler that will be called if the underlying station data
		 * changes
		 */
		this.listenerID = this.data.setOnUpdateListener((function(_this) {
			return function() {
				_this.refresh();
			};
		})(this));

		this.options.title = data.name;
	};

	this.refresh = function() {

		/* get x-range that should be used when displaying the chart */
		var xmin = this.data.eq ? this.data.startTime : new Date(serverTime
				- this.data.range);
		var xmax = this.data.eq ? this.data.endTime : serverTime;

		if (this.data.eq) {
			var range = this.data.endTime.getTime()
					- this.data.startTime.getTime();
			xmin = new Date(this.data.startTime.getTime() + this.data.prior
					- this.data.prior / this.data.eq.getAccel());
			xmax = new Date(this.data.startTime.getTime() + range
					/ this.data.eq.getAccel());
		}

		/* set 5 ticks on x-axis explicitly */
		var ticks = [];
		var parts = [ 0.0, 0.25, 0.5, 0.75, 1.0 ];
		for (var i = 0; i < parts.length; i++) {
			/*
			 * because Google Charts does not support displaying the x-axis in
			 * UTC time, specify tick labels explicitly
			 */
			var tick = new Date(xmin.getTime()
					+ (xmax.getTime() - xmin.getTime()) * parts[i]);
			var hours = (tick.getHours() + 24 + tick.getTimezoneOffset() / 60) % 24;
			ticks.push({
				v : tick,
				f : zeroPad(hours, 2) + ':' + zeroPad(tick.getMinutes(), 2)
			});
		}

		/* update hAxis */
		this.options.hAxis = {
			viewWindow : {
				min : xmin,
				max : xmax
			},
			ticks : ticks
		};

		this.profile.stime = Date.now();

		this.div.css('display', 'none');

		/* lazy one time initialization */
		if (this.dia == null) {
			this.dia = new google.visualization.LineChart(
					this.div.find('.dia')[0]);
			google.visualization.events.addListener(this.dia, 'ready',
					this.ready.bind(this));
		}

		this.dia.draw(this.data.table, this.options);
		this.div.css('display', 'inline-block');
	};

	this.ready = function() {
		/*console.log("Chart", this.data.name, "drawn in", Date.now()
				- this.profile.stime, "ms");*/
		this.div.find('.spanLoad').css('display', 'none');
	};

	this.dispose = function() {

		if (this.listenerID != null)
			this.data.removeOnUpdateListener(this.listenerID);

		this.listenerID = null;
	};

	this.registerMouseListener = function(handler) {
		this.handler = handler;
	};

	this.chartOnEnter = function() {

		this.div.css("outline", "2px solid #428bca");

		if (this.handler)
			this.handler('enter');
	};

	this.chartOnLeave = function() {

		this.div.css("outline", "1px solid #acaaa7");

		if (this.handler)
			this.handler('leave');
	};

	this.chartOnClick = function() {

		if (this.handler)
			this.handler('click');
	};

	/* check if the chart is visible inside the scroll pane */
	this.isVisible = function() {
		var left = this.div.parent().offset().left;
		var right = this.div.parent().offset().left + this.div.parent().width();
		return this.div.offset().left + this.div.width() > left
				&& this.div.offset().left < right;
	};

	/* display loading overlay */
	this.setLoading = function() {
		this.div.find('.spanInactive').css('display', 'none');
		this.div.find('.spanLoad').css('display', 'block');
	};

	this.div.hover(this.chartOnEnter.bind(this), this.chartOnLeave.bind(this));
	this.div.click(this.chartOnClick.bind(this));

	this.init(this.data);
}

function MainChartDialog(widget) {

	this.dialog = widget;
	this.chart = new MainChart($('#mainchart-div'), 500, 400);
	this.data = null;

	this.multi = 0;

	/* hide picker by default */
	this.picker = false;
	$('#picker .lnkGroup span').removeClass("glyphicon-chevron-up");
	$('#picker .lnkGroup span').addClass("glyphicon-chevron-down");
	$('#picker .grpContent').css("display", "none");

	this.show = function(data) {
		this.data = data;

		/* toggle view depending on earthquake selection */
		if (this.data.eq) {
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

		this.dialog.modal('show');
	};

	this.hide = function() {
		this.dialog.modal('hide');
	};

	/* this method will be called if the dialog is ready */
	this.ready = function() {
		this.chart.init(this.data);
		this.chart.setOnSlideListener(0, this.onAmplSliderChange.bind(this));
		this.chart.setOnSlideListener(1, this.onFreqSliderChange.bind(this));
		this.chart.setOnSlideListener(2, this.onFreqSliderChange.bind(this));
		this.chart.showSliders(this.picker);

		this.loadFormData();
	};

	this.onClose = function() {
		this.saveFormData();
	};

	this.onAmplSliderChange = function() {
		$('#pickerAmpl').val( parseFloat(this.chart.getSliderValue(0)).toFixed(2) );
		this.updatePreview();
	};

	this.onFreqSliderChange = function() {
		var freq = Math.abs(this.chart.getSliderValue(1)
				- this.chart.getSliderValue(2));
		freq = freq / 1000.0 / 60.0;
		$('#pickerFreq').val(freq.toFixed(2));
		this.setTotalFreq();
	};

	this.onFreqInputChange = function(val) {
		this.setTotalFreq();
	};

	this.onAmplInputChange = function(val) {
		this.chart.setSliderValue(0, $('#pickerAmpl').val());
	};

	this.onMultiplierChange = function(e) {
		var elem = $(e.delegateTarget);
		$('#pickerDropDown button span').first().text(elem.text());
		this.multi = elem.parent().index();
		this.setTotalFreq();
	};

	this.setTotalFreq = function() {
		var multi = $('#pickerDropDown button span:first').html();
		var freq = $('#pickerFreq').val();
		$('#pickerFreqTotal').val(freq * multi);
		this.updatePreview();
	};

	this.onTimeChange = function() {
		this.updatePreview();
	};

	this.showPicker = function() {
		this.picker = !this.picker;
		this.chart.showSliders(this.picker);
	};

	this.updatePreview = function() {
		var text = "Period: " + $('#pickerFreqTotal').val()
				+ " minutes &#183; " + "Amplitude: " + $('#pickerAmpl').val()
				+ " meters &#183; " + "Time of Arrival: "
				+ $('#pickerTime').val() + " UTC";

		widget.find('.spanValues').html(text);
	};

	this.updateTime = function() {

		if (!serverTime)
			return;

		var sec = zeroPad(serverTime.getSeconds(), 2);

		widget.find('.localTime').html(
				getLocalDateString(serverTime) + ':' + sec);
		widget.find('.utcTime').html(getDateString(serverTime) + ':' + sec);
	};

	this.saveFormData = function() {
		var formData = {};

		formData.sliders = new Array(3);
		for (var i = 0; i < 3; i++)
			formData.sliders[i] = this.chart.getSliderValue(i);

		formData.zoom = this.chart.zoom;
		formData.left = this.chart.left;

		formData.multi = this.multi;
		formData.period = new Number($('#pickerFreqTotal').val());
		formData.ampl = new Number($('#pickerAmpl').val());
		formData.time = $('#pickerTime').val();
		formData.pick = $('#pickerEnable').prop('checked');

		this.data.setPickData(formData);
		
		/* store pickings on server only if an event is selected */
		if( ! this.data.eq )
			return;
		
		var params = {
			evtid: this.data.eq._id,
			station: this.data.name,
			data: JSON.stringify(formData)
		};
		ajax_mt('webguisrv/save_picking', params, null);
	};

	this.loadFormData = function() {
		var formData = this.data.pickData;
		var bounds = this.chart.getAxisBounds();
		
		if (formData) {
			for (var i = 0; i < 3; i++)
				this.chart.setSliderValue(i, formData.sliders[i]);

			this.chart.setState(formData.zoom, formData.left);

			$('#pickerDropDown li a')[formData.multi].click();
			$('#pickerTime').val(formData.time);
			$('#pickerEnable').prop('checked', formData.pick);

		} else {

			this.chart.setState(1, 0);
			this.chart.setSliderValue(0, 0);
			this.chart.setSliderValue(1, bounds.xmin);
			this.chart.setSliderValue(2, bounds.xmax);

			var time = zeroPad(bounds.xmin.getUTCHours(), 2) + ':'
					+ zeroPad(bounds.xmin.getUTCMinutes(), 2);

			$('#pickerDropDown li a')[0].click();
			$('#pickerTime').val(time);
			$('#pickerEnable').prop('checked', false);
		}

		this.updatePreview();
	};

	/* register all handlers used within this dialog */
	this.dialog.on('shown.bs.modal', this.ready.bind(this));
	this.dialog.on('hide.bs.modal', this.onClose.bind(this));
	$('#pickerFreq').change(this.onFreqInputChange.bind(this));
	$('#pickerAmpl').change(this.onAmplInputChange.bind(this));
	$('#pickerTime').change(this.onTimeChange.bind(this));
	$('#pickerDropDown li a').click(this.onMultiplierChange.bind(this));
	$('#picker .lnkGroup').click(this.showPicker.bind(this));

	/* update time every second */
	setInterval(this.updateTime.bind(this), 1000);
}

function Slider(vertical, off, len, middle, min, max, widget) {

	this.widget = widget;
	this.canvas_slider = $('<canvas class="canvas-gen" />').appendTo(widget);
	this.canvas_line = $('<canvas class="canvas-gen" />').appendTo(widget);

	this.vertical = vertical;
	this.pos = {
		off : off,
		len : len,
		middle : 0
	};
	this.range = {
		min : min,
		max : max
	};

	this.down = null;
	this.handler = null;

	this.setValue = function(val) {
		/* set value and adjust if outside the range */
		this.pos.middle = Math.max(Math.min(val, this.range.max),
				this.range.min);
		this.draw();
	};

	this.getValue = function() {
		return this.pos.middle;
	};

	this.onMouseDown = function(e) {

		/* other elements should not react on this event */
		e.preventDefault();
		e.stopPropagation();

		$(window).on('mousemove', this.onMouseMove.bind(this));
		$(window).on('mouseup', this.onMouseUp.bind(this));

		this.down = {
			x : e.pageX,
			y : e.pageY
		};
	};

	this.onMouseMove = function(e) {

		/* other elements should not react on this event */
		e.preventDefault();
		e.stopPropagation();

		var diff = 0;

		if (this.vertical == false) {
			diff = e.pageY - this.down.y;
		} else {
			diff = e.pageX - this.down.x;
		}

		this.pos.middle += diff;

		if (this.pos.middle < this.range.min) {
			this.pos.middle = this.range.min;
		} else if (this.pos.middle > this.range.max) {
			this.pos.middle = this.range.max;
		} else {
			this.down.y += diff;
			this.down.x += diff;
		}

		this.draw();

		if (this.handler)
			this.handler(this.pos.middle);
	};

	this.onMouseUp = function(e) {

		/* other elements should not react on this event */
		e.preventDefault();
		e.stopPropagation();

		$(window).off('mousemove');
		$(window).off('mouseup');
		this.down = null;
	};

	this.setOnChangeListener = function(handler) {

		this.handler = handler;
	};

	this.dispose = function() {
		this.canvas_slider.remove();
		this.canvas_line.remove();
	};

	this.draw = function() {

		var size = 15;
		var left, top;

		this.canvas_slider.width(size);
		this.canvas_slider.height(size);

		if (this.vertical == false) {
			left = this.pos.off;
			top = this.pos.middle - size / 2;
		} else {
			left = this.pos.middle - size / 2;
			top = this.pos.off + this.pos.len - size;
		}

		this.canvas_slider.css("left", left + "px");
		this.canvas_slider.css("top", top + "px");

		var canvas = this.canvas_slider[0];
		canvas.width = this.canvas_slider.width();
		canvas.height = this.canvas_slider.height();

		var ctx = canvas.getContext('2d');

		ctx.fillStyle = 'black';
		ctx.lineWidth = 1;
		ctx.beginPath();

		if (this.vertical == false) {
			ctx.moveTo(0, 0);
			ctx.lineTo(size, size / 2.0);
			ctx.lineTo(0, size);
		} else {
			ctx.moveTo(0, size);
			ctx.lineTo(size / 2.0, 0);
			ctx.lineTo(size, size);
		}
		ctx.closePath();
		ctx.fill();

		/* draw line */
		var thick = 1;

		if (this.vertical == false) {
			this.canvas_line.width(this.pos.len - size + 1);
			this.canvas_line.height(thick);

			left = left + size - 1;
			top = this.pos.middle - thick / 2.0;
		} else {
			this.canvas_line.width(thick);
			this.canvas_line.height(this.pos.len - size + 1);

			left = this.pos.middle - thick / 2.0;
			top = this.pos.off;
		}

		this.canvas_line.css("left", left + "px");
		this.canvas_line.css("top", top + "px");

		canvas = this.canvas_line[0];
		canvas.width = this.canvas_line.width();
		canvas.height = this.canvas_line.height();

		ctx = canvas.getContext('2d');
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 1;
		ctx.beginPath();

		if (this.vertical == false) {
			ctx.moveTo(0, thick / 2.0);
			ctx.lineTo(canvas.width, thick / 2.0);
		} else {
			ctx.moveTo(thick / 2.0, 0);
			ctx.lineTo(thick / 2.0, canvas.height);
		}

		ctx.closePath();
		ctx.stroke();
	};

	this.show = function(val) {
		var cssVal = val ? 'block' : 'none';
		this.canvas_line.css('display', cssVal);
		this.canvas_slider.css('display', cssVal);
	};

	this.canvas_slider.on('mousedown', this.onMouseDown.bind(this));

	this.setValue(middle);
}

function MainChart(widget, width, height) {

	this.data = null;
	this.div = widget;
	this.dia = new google.visualization.LineChart(this.div[0]);

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
		curveType : 'function',
		width : width,
		height : height,
		interpolateNulls : true
	};

	this.init = function(data) {

		this.dispose();

		this.data = data;
		this.options.title = data.name;

		/*
		 * register handler that will be called if the underlying station data
		 * changes
		 */
		this.listenerID = this.data.setOnUpdateListener((function(_this) {
			return function() {
				_this.refresh();
			};
		})(this));

		this.refresh();
	};

	this.dispose = function() {
		for (var i = 0; i < this.slider.length; i++)
			this.slider[i].dispose();

		this.slider = [];
	};

	this.refresh = function() {

		/* get x-range that should be used when displaying the chart */
		var xmin = this.data.eq ? this.data.startTime : new Date(serverTime
				- this.data.range);
		var xmax = this.data.eq ? this.data.endTime : serverTime;

		if (this.data.eq) {
			var range = this.data.endTime.getTime()
					- this.data.startTime.getTime();
			xmin = new Date(this.data.startTime.getTime() + this.data.prior
					- this.data.prior / this.data.eq.getAccel());
			xmax = new Date(this.data.startTime.getTime() + range
					/ this.data.eq.getAccel());
		}

		var diff = xmax.getTime() - xmin.getTime();
		var hiddenPart = diff * (1 - this.zoom);
		xmin = new Date(xmin.getTime() + hiddenPart + this.left * hiddenPart);
		xmax = new Date(xmax.getTime() + this.left * hiddenPart);

		/* set 5 ticks on x-axis explicitly */
		var ticks = [];
		var parts = [ 0.0, 0.25, 0.5, 0.75, 1.0 ];
		for (var i = 0; i < parts.length; i++) {
			/*
			 * because Google Charts does not support displaying the x-axis in
			 * UTC time, specify tick labels explicitly
			 */
			var tick = new Date(xmin.getTime()
					+ (xmax.getTime() - xmin.getTime()) * parts[i]);
			var hours = (tick.getHours() + tick.getTimezoneOffset() / 60 + 24) % 24;
			ticks.push({
				v : tick,
				f : zeroPad(hours, 2) + ':' + zeroPad(tick.getMinutes(), 2)
			});
		}

		/* update hAxis */
		this.options.hAxis = {
			viewWindow : {
				min : xmin,
				max : xmax
			},
			ticks : ticks
		};

		this.dia.draw(this.data.table, this.options);
	};

	this.ready = function() {

		/* do one time initializations here */
		if (this.slider.length == 0) {

			var cli = this.dia.getChartLayoutInterface();
			var box = cli.getChartAreaBoundingBox();
			var ampl = cli.getYLocation(0);
			
			this.slider.push(new Slider(false, box.left - 30, box.width + 50,
					ampl, box.top + this.div.position().top, box.top + this.div.position().top + box.height - 1, widget));
			this.slider.push(new Slider(true, box.top + 57, box.height + 40,
					box.left, box.left + this.div.position().left, box.left + this.div.position().left + box.width - 1, widget));
			this.slider.push(new Slider(true, box.top + 57, box.height + 40,
					box.left + box.width, box.left + this.div.position().left, box.left + this.div.position().left + box.width - 1,
					widget));

			for (var i = 0; i < this.slider.length; i++) {
				this.handler.push(null);
				this.values.push(null);
				this.slider[i].setOnChangeListener(this.onControlChange.bind(
						this, i));
			}

			/* set bounding box with relative coordinates */
			this.bbox = box;
		}

		/* update sliders according to new diagram range */
		for (var i = 0; i < this.slider.length; i++) {
			if (this.values[i] != null)
				this.setSliderValue(i, this.values[i]);
		}
	};

	this.setState = function(zoom, left) {
		this.zoom = zoom;
		this.left = left;
		this.refresh();
	};

	this.setOnSlideListener = function(idx, handler) {

		if (idx >= this.slider.length)
			return;

		this.handler[idx] = handler;
	};

	this.onControlChange = function(idx, val) {

		var val = this.slider[idx].pos.middle;
		
		if (idx == 0) {
			this.values[idx] = this.dia.getChartLayoutInterface().getVAxisValue(val - this.div.position().top);
		} else {
			this.values[idx] = this.dia.getChartLayoutInterface().getHAxisValue(val - this.div.position().left);
		}
			
		if (this.handler[idx])
			this.handler[idx](this.values[idx]);
	};

	this.getSliderValue = function(idx) {
		return this.values[idx];
	};

	this.setSliderValue = function(idx, val) {

		var trans;

		this.values[idx] = val;
		
		if (idx == 0) {
			trans = this.dia.getChartLayoutInterface().getYLocation(val) + this.div.position().top;
		} else {
			trans = this.dia.getChartLayoutInterface().getXLocation(val) + this.div.position().left;
		}
				
		this.slider[idx].setValue(trans);

		if (this.handler[idx])
			this.handler[idx](this.values[idx]);
	};

	this.showSliders = function(val) {
		for (var i = 0; i < this.slider.length; i++)
			this.slider[i].show(val);
	};

	this.getAxisBounds = function() {
		var win = this.options.hAxis.viewWindow;
		return {
			xmin : win.min,
			xmax : win.max
		};
	};

	/* */
	this.onMouseDown = function(e) {

		/*
		 * check if the event refers to the chart area and not something around
		 * it (e.g the label)
		 */
		if (!this.isInsideBBox({
			x : e.clientX,
			y : e.clientY
		}))
			return;

		this.drag = {
			x : e.clientX,
			y : e.clientY
		};
		$(window).mousemove(this.onMouseDrag.bind(this));
		$(window).mouseup(this.onMouseUp.bind(this));
	};

	this.onMouseUp = function(e) {
		this.drag = null;
		$(window).unbind('mousemove');
	};

	this.onMouseDrag = function(e) {
		var diff = this.drag.x - e.clientX;
		this.drag = {
			x : e.clientX,
			y : e.clientY
		};

		this.left += (diff / this.options.width);
		this.left = Math.min(this.left, 0);
		this.left = Math.max(this.left, -1);

		this.refresh();
	};

	this.onMouseWheelFF = function(e) {

		/*
		 * check if the event refers to the chart area and not something around
		 * it (e.g the label)
		 */
		if (!this.isInsideBBox({
			x : e.clientX,
			y : e.clientY
		}))
			return;

		this.zoomDia(-e.originalEvent.detail);
	};

	this.onMouseWheel = function(e) {

		/*
		 * check if the event refers to the chart area and not something around
		 * it (e.g the label)
		 */
		if (!this.isInsideBBox({
			x : e.clientX,
			y : e.clientY
		}))
			return;

		this.zoomDia(e.originalEvent.wheelDelta);
	};

	this.zoomDia = function(offset) {

		var delta = offset > 0 ? 0.5 : 2;
		this.zoom *= delta;
		this.zoom = Math.max(this.zoom, 0.125);
		this.zoom = Math.min(this.zoom, 1);

		this.refresh();
	};

	this.isInsideBBox = function(p) {

		/* get relative coordinates of given point */
		var x = p.x - this.div.offset().left;
		var y = p.y - this.div.offset().top;

		/* check if point lies inside the bounding box */
		if (x < this.bbox.left || x > this.bbox.left + this.bbox.width
				|| y < this.bbox.top || y > this.bbox.top + this.bbox.height)
			return false;

		return true;
	};

	this.div.mousedown(this.onMouseDown.bind(this));

	this.div.bind('mousewheel', this.onMouseWheel.bind(this));
	this.div.bind('DOMMouseScroll', this.onMouseWheelFF.bind(this));

	google.visualization.events.addListener(this.dia, 'ready', this.ready
			.bind(this));
}

function StationView(widget, data) {

	this.widget = widget;
	this.data = data;
	this.box_list = [];

	this.lines_on = false;
	this.timer = null;

	/* should be called after stations were added to the data container */
	this.reload = function() {

		this.widget.empty();

		if (!this.widget.is(':visible') || this.data.length() == 0) {
			this.widget
					.append('<div class="lnkSelect"><a href="javascript:showProp(null,\'#propTabStations\')">Select stations</a></div>');
			return;
		}

		this.dispose();

		var width = 200;
		var height = this.widget[0].clientHeight - 30;

		/*
		 * make the widget invisible to speed up appending new charts inside the
		 * following loop
		 */
		this.widget.css('display', 'none');

		for (var i = 0; i < this.data.length(); i++) {

			var item = this.data.get(i);

			if (this.box_list.length - 1 < i) {
				var chart = new Chart(item, width, height);
				chart.registerMouseListener(this.onMouseAction.bind(this, i));
				this.box_list.push(chart);
			} else {
				this.box_list[i].init(item);
			}

			this.widget.append(this.box_list[i].div);
		}

		this.widget.css('display', 'block');

		this.activate();
	};

	this.dispose = function() {

		this.deactivate();

		for (var i = 0; i < this.box_list.length; i++)
			this.box_list[i].dispose();

		this.box_list = [];
	};

	/* should be called after sorting stations in the data container */
	this.update = function() {

		for (var i = 0; i < this.data.length(); i++)
			this.box_list[i].init(this.data.get(i));

		this.activate();
	};

	this.enableLines = function(on) {
		this.lines_on = on;
	};

	this.scrollTo = function(idx, step_fun, done_fun) {

		var box = this.box_list[idx].div;
		var ref = this.widget.scrollLeft();

		var val = ref + box.position().left
				- (this.widget.width() - box.width()) / 2;
		val = Math.max(0, val);

		this.widget.animate({
			scrollLeft : val
		}, {
			duration : 750,
			step : step_fun,
			done : done_fun
		});

		// this.widget.scrollLeft( val );
	};

	this.drawLine = function(idx) {

		var box = this.box_list[idx].div;
		var p1 = box.offset();
		p1.left += box.width() / 2;

		var item = this.data.get(idx);
		var pixel = LatLonToPixel(item.lat, item.lon);
		var p2 = $('#mapview').offset();

		p2.left += pixel.x;
		p2.top += pixel.y;

		canvas.drawLine(p1, p2);
	};

	this.onMouseAction = function(idx, type) {

		if (type == 'enter') {

			stationSymbols.highlight(idx, true);
			if (this.lines_on)
				this.drawLine(idx);

		} else if (type == 'leave') {

			stationSymbols.highlight(idx, false);
			canvas.clearCanvas();

		} else if (type == 'click') {

			if (this.lines_on) {
				map.panTo(stationSymbols.symbols[idx].marker.getPosition());
				this.drawLine(idx);
			}
			dialogs.chart.show(this.data.get(idx));
		}
	};

	this.setData = function(data) {

		this.deactivate();

		this.data = data;
		this.reload();
	};

	/* return list of visible stations */
	this.getVisible = function() {
		var list = [];
		for (var i = 0; i < this.data.length(); i++)
			if (this.box_list[i].isVisible())
				list.push(i);
		return list;
	};

	/* call function 'activate' 0.5 sec after a scroll action is finished */
	this.onScroll = function() {
		if (this.timer)
			clearTimeout(this.timer);

		this.timer = setTimeout(this.activate.bind(this), 500);
	};

	/* activate all visible stations */
	this.activate = function() {
		this.timer = null;
		var visibles = this.getVisible();
		this.deactivateAll(visibles);

		for (var i = 0; i < visibles.length; i++) {
			var idx = visibles[i];
			if (this.data.get(idx).activate())
				this.box_list[idx].setLoading();
		}
	};

	/* deactivate all stations except the given list */
	this.deactivateAll = function(excepts) {
		var start = 0;

		for (var j = 0; j < excepts.length; j++) {
			for (var i = start; i < excepts[j]; i++) {
				this.data.get(i).deactivate();
			}
			start = excepts[j] + 1;
		}

		for (var i = start; i < this.data.length(); i++) {
			this.data.get(i).deactivate();
		}
	};

	/* deactivate all stations */
	this.deactivate = function() {
		if (this.data) {
			for (var i = 0; i < this.data.length(); i++)
				this.data.get(i).deactivate();
		}
	};

	this.widget.scroll(this.onScroll.bind(this));
}

function Symbol(marker, idx, list) {

	this.marker = marker;
	this.idx = idx;
	this.list = list; /* StationSymbols */

	this.mouseIn = false;

	with ({
		_this : this
	}) {
		google.maps.event.addListener(this.marker, 'click', function() {

			_this.list.symbolOnClick(_this);
		});
	}

	with ({
		_this : this
	}) {
		google.maps.event.addListener(this.marker, 'mouseover', function() {

			_this.mouseIn = true;
			_this.highlight(true);
			_this.list.symbolOnMouseEnter(_this);
		});
	}

	with ({
		_this : this
	}) {
		google.maps.event.addListener(this.marker, 'mouseout', function() {

			_this.mouseIn = false;
			_this.highlight(false);
			_this.list.symbolOnMouseLeave(_this);
		});
	}

	this.highlight = function(yes) {

		var weight = yes ? 1.5 : 1.0;

		var icon = this.marker.getIcon();
		icon.strokeWeight = weight;
		this.marker.setIcon(icon);
	};

	this.show = function(yes) {

		this.marker.setMap(yes ? map : null);
	};

	this.destroy = function() {

		this.show(false);
		this.marker = null;
	};
}

function StationSymbols(data, show) {

	this.symbols = [];
	this.showLines = false;
	this.data = data;
	this.visible = show;

	this.info = new google.maps.InfoWindow();

	this.create = function() {

		for (var i = 0; i < this.data.length(); i++) {

			var item = this.data.get(i);
			var pos = new google.maps.LatLng(item.lat, item.lon);

			var marker = new google.maps.Marker({
				position : pos,
				map : null,
				icon : {
					anchor : new google.maps.Point(0, 2),
					path : google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
					fillOpacity : 0.7,
					fillColor : 'green',
					strokeOpacity : 1.0,
					strokeColor : "white",
					strokeWeight : 1.0,
					scale : 3.5
				// pixels
				}
			});

			this.symbols.push(new Symbol(marker, i, this));
		}

		this.show(this.visible);
	};

	this.setData = function(data) {
		this.data = data;
		this.recreate();
	};

	this.removeAll = function() {

		for (var i = 0; i < this.symbols.length; i++)
			this.symbols[i].destroy();

		this.symbols.length = 0;
	};

	this.recreate = function() {

		this.removeAll();
		this.create();
	};

	this.drawLine = function(idx, marker) {

		var box = stationView.box_list[idx].div;
		var p1 = box.offset();
		p1.left += box.width() / 2;

		var latlng = marker.getPosition();
		var pixel = LatLonToPixel(latlng.lat(), latlng.lng());

		var p2 = $('#mapview').offset();
		p2.left += pixel.x;
		p2.top += pixel.y;

		canvas.drawLine(p1, p2);
	};

	this.removeLine = function() {

		canvas.clearCanvas();
	};

	this.symbolOnClick = function(symbol) {

		var item = this.data.get(symbol.idx);

		/* scroll to diagram and redraw the line */
		with ({
			_this : this
		}) {
			stationView.scrollTo(symbol.idx, function() {
				_this.removeLine();
				if (_this.showLines)
					_this.drawLine(symbol.idx, symbol.marker);
			}, function() {
				if (!symbol.mouseIn)
					_this.removeLine();
			});
		}

		this.info.setContent(item.name);
		this.info.open(map, symbol.marker);
	};

	this.symbolOnMouseEnter = function(symbol) {

		if (this.showLines)
			this.drawLine(symbol.idx, symbol.marker);
	};

	this.symbolOnMouseLeave = function(symbol) {

		this.info.close();
		this.removeLine();
	};

	this.show = function(yes) {

		this.visible = yes;

		for (var i = 0; i < this.symbols.length; i++)
			this.symbols[i].show(yes);
	};

	this.highlight = function(idx, yes) {

		this.symbols[idx].highlight(yes);
	};

	this.enableLines = function(enable) {

		this.showLines = enable;
	};

	this.create();
}

function sort_string(field, a, b) {

	if (a[field] < b[field])
		return -1;

	if (a[field] > b[field])
		return 1;

	return 0;
}

function sort_dist(lat, lon, a, b) {

	/*
	 * calculating the distance between two longitudes must respect the wrap
	 * around -180 and +180 degree
	 */
	var a_lon = Math.min(Math.abs(a.lon - lon), 180 - Math.abs(lon) + 180
			- Math.abs(a.lon));
	var b_lon = Math.min(Math.abs(b.lon - lon), 180 - Math.abs(lon) + 180
			- Math.abs(b.lon));

	var dist_a = Math.sqrt(Math.pow(a.lat - lat, 2) + Math.pow(a_lon, 2));
	var dist_b = Math.sqrt(Math.pow(b.lat - lat, 2) + Math.pow(b_lon, 2));

	if (dist_a < dist_b)
		return -1;

	if (dist_a > dist_b)
		return 1;

	return 0;
}

function sort_date(dir, a, b) {

	if (new Date(a.prop.date) < new Date(b.prop.date))
		return dir;
	else if (new Date(a.prop.date) > new Date(b.prop.date))
		return dir;

	return 0;
}

function sort_timeline(a, b) {

	/*
	 * because of inconsistent field naming, we have to distinguish at this
	 * point :(
	 */
	var a_date = a.timestamp ? a.timestamp : a.CreatedTime;
	var b_date = b.timestamp ? b.timestamp : b.CreatedTime;

	if (new Date(a_date) < new Date(b_date))
		return 1;
	else if (new Date(a_date) > new Date(b_date))
		return -1;

	return 0;
}

function VsdbPlayer(div) {

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

		function success(obj) {

			this.drpNames.find('ul').empty();

			this.scenarios = obj.result.list;

			for (var i = 0; i < this.scenarios.length; i++) {
				var name = this.scenarios[i].name;
				var id = this.scenarios[i].id;
				this.drpNames.find('ul').append(
						'<li class="id_' + id + '"><a href="#">' + name
								+ '</a></li>');

				var sensors = [];
				for (var j = 0; j < this.scenarios[i].sensors.length; j++) {
					if (this.scenarios[i].sensors[j].type != "UshahidiSensor")
						sensors.push(this.scenarios[i].sensors[j].urn);
				}
				this.scenarios[i].sensors = sensors;
			}

			this.drpNames.find('a').click(this.onDrpChange.bind(this));
			this.update();
		}
		;

		if (this.base == null)
			return;

		this.drpAccel.find('ul').empty();

		for (var k = 1; k <= 10; k++)
			this.drpAccel.find('ul').append(
					'<li><a href="#">' + k + '</a></li>');

		this.drpAccel.find('ul').append('<li><a href="#">' + 16 + '</a></li>');

		this.drpAccel.find('a').click(this.onDrpChange.bind(this));

		this.btnPlay.find('.load').hide();

		this.request('simlist', [], success.bind(this));
	};

	this.setBase = function(base) {
		this.base = base;
		this.init();
	};

	this.start = function() {

		function success(result) {
			console.log(result);
		}
		;

		var params;
		params = [ this.scenario.id, null, this.accel, this.scenario.sensors ];

		this.drpNames.find('button').prop('disabled', true);
		this.drpAccel.find('button').prop('disabled', true);
		this.btnPlay.prop('disabled', true);

		this.btnPlay.find('.ready').hide();
		this.btnPlay.find('.load').show();

		this.cancelled = false;
		this.request('startsim', params, success.bind(this));
	};

	this.stop = function() {

		function success(result) {
			console.log(result);
		}

		this.cancelled = true;
		this.request('stopsim', [], success.bind(this));
	};

	this.update = function() {

		function success(obj) {

			var status = obj.result;

			/* toggle buttons if the state changes */
			if (status.running != this.running) {
				this.running = status.running;
				this.btnPlay.find('span').toggleClass('glyphicon-play');
				this.btnPlay.find('span').toggleClass('glyphicon-stop');
				this.drpNames.find('button').prop('disabled', this.running);
				this.drpAccel.find('button').prop('disabled', this.running);
				this.btnPlay.prop('disabled', false);

				/* show progress bar and resize the entire page */
				this.div.find('.progress').show();
				onResize();

				if (!this.running) {
					this.btnPlay.removeClass("btn-danger");
					this.btnPlay.addClass("btn-success");
				} else {
					this.btnPlay.addClass("btn-danger");
					this.btnPlay.removeClass("btn-success");
				}

				if (this.running == false && this.cancelled) {
					this.progess.find('.progress-txt').html(
							"Scenario cancelled.");
				}

				this.btnPlay.find('.load').hide();
				this.btnPlay.find('.ready').show();
			}

			/* set acceleration factor if player was already running */
			if (status.ff && status.ff != this.accel) {
				this.drpAccel.find('button').html(
						status.ff + ' <span class="caret"></span>');
				this.accel = status.ff;
			}

			/* set scenario if player was already running */
			if (status.simname && !this.scenario) {
				var idx = this.drpNames.find('.id_' + status.simid).index();
				this.scenario = this.scenarios[idx];
				this.drpNames.find('button').html(
						status.simname + ' <span class="caret"></span>');
			}

			/* update progress */
			if (status.starttime) {
				var text;
				var progress = 0;

				if (status.pos < 0) {
					var dur = -status.pos / 1000 / this.accel;
					text = "Starting in " + dur.toFixed() + " seconds...";
				} else {
					progress = (status.pos / status.end) * 100;
					text = progress.toFixed(1) + " %";
				}

				this.progess.css('width', progress + '%');
				this.progess.find('.progress-txt').html(text);
			}

			setTimeout(this.update.bind(this), 1000);
		}
		;

		this.request('status', [], success.bind(this));
	};

	this.request = function(method, params, callback) {

		var data = {
			jsonrpc : '2.0',
			method : method,
			params : params,
			id : "id"
		};

		$
				.ajax({
					type : 'POST',
					contentType : 'application/json; charset=utf-8',
					url : this.base + '/services/',
					data : JSON.stringify(data),
					dataType : "json",
					success : function(result) {
						if (callback)
							callback(result);
					},
					error : function() {
						console
								.log('Error while sending a request to the VSDB-Player.');
					}
				});
	};

	/* will be called if the play/stop button is pressed */
	this.onClick = function() {

		/* everything must be specified */
		if (!this.scenario || !this.accel)
			return;

		if (this.running == false) {
			this.start();
		} else {
			this.stop();
		}
	};

	this.onDrpChange = function(e) {
		var item = $(e.delegateTarget);
		var dropdown = item.closest('.dropdown');
		dropdown.find('button').html(item.html() + " ");
		dropdown.find('button').append('<span class="caret"></span>');

		if (dropdown.is(this.drpNames)) {
			this.scenario = this.scenarios[item.closest('li').index()];
		} else if (dropdown.is(this.drpAccel)) {
			this.accel = item.html();
		}

		if (this.scenario && this.accel) {
			this.btnPlay.prop('disabled', false);
		}
	};

	/* register event handlers */
	this.btnPlay.click(this.onClick.bind(this));

	this.init();
}

Filter.prototype = new ICallbacks();

function Filter(div) {

	ICallbacks.call(this);
	
	this.init = function(div) {
		
		/* store reference to HTML objects */
		this.div = div;
		this.labRange = this.div.find('.labRange');
		this.chkMT = this.div.find('.chkMT');
		this.chkSim = this.div.find('.chkSim');
		this.chkSea = this.div.find('.chkSea');

		/* store values */
		this.mt = false;
		this.sim = false;
		this.sea = false;

		/* set on change listener */
		this.chkMT.change(this.onChange.bind(this));
		this.chkSim.change(this.onChange.bind(this));
		this.chkSea.change(this.onChange.bind(this));
		
		this.slider = new HtmlRangeSlider(0, 10, 0.5);
		this.slider.setCallback('change', this.onChange.bind(this));
		this.slider.setCallback('slide', this.onSlide.bind(this));
		this.div.find('.slider').append(this.slider.div);
		
		/* initial slide */
		this.onSlide( this.slider.values() );
	};

	this.onChange = function() {
		this.notifyOn('change');
	};
	
	this.onSlide = function(values) {
		this.labRange.html( values[0] + ' - ' + values[1] );
	};

	/* this function accepts one argument of type Earthquake */
	this.filter = function( /* Earthquake */eq) {

		if( ! this.slider.contains( eq.prop.magnitude ) )
			return false;

		if (this.chkMT.is(':checked') && !eq.hasCompParams())
			return false;

		if (this.chkSim.is(':checked') && !eq.process)
			return false;

		if (this.chkSea.is(':checked') && !eq.prop.sea_area)
			return false;

		return true;
	};

	this.init(div);
}

GlobalControl.prototype = new ICallbacks();

function GlobalControl() {

	ICallbacks.call(this);
	
	// this.map = map;
	this.filterWidget = new Filter($('#filterWidget'));
	this.mapProgress = $('.map_progress');
	
	/* MailDialog */
	this.mailDialog = new MailDialog();
	/* InfoDialog */
	this.infoDialog = new InfoDialog();
	/* PropDialog*/
	this.propDialog = new PropDialog();
	/* make dialogs visible if initialization is finished */
	$('.dialog-templates').show();

	eqlist = new Container(sort_date.bind(this, -1));
	saved = new Container(sort_timeline);
	timeline = new Container(sort_timeline);
	messages = new Container(sort_date.bind(this, -1));
	shared = new Container(sort_date.bind(this, -1));
	
	this.layers = new Container(sort_string.bind(this,'name'));
		
	this.main = function() {

		var callbacks = {
			'clk_entry' : this.vis.bind(this),
			'clk_timeline' : this.search.bind(this),
			'clk_copy' : this.copy.bind(this),
			'clk_info' : this.info.bind(this),
			'clk_edit' : this.edit.bind(this),
			'clk_send' : this.send.bind(this),
			'clk_share' : this.share.bind(this),
			'clk_grid': this.grid.bind(this),
			'clk_delete' : this.remove.bind(this),
			'clk_show' : this.show.bind(this),
		};
		
		var w;
		this.widgets = {};

		w = new ListWidget($('#sidebar'), eqlist, map, callbacks);
		this.filterWidget.setCallback('change', w.create.bind(w));
		w.addFilter(this.filterWidget.filter.bind(this.filterWidget));
		w.create();
		w.show();
		this.widgets['tabRecent'] = w;

		w = new MyListWidget($('#saved'), saved, map, callbacks);
		w.create();
		this.widgets['tabSaved'] = w;

		w = new ListWidget($('#timeline-data'), timeline, map, callbacks);
		w.create();
		this.widgets['tabTimeline'] = w;

		w = new ListWidget($('#messages'), messages, map, callbacks);
		w.create();
		this.widgets['tabMessages'] = w;
		
		w = new ListWidget($('#static'), shared, map, callbacks);
		w.create();
		this.widgets['tabStatic'] = w;
		
		/* register jquery event handlers */
		$('.main-tabs > li').click(this.tabChanged.bind(this));
		$('#btnDeselect').click(this.deselect.bind(this));
		
		/* add layers */
		this.layers.insert( new CFZLayer('CFZ-Layer', map) );
		this.layers.insert( new JetLayer('Tsunami-Jets', map) );
		this.layers.insert( new IsoLayer('Isolines', map) );
		this.layers.insert( new TFPLayer('FTP-Layer', map) );
		for( var i = 0; i < this.layers.length(); i++ ) {
			var layer = this.layers.get(i);
			this.setCallback('select', layer.setData.bind(layer));
		}
		//new LayerSwitcher( $('#layer-switcher'), this.layers );		
	};
	
	this.tabChanged = function(e) {
		var tab = $(e.currentTarget).attr('id');
		for( attr in this.widgets )
			this.widgets[attr].hide();
		if( this.widgets[tab] )
			this.widgets[tab].show();
	};
	
	/* TODO: refactor */
	this.vis = function(data) {
		var eq = data;	
		if( data instanceof Message ) {
			eq = data.parentEvt;
			markMsgAsDisplayed(data);	
		}
		this.notifyOn('select',eq);
		/* show progress on map until loading of event has finished */
		if( ! eq.isLoaded() ) {
			this.mapProgress.show();
			eq.setCallback('loaded',(function() {
				this.mapProgress.hide();
			}).bind(this));
		}
		visualize(eq);
	};
	
	this.deselect = function() {
		this.notifyOn('select',null);
		/* TODO: for compatibility reasons */
		deselect();
	};

	/* TODO: refactor */
	this.search = function(data) {
		
		if( data instanceof Message )
			data = data.parentEvt;
		
		var tid = data._id;
		if (data.root)
			tid = data.root;

		$('#inSearch').val(tid);
		$('#btnSearch').click();		
		$('#hrefTimeline').click();
	};

	/* TODO: refactor */
	this.copy = function(data) {
		lnkCopyOnClick(data);
	};

	/* TODO: refactor */
	this.info = function(data) {
		/* TODO: fill */
		//this.infoDialog.show(data);
	};

	/* TODO: refactor */
	this.edit = function(data) {
		fillForm(data);
	};

	/* TODO: refactor */
	this.send = function(data) {
		this.mailDialog.show(data);
	};

	/* TODO: refactor */
	this.share = function(data) {
		createStaticLink(data);
	};

	/* TODO: refactor */
	this.remove = function(data) {
		deleteEntry(data);
	};
	
	/* TODO: refactor */
	this.show = function(data) {
		showMsg(data);
	};
	
	/* TODO: refactor */
	this.grid = function(data) {
		if (active == data._id)
			showGrid(active, data.show_grid);
	};
	
	this.main();
}

function Marker(lat, lon, label, color, map) {

	this.init = function(lat, lon, label, color, map) {

		this.map = null;
		this.link = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld='
				+ label + '|' + color.substring(1) + '|000000';

		var icon = new google.maps.MarkerImage(this.link);

		this.marker = new google.maps.Marker({
			icon : icon
		});

		this.setPosition(lat, lon);
		this.setZIndex(1);
		
		if( map )
			this.setMap(map);
	};

	this.setZIndex = function(zindex) {
		this.marker.setZIndex(zindex);
	};

	this.setPosition = function(lat, lon) {
		this.marker.setPosition(new google.maps.LatLng(lat, lon));
	};

	this.setAnimation = function(enable) {

		var anim = enable ? google.maps.Animation.BOUNCE : null;
		this.marker.setAnimation(anim);
	};

	this.setMap = function(map) {
		this.map = map;
	};
	
	this.show = function() {
		this.marker.setMap(this.map);
	};
	
	this.hide = function() {
		this.marker.setMap(null);
	};

	this.init(lat, lon, label, color, map);
}

/* Widget Interface */
Widget.prototype = new ICallbacks();

function Widget() {
	
	ICallbacks.call(this);
	
	this.show = function() {};
	this.hide = function() {};
}

ListWidget.prototype = new Widget();

function ListWidget(div, data, map, callbacks) {

	Widget.call(this);
		
	this.init = function(div, data, map, callbacks) {

		this.div = div;
		this.data = data;
		this.map = map;
		
		this.widgets = [];
		this.half = 10;
		this.filter = [];
		
		/* hide deleted entries */
		this.addFilter( function(entry){ return ! entry.deleted; } );

		this.setCallbacks(callbacks);

		this.data.setCallback('change',this.create.bind(this));

		this.div.scroll(this.onScroll.bind(this));
	};

	this.create = function() {

		this.clear();

		this.page = -1;
		this.atBottom = false;
		this.mid_idx = 0;

		this.nextEntries();
	};

	this.refresh = function() {
		for (var i = 0; i < this.widgets.length; i++)
			this.widgets[i].update();
	};
	
	this.addFilter = function(filter) {
		this.filter.push(filter);
	};
	
	this.applyFilter = function(entry) {
		for( var i = 0; i < this.filter.length; i++ )
			if( ! this.filter[i](entry) )
				return false;
		return true;
	};
		
	this.addEntry = function(elem, idx) {

		var eqwidget;

		if (elem instanceof Message) {
			eqwidget = new MsgWidget(elem);
		} else {

			var prop = elem.prop;
			var color = this.getMarkerColor(prop.magnitude);

			var marker = new Marker(prop.latitude, prop.longitude, idx, color, this.map);
			if(this.visible)
				marker.show();

			eqwidget = new EQWidget(elem, marker);
		}
		
		elem.setCallback('delete', this.create.bind(this));
		
		eqwidget.inheritCallbacks(this.callbacks);

		this.widgets.push(eqwidget);
		return eqwidget;
	};

	this.getMarkerColor = function(mag) {

		var color = 'gray';

		if (mag < 2.0) {
			color = '#FFFFFF';
		} else if (mag < 3.0) {
			color = '#BFCCFF';
		} else if (mag < 4.0) {
			color = '#9999FF';
		} else if (mag < 5.0) {
			color = '#80FFFF';
		} else if (mag < 5.3) {
			color = '#7DF894';
		} else if (mag < 6.0) {
			color = '#FFFF00';
		} else if (mag < 7.0) {
			color = '#FFC800';
		} else if (mag < 7.4) {
			color = '#FF9100';
		} else if (mag < 7.8) {
			color = '#FF0000';
		} else if (mag < 8.5) {
			color = '#C80000';
		} else if (mag < 9.0) {
			color = '#800000';
		} else {
			color = '#400000';
		}

		return color;
	};

	this.onScroll = function() {

		var maxValue = this.div.prop('scrollHeight') - this.div.innerHeight();
		var curValue = this.div.scrollTop();

		if (curValue == maxValue) {

			var elem = this.div.children().last();
			var top = elem.offset().top;

			if (this.nextEntries()) {
				elem = this.div.children().eq(this.half - 1);
				this.div.scrollTop(0);
				this.div.scrollTop(elem.offset().top - top);
			}
		}

		if (curValue == 0) {

			var elem = this.div.children().first();
			var top = elem.offset().top;

			if (this.prevEntries()) {
				elem = this.div.children().eq(this.half);
				this.div.scrollTop(0);
				this.div.scrollTop(elem.offset().top - top);
			}
		}
	};

	this.nextEntries = function() {

		if (this.atBottom)
			return false;

		this.clear();
		this.page++;

		var j = 0;
		for (var i = this.mid_idx; i < this.data.length(); i++) {

			if (j == this.half)
				this.mid_idx = i;

			if (j == 2 * this.half)
				break;

			if (this.applyFilter(this.data.get(i))) {
				var eqwidget = this.addEntry(this.data.get(i), this.page*this.half + j+1);
				this.div.append(eqwidget.div);
				j++;
			}
		}

		this.atBottom = (j < 2 * this.half);
		return true;
	};

	this.prevEntries = function() {

		if (this.page == 0)
			return false;

		this.clear();
		this.page--;

		var j = 2 * this.half - 1;
		for (var i = this.mid_idx - 1; i >= 0; i--) {

			if (j == this.half)
				this.mid_idx = i;

			if (j < 0)
				break;

			if (this.applyFilter(this.data.get(i))) {
				var eqwidget = this.addEntry(this.data.get(i), this.page*this.half + j+1);
				this.div.prepend(eqwidget.div);
				j--;
			}
		}

		this.atBottom = false;
		return true;
	};

	this.clear = function() {
		for (var i = 0; i < this.widgets.length; i++)
			this.widgets[i].hide();
		this.div.empty();
		this.widgets = [];
	};
	
	this.show = function() {
		this.visible = true; 
		for (var i = 0; i < this.widgets.length; i++)
			this.widgets[i].show();
	};
	
	this.hide = function() {
		this.visible = false;
		for (var i = 0; i < this.widgets.length; i++)
			this.widgets[i].hide();
	};

	/* overload of constructor possible */
	if (arguments.length == 4)
		this.init(div, data, map, callbacks);
}

MyListWidget.prototype = new ListWidget();

function MyListWidget(div, data, map, callbacks) {

	ListWidget.call(this);
	
	/* Override */
	this.init = function(div, data, map, callbacks) {
		this.__proto__.init.call(this, div, data, map, callbacks);
	};

	/* Override */
	this.getMarkerColor = function(mag) {
		return '#E4E7EB';
	};

	if (arguments.length == 4)
		this.init(div, data, map, callbacks);
}

EQWidget.prototype = new Widget();

function EQWidget(data, marker) {

	Widget.call( this );
	
	this.init = function(data, marker) {
		this.div = $('.eq-entry').clone();
		this.div.removeClass('eq-entry');
		this.div.show();
		/* store a reference to the earthquake object */
		this.data = data;
		this.data.setCallback('update', this.update.bind(this));
		this.data.setCallback('copy', this.showCopyInfo.bind(this));
		this.data.setCallback('select', this.setSelect.bind(this));
		this.marker = marker;
		
		/* set event listener */
		this.div.mouseover(this.highlight.bind(this, true));
		this.div.mouseout(this.highlight.bind(this, false));

		this.div.find('.region').click(
				this.notifyOn.bind(this, 'clk_entry', this.data));
		this.div.find('.lnkTimeline').click(
				this.notifyOn.bind(this, 'clk_timeline', this.data));
		this.div.find('.lnkCopy').click(
				this.notifyOn.bind(this, 'clk_copy', this.data));
		this.div.find('.lnkLearn').click(
				this.notifyOn.bind(this, 'clk_info', this.data));
		this.div.find('.lnkEdit').click(
				this.notifyOn.bind(this, 'clk_edit', this.data));
		this.div.find('.lnkSend').click(
				this.notifyOn.bind(this, 'clk_send', this.data));
		this.div.find('.lnkStatic').click(
				this.notifyOn.bind(this, 'clk_share', this.data));
		this.div.find('.chk_grid').click(
				this.onGridChange.bind(this));
		this.div.find('.info a').click(
				(function(){this.div.find('.info').hide();}).bind(this));

		/* create layer switcher */
		var layers = {
			'Forecast points/zones': this.onCFZLayer.bind(this),
			'Wave jets': this.onJetLayer.bind(this),
			'Travel times': this.onIsoLayer.bind(this)
		};
		this.chk_boxes = [];
		this.div.find('.layers').empty();
		for( attr in layers ) {
			var cbox = new HtmlCheckBox(attr);
			cbox.setCallback('change', layers[attr]);
			this.div.find('.layers').append(cbox.div);
			this.chk_boxes.push(cbox);
		}
		
		/* set popovers */
		var options = {
			placement : 'bottom',
			title : 'Info',
			html : true,
			container : this.div,
			animation : false
		};

		options.content = $('.popovers .learn').html();
		this.div.find('.lnkLearn').popover(options);

		options.placement = 'top';
		options.title = 'Modify and reprocess';
		this.div.find('.lnkEdit').tooltip(options);
		
		options.title = 'Learn more';
		this.div.find('.lnkLearn').tooltip(options);

		options.title = 'Send message';
		this.div.find('.lnkSend').tooltip(options);

		options.title = 'Share map';
		this.div.find('.lnkStatic').tooltip(options);

		options.title = 'Show timeline';
		this.div.find('.lnkTimeline').tooltip(options);

		options.title = 'Download report';
		this.div.find('.lnkReport').tooltip(options);
		this.div.find('.lnkReport').attr('href', 'webguisrv/generate_report?evtid=' + this.data._id);
		
		options.title = 'Copy to my list';
		this.div.find('.lnkCopy').tooltip(options);
		
		/* the user can delete his own events */
		if (curuser != null && id_equals(curuser._id, this.data.user)) {
				
			this.div.find('.lnkDelete').show();
			this.div.find('.lnkDelete').click(
					this.notifyOn.bind(this, 'clk_delete', this.data));

			options.title = 'Delete entry';
			this.div.find('.lnkDelete').tooltip(options);
		}
		
		this.update();
	};
	
	/* fill the HTML elements */
	/* should be called if the underlying data has changed */
	this.update = function() {
				
		var prop = this.data.prop;
		var date = new Date(prop.date);
		var year = date.getUTCFullYear();
		var month = date.getUTCMonth() + 1;
		var day = date.getUTCDate();
		var hour = date.getUTCHours();
		var minutes = date.getUTCMinutes();

		var datestr = year + '/' + zeroPad(month, 2) + '/' + zeroPad(day, 2);
		var timestr = zeroPad(hour, 2) + ':' + zeroPad(minutes, 2);

		var dip = prop.dip ? prop.dip + '&deg;' : 'n/a';
		var strike = prop.strike ? prop.strike + '&deg;' : 'n/a';
		var rake = prop.rake ? prop.rake + '&deg;' : 'n/a';

		this.div.find('.region').text(prop.region);
		this.div.find('.mag').text(prop.magnitude);
		this.div.find('.datetime').html(
				datestr + ' &#183; ' + timestr + ' UTC' + ' &#183; '
						+ this.data._id);
		this.div.find('.lonlat').html(
				'Lat ' + prop.latitude + '&deg; &#183;  Lon ' + prop.longitude
						+ '&deg; &#183;  Depth ' + prop.depth + ' km');
		this.div.find('.dip').html(
				'Dip ' + dip + ' &#183; Strike ' + strike + ' &#183; Rake '
						+ rake);
		this.div.find('.marker').attr('src', this.marker.link);
		
		/* check if id starts with 'gfz' and thus comes from geofon */
		if( (/^gfz/).test(this.data._id) && this.data.hasCompParams() ) {
			var yearstr = this.data._id.substring(3, 7);
			this.div.find('.beach').attr('src','http://geofon.gfz-potsdam.de/data/alerts/'
				+ yearstr + '/' + data.id + '/bb32.png');
			this.div.find('.geofon').attr('href', 'http://geofon.gfz-potsdam.de/eqinfo/event.php?id='
				+ data.id);
		} else {
			this.div.find('.beach').hide();
		}
				
		if (!this.data.process) {

			var status;

			if (!this.data.hasCompParams()) {
				status = 'Missing parameters';
			} else if (!prop.sea_area) {
				status = simText['inland'];
			} else {
				status = simText['no'];
			}

			this.div.find('.status').html(status);
			this.div.find('.status').show();

		} else if (this.data.process.length == 0) {

			this.div.find('.status').html(simText['prepared']);
			this.div.find('.status').show();

		} else {
			
			this.div.find('.status').hide();
			this.div.find('.progress').show();
			this.div.find('.calc_data').show();
			
			this.chk_boxes[0].value( this.data.show_cfzs );
			this.chk_boxes[1].value( this.data.show_jets );
			this.chk_boxes[2].value( this.data.show_isos );

			/* we still consider only one simulation per EQ */
			var process = this.data.process[0];

			var grid = process.grid_dim;
			var latMin = grid.latMin.toFixed(2);
			var lonMin = grid.lonMin.toFixed(2);
			var latMax = grid.latMax.toFixed(2);
			var lonMax = grid.lonMax.toFixed(2);

			this.div.find('.progress-bar').css('width', process.progress + '%');
			this.div.find('.resource').html(process.resources);
			this.div.find('.calc').html(
					'Runtime ' + process.calcTime / 1000
							+ ' sec &#183; SimDuration ' + process.simTime
							+ ' min');
			this.div.find('.grid').html(
					'Grid ' + process.resolution + '&prime; &#183; BBox ('
							+ latMin + ', ' + lonMin + '), (' + latMax + ', '
							+ lonMax + ')');

			if (process.progress == 100) {
				this.div.find('.progress').hide();
				this.div.find('.status').html(simText['done']);
				this.div.find('.status').show();
			}
		}

		/* TODO: replace checkPerm() with perm.check() */
		if (checkPerm('vsdb'))
			this.div.find('.accel').html(
					'Acceleration ' + this.data.getAccel() + 'x');

		if (!this.data.extern) {

			if (checkPerm('share'))
				this.div.find('.lnkStatic').show();

			if (checkPerm('comp'))
				this.div.find('.lnkEdit').show();

			if (checkPermsAny('intmsg', 'mail', 'fax', 'ftp', 'sms')
					&& !this.data.extern)
				this.div.find('.lnkSend').show();

			if (checkPerm('timeline'))
				this.div.find('.lnkTimeline').show();
			
			if (checkPerm('report'))
				this.div.find('.lnkReport').show();

		} else {

			this.div.find('.lnkCopy').show();
		}
		
		this.setSelect();
	};
	
	this.onGridChange = function(e) {
		this.data.show_grid = $(e.currentTarget).is(':checked');
		this.notifyOn('clk_grid', this.data);
	};
	
	this.onCFZLayer = function(val) {
		this.data.show_cfzs = val;
		this.data.notifyOn('update');
	};
	
	this.onJetLayer = function(val) {
		this.data.show_jets = val;
		this.data.notifyOn('update');
	};
	
	this.onIsoLayer = function(val) {
		this.data.show_isos = val;
		this.data.notifyOn('update');
	};
	
	this.showCopyInfo = function(res) {
		var info = this.div.find('.info');
		info.find('span').html(res);
		info.show(400);
	};
	
	this.setSelect = function() {
		if( this.data.selected ) {
			this.div.css('border-left', '8px solid #C60000');
			this.div.css('background-color', '#c3d3e1');
		} else {
			this.div.css('background-color', '#fafafa');
			this.div.css('border-left', '0px');
		}
	};
	
	this.hide = function() {
		this.marker.hide();
	};
	
	this.show = function() {
		this.marker.show();
	};

	this.highlight = function(turnOn) {
		if( this.data.selected )
			return;
		var color = turnOn ? '#c3d3e1' : '#fafafa';
		this.marker.setAnimation(turnOn);
		this.div.css('background-color', color);
	};

	if (arguments.length == 2)
		this.init(data, marker);
}

MsgWidget.prototype = new Widget();

function MsgWidget(data) {

	Widget.call(this);
	
	this.init = function(data) {
		this.div = $('.msg-entry').clone();
		this.div.removeClass('msg-entry');
		this.div.show();
		/* store a reference to the earthquake object */
		this.data = data;
		this.update();
	};

	this.update = function() {

		var date = new Date(this.data.CreatedTime);
		var year = date.getUTCFullYear();
		var month = date.getUTCMonth() + 1;
		var day = date.getUTCDate();
		var hour = date.getUTCHours();
		var minutes = date.getUTCMinutes();

		var datestr = year + '/' + zeroPad(month, 2) + '/' + zeroPad(day, 2);
		var timestr = zeroPad(hour, 2) + ':' + zeroPad(minutes, 2);

		var dir = this.data.Dir == 'in' ? 'Received' : 'Sent';
		var cls = 'glyphicon msgIcon ';
		var type = '';
		var color = '#5cb85c';
		var info = 'Message sent successfully';

		if (this.data.getErrors()) {
			color = '#d9534f';
			info = 'Errors occured while sending';
		}

		if (this.data.Type == 'MAIL') {
			cls += 'glyphicon-envelope';
			type = 'Mail';
		} else if (this.data.Type == 'FTP') {
			cls += 'glyphicon-link';
			type = 'FTP';
		} else if (this.data.Type == 'FAX') {
			cls += 'glyphicon-phone-alt';
			type = 'Fax';
		} else if (this.data.Type == 'SMS') {
			cls += 'glyphicon-phone';
			type = 'SMS';
		} else if (this.data.Type == 'INTERNAL') {
			if (this.data.Dir == 'in') {
				cls += 'glyphicon-bell';
				if (!this.data.ReadTime || !this.data.MapDisplayTime)
					color = '#FF8000';
			} else {
				cls += 'glyphicon-cloud';
			}
			type = 'Cloud';
		}

		if (this.data.Dir == 'in') {

			if (this.data.ReadTime) {

				var str = getDateString(new Date(this.data.ReadTime));
				this.div.find('.stat-read').html('Message read on ' + str);
				this.div.find('.stat-read').show();
			}

			if (this.data.MapDisplayTime) {

				var str = getDateString(new Date(this.data.MapDisplayTime));
				this.div.find('.stat-disp').html('Map displayed on ' + str);
				this.div.find('.stat-disp').show();
			}

		} else {

			this.div.find('.stat-read').html(info);
			this.div.find('.stat-disp').hide();
		}

		var subject = this.data.Subject ? this.data.Subject : 'No subject';

		this.div.find('.msgIcon').css('color', color);
		this.div.find('.msgIcon').attr('class', cls);
		this.div.find('.msgType').text(type);
		this.div.find('.subject').text(subject);
		this.div.find('.datetime').html(
				dir + ' &#183; ' + datestr + ' &#183; ' + timestr
						+ ' UTC &#183; ');
		this.div.find('.lnkEvtId').html(this.data.ParentId);
		this.div.find('.to').html(this.data.To[0]);

		for (var k = 1; k < this.data.To.length; k++) {
			this.div.find('.to').append(', ' + this.data.To[k]);
		}

		if (this.data.Cc) {
			this.div.find('.cc').html(this.data.Cc[0]);
			for (var k = 1; k < this.data.Cc.length; k++) {
				this.div.find('.cc').append(', ' + this.data.Cc[k]);
			}
		} else {
			this.div.find('.cc-row').hide();
		}

		if (this.data.Dir == 'in')
			this.div.find('.from').html(this.data.From);
		else
			this.div.find('.from').html(curuser.username);

		var options = {
			placement : 'top',
			container : this.div,
			animation : false
		};

		options.title = 'Show message';
		this.div.find('.lnkMsg').tooltip(options);

		options.title = 'Delete message';
		this.div.find('.lnkDelete').tooltip(options);

		options.title = 'Show timeline';
		this.div.find('.lnkTimeline').tooltip(options);

		this.div.mouseover(this.highlight.bind(this, true));
		this.div.mouseout(this.highlight.bind(this, false));
		this.div.find('.subject').click(
				this.notifyOn.bind(this, 'clk_entry', this.data));
		this.div.find('.lnkMsg').click(
				this.notifyOn.bind(this, 'clk_show', this.data));
		this.div.find('.lnkTimeline').click(
				this.notifyOn.bind(this, 'clk_timeline', this.data));
		this.div.find('.lnkDelete').click(
				this.notifyOn.bind(this, 'clk_delete', this.data));

		if (checkPerm('timeline'))
			this.div.find('.lnkTimeline').show();

		this.div.find('.lnkDelete').show();
	};

	this.highlight = function(turnOn) {
		var color = turnOn ? '#c3d3e1' : '#fafafa';
		this.div.css('background-color', color);
	};

	if (arguments.length == 1)
		this.init(data);
}

Message.prototype = new ICallbacks();

function Message(meta) {
	
	ICallbacks.call(this);

	this.init = function( meta ) {
		
		/*
		 * add all attributes of the passed meta object to this object - be careful
		 * to not override existing fields
		 */
		$.extend(this, meta);
				
		this._id = this['Message-ID'] + (this.Dir == 'in' ? '_in' : '');

		/* TODO: remove? */
		this.kind = 'msg';
		this.prop = {date: this.CreatedTime};
	};
	
	/* TODO: extend - return list with error messages */
	this.getErrors = function() {
		if (this.errors && !$.isEmptyObject(this.errors))
			return [];
		return null;
	};
	
	if( arguments.length == 1 )
		this.init(meta);
}

function ICallbacks() {

	this.callbacks = {};

	this.setCallbacks = function(callbacks) {
		for( var action in callbacks )
			this.setCallback(action,callbacks[action]);
	};
	
	this.inheritCallbacks = function(callbacks) {
		this.callbacks = callbacks;
	};

	this.setCallback = function(action, func) {
		/* create new object for this kind of action if not already done */
		if(! (action in this.callbacks) )
			this.callbacks[action] = {cnt: 0};
		/* get next id that identifies this callback - can be used to deregister later */
		var cnt = this.callbacks[action].cnt++;
		this.callbacks[action][cnt] = func;
		return cnt;
	};
	
	this.delCallback = function(action,cid) {
		if( cid )
			delete this.callbacks[action][cid];
	};

	this.notifyOn = function(action) {

		var vargs = [];

		for (var i = 1; i < arguments.length; i++)
			vargs.push(arguments[i]);

		if(! (action in this.callbacks) )
			return;
		
		var cnt = this.callbacks[action].cnt;
		
		for(var i = 0; i < cnt; i++)
			if( this.callbacks[action][i] ) {
				this.callbacks[action][i].apply(this, vargs);
			}
	};
}

function LayerSwitcher(div, layers) {
	
	this.init = function(div, layers) {
		this.div = div;
		this.layers = layers;
		this.content = this.div.find('.content');
		this.icon = this.div.find('.toggle span');
		this.icon.click(this.onClick.bind(this));
		this.expand(false);
		this.update();
	};
	
	this.toggle = function() {
		this.icon.removeClass('glyphicon-chevron-left');
		this.icon.removeClass('glyphicon-chevron-right');
		
		if( this.open ) {
			this.icon.addClass('glyphicon-chevron-right');
			this.content.show();
		} else {
			this.icon.addClass('glyphicon-chevron-left');
			this.content.hide();
		}
	};
	
	this.update = function() {
		this.content.html('<h4>Layers:</h4>');
		for(var i = 0; i < this.layers.length(); i++) {
			var layer = this.layers.get(i);
			var cbox = new HtmlCheckBox(layer.name, true);
			cbox.setCallback('change', layer.show.bind(layer));
			this.content.append(cbox.div);
		}
	};
	
	this.expand = function(open) {
		this.open = open;
		this.toggle();
	};
	
	this.onClick = function() {
		this.expand(! this.open);
	};
	
	this.init(div, layers);
}

var eqlist;
var saved;
var timeline;
var messages;
var shared;

var entries = new EntryMap();

var active = null;
var searchId = null;

var loggedIn = false;

var curuser = null;

var default_delay = 24 * 60;
var delay = default_delay;
var timerId = null;

var share = false;

var defaultText = {
	no : "No simulation",
	inland : "No simulation",
	prepared : "Simulation is being prepared",
	done : "Simulation processed"
};

var userText = {
	no : "No tsunami potential",
	inland : "Inland, no simulation processed",
	prepared : "Simulation is being prepared",
	done : "Simulation processed"
};

var simText = defaultText;

var signTarget = null;

var markers = {
	compose : null,
	active : null
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

google.load("visualization", "1", {
	packages : [ "corechart" ]
});
google.maps.event.addDomListener(window, 'load', init_maps);
google.setOnLoadCallback(init_charts);

function init_maps() {

	loaded++;
	initialize();
}

function init_charts() {

	loaded++;
	initialize();
}

function load_gmaps() {

	/* load map only if not already loaded */
	if (map)
		return;

	var mapOptions = {
		zoom : 2,
		center : new google.maps.LatLng(0, 0),
		mapTypeId : google.maps.MapTypeId.SATELLITE
	};

	map = new google.maps.Map(document.getElementById('mapview'), mapOptions);

	google.maps.event.addListener(map, 'click', clickMap);
	google.maps.event.addListener(map, 'resize', mapResized);

	google.maps.event
			.addListener(map, 'projection_changed', projection_changed);

	/* create default marker used in the "Compose" tab, make it invisible first */
	markers.compose = createDefaultMarker($('#inLat').val(), $('#inLon').val(),
			"#E4E7EB");
	markers.compose.setMap(null);
	markers.active = createDefaultMarker($('#inLat').val(), $('#inLon').val(),
			"#5cb85c");
	markers.active.setMap(null);
}

function initialize() {

	if (loaded < 2)
		return;

	dialogs = {
		chart : new MainChartDialog($('#chartDia'))
	};

	stations = new Container(sort_string.bind(this, 'name'));
	stationView = new StationView($('#stat-dias'), stations, $('#stat-chk').is(
			':checked'));
	canvas = new Canvas($('#canvas-line'), null);
	stationSymbols = new StationSymbols(stations, $('#stat-chk').is(':checked'));
	stationSymbols.enableLines($('#stat-dias').css("display") != "None");

	vsdbPlayer = new VsdbPlayer($('#vsdbPlayer'));

	admin = new AdminDialog();
	$("#btnAdmin").click(admin.show.bind(admin));
		
	$("#btnSignIn").click(drpSignIn);
	$("#btnSignOut").click(signOut);
	$("#btnProp").click(showProp);
	$("#btnStart").click(compute);
	$("#btnClear").click(clearForm);

	$(".main-tabs > li").click(tabChanged);

	$("#diaSignIn").click(diaSignIn);
	$("#splashSignIn").click(diaSignIn);
	$("#propBtnSubmit").click(propSubmit);
	$("#propBtnApiKey").click( function() {
		$("#propBtnSubmit").prop('disabled', true);
		ajax_mt('webguisrv/generate_apikey', {}, function(result) {
			$('#propApiKey').val( result.key );
			$("#propBtnSubmit").prop('disabled', false);
		});
	});

	$("#custom").find("input").blur(checkInput);

	// set tooltip for deselect button
	options = {
		placement : 'top',
		title : 'Deselect and show map only',
		container : 'body',
		animation : false
	};

	$('#btnDeselect').tooltip(options);

	$('#preset > .list-group-item').click(loadPreset);
	
	$('#btnSearch').click(searchEvents);
	$('#inSearch').keyup(function(e) {
		if (e.keyCode == 13)
			searchEvents();
	});

	$('#btnDelRoot').click(function() {
		$('#inRootId').html("");
		$('#inParentId').html("");
	});
	$('#btnDelParent').click(function() {
		$('#inRootId').html("");
		$('#inParentId').html("");
	});
	$('#btnDelDate').click(function() {
		$('#inDate').html("");
	});

	$('.lnkGroup').click(groupOnClick);

	$('#smsText').bind('input propertychange', function() {
		$('#smsChars').html($(this).val().length);
	});

	$('#SignInDialog').on('shown.bs.modal', function() {

		if ($.cookie('username')) {
			$('#diaPass').focus();
		} else {
			$('#diaUser').focus();
		}
	});

	$('#diaUser').val($.cookie('username'));

	$('#stat-toggle-lnk').click(toggleStationView);
	$('#stat-chk').change(toggleStations);

	/* accept enter key on splash screen to log in */
	$('#splashPass, #splashUser').keypress(function(e) {
		if (e.which == 13)
			$('#splashSignIn').click();
	});

	$(window).resize(onResize);

	checkSession();
}

function getEvents(callback) {

	if (timerId != null) {
		clearTimeout(timerId);
		timerId = null;
	}

	$.ajax({
		url : "srv/fetch",
		type : 'POST',
		data : {
			limit : 200,
			delay : delay
		},
		dataType : 'json',

		success : function(data) {

			var timestamp = data['ts'];
			var mlist = data['main'];
			var ulist = data['user'];
			var msglist = data['msg'];

			for (var i = mlist.length - 1; i >= 0; i--) {

				var entry = entries.getOrInsert(new Earthquake(mlist[i]));
				eqlist.insert(entry);
			}

			for (var i = ulist.length - 1; i >= 0; i--) {
				var entry = entries.getOrInsert(new Earthquake(ulist[i]));
				saved.insert(entry);
			}

			for (var i = msglist.length - 1; i >= 0; i--) {
				
				var entry = entries.getOrInsert(new Message(msglist[i]));
				messages.insert(entry);

				if (entry.parentEvt)
					entry.parentEvt = entries.getOrInsert(new Earthquake(entry.parentEvt));
			}

			eqlist.notifyOn('change');

			if (ulist.length > 0) {
				saved.notifyOn('change');
			}

			if (msglist.length > 0)
				messages.notifyOn('change');

			getUpdates(timestamp);

			if (callback != null)
				callback();
		}
	});
}

function getUpdates(timestamp) {

	$.ajax({
		url : "srv/update",
		type : 'POST',
		data : {
			ts : timestamp,
			delay : delay
		},
		dataType : 'json',
		success : function(result) {

			timestamp = result['ts'];
			var mlist = result['main'];
			var ulist = result['user'];

			serverTime = new Date(result['serverTime']);

			var madd = false;
			var uadd = false;
			var sadd = false;
			var msgadd = false;
			var show = false;

			for (var i = mlist.length - 1; i >= 0; i--) {

				var obj = mlist[i];
				var id = obj['_id'];

				if (obj['event'] == 'new') {

					var entry = entries.getOrInsert(new Earthquake(obj));
					eqlist.insert(entry);
					madd = true;

					if (searched(entry)) {
						timeline.insert(entry);
						sadd = true;
					}

				} else if (obj['event'] == 'progress') {

					if (id == active)
						show = true;

					entries.get(id).process = obj.process;
					entries.get(id).notifyOn('update');

				} else if (obj['event'] == 'update') {

					var entry = entries.add(new Earthquake(obj));
					var parent = eqlist.getByKey('id',entry.id).item;
					console.log('update',parent);

					// replace parent
					eqlist.replace('id',entry);

					madd = true;

					if (parent && parent.selected) {
						entry.selected = true;
						entry.notifyOn('select');
					}

					if (searched(entry)) {
						timeline.insert(entry);
						sadd = true;
					}
				}
			}

			for (var i = ulist.length - 1; i >= 0; i--) {

				var obj = ulist[i];
				var id = obj['_id'];

				if (obj['event'] == 'new') {

					var entry = entries.getOrInsert(new Earthquake(obj));
					saved.insert(entry);
					uadd = true;

					if (searched(entry)) {
						timeline.insert(entry);
						sadd = true;
					}
					
					/* a new custom earthquake event can only arrive after
					 * a manual recomputation - thus select it here */
					/* TODO: remove dependency to global instance */
					global.vis(entry);
					
				} else if (obj['event'] == 'progress') {

					/*
					 * don't show polygons again if we already display
					 * the event with 100% progress
					 */
					if (id == active)
						show = true;

					entries.get(id).process = obj.process;
					entries.get(id).notifyOn('update');
					entries.get(id).notifyOn('progress');

				} else if (obj['event'] == 'msg_sent'
						|| obj['event'] == 'msg_recv') {

					var entry = entries.getOrInsert(new Message(obj));
					messages.insert(entry);
					msgadd = true;

					if (entry.parentEvt)
						entry.parentEvt = entries.getOrInsert(new Earthquake(entry.parentEvt));
				}
			}

			if (madd) {
				eqlist.notifyOn('change');
			}

			if (uadd) {
				saved.notifyOn('change');
			}

			if (sadd) {
				timeline.notifyOn('change');
			}

			if (msgadd) {
				messages.notifyOn('change');
			}

			if (show) {

				var filled = entries.get(active)['process'][0]['progress'];
				if (filled == 100) {
					entries.get(active).load();
				}
			}

			timerId = setTimeout(function() {
				getUpdates(timestamp);
			}, 1000);

		},
		error : function() {
		},
		complete : function() {
		}
	});
}

function showMarker(widget) {

	widget.children().each(function() {

		if ($(this).data("marker"))
			$(this).data("marker").setMap(map);
	});

}

function zeroPad(num, count) {

	return charPad(num, count, "0");
}

function charPad(num, count, char) {

	var str = "";

	for (var i = 0; i < count; i++)
		str += char;

	str += num;
	return str.slice(str.length - count);
}

function id_equals(id1, id2) {

	var fields = [ "_time", "_machine", "_inc", "_new" ];

	for (i in fields)
		if (id1[fields[i]] != id2[fields[i]])
			return false;

	// return ( id1.toSource() == id2.toSource() );
	return true;
}

function getMarkerColor(mag) {

	var color = 'gray';

	if (mag < 2.0) {
		color = '#FFFFFF';
	} else if (mag < 3.0) {
		color = '#BFCCFF';
	} else if (mag < 4.0) {
		color = '#9999FF';
	} else if (mag < 5.0) {
		color = '#80FFFF';
	} else if (mag < 5.3) {
		color = '#7DF894';
	} else if (mag < 6.0) {
		color = '#FFFF00';
	} else if (mag < 7.0) {
		color = '#FFC800';
	} else if (mag < 7.4) {
		color = '#FF9100';
	} else if (mag < 7.8) {
		color = '#FF0000';
	} else if (mag < 8.5) {
		color = '#C80000';
	} else if (mag < 9.0) {
		color = '#800000';
	} else {
		color = '#400000';
	}

	return color;
}

function visualize(entry) {

	setMarkerPos(markers.active, entry.prop.latitude, entry.prop.longitude);
	markers.active.setMap(map);

	if (active != entry._id) {

		deselect(active);
		select(entry);

		showGrid(active, entry['show_grid']);
	}

	map.panTo(markers.active.getPosition());
}

function addMarker(lat, lon, icon) {

	// create new marker on selected position
	return new google.maps.Marker({
		position : new google.maps.LatLng(lat, lon),
		map : map,
		icon : icon,
		zIndex : 1
	});
}

function getMarkerIconLink(text, color) {

	var link = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld='
			+ text + '|' + color.substring(1) + '|000000';

	return link;
}

function getPoiColor(poi) {

	var color;

	if (poi.eta == -1) {
		color = "#ADADAD";
	} else if (poi.ewh < 0.2) {
		color = "#00CCFF";
	} else if (poi.ewh < 0.5) {
		color = "#FFFF00";
	} else if (poi.ewh < 3) {
		color = "#FF6600";
	} else {
		color = "#FF0000";
	}

	return color;
}

function getPoiLevel(poi) {

	var level = "WATCH";

	if (poi.eta == -1) {
		level = "";
	} else if (poi.ewh < 0.2) {
		level = "INFORMATION";
	} else if (poi.ewh < 0.5) {
		level = "ADVISORY";
	} else {
		level = "WATCH";
	}

	return level;
}

function showGrid(pointer, visible) {

	if (pointer == null)
		return;

	var entry = entries.get(pointer);

	if (!visible) {
		if (entry['rectangle'] != null) {
			entry['rectangle'].setMap(null);
			entry['rectangle'] = null;
		}
		return;
	}

	if (!entry['process'] || entry['process'].length == 0)
		return;

	if (entry['rectangle'])
		return;

	var grid = entry['process'][0]['grid_dim'];

	var latMin = Math.max(grid['latMin'], -85.05115);
	var latMax = Math.min(grid['latMax'], 85.05115);
	var lonMin = grid['lonMin'];
	var lonMax = grid['lonMax'];

	entry['rectangle'] = new google.maps.Rectangle({
		strokeColor : '#00FF00',
		strokeOpacity : 0.8,
		strokeWeight : 2,
		fillColor : '#FF0000',
		fillOpacity : 0.0,
		// editable: true,
		// draggable: true,
		bounds : new google.maps.LatLngBounds(new google.maps.LatLng(latMin,
				lonMin), new google.maps.LatLng(latMax, lonMax))
	});

	entry['rectangle'].setMap(map);
}

function select(entry) {
	active = entry._id;	
	entry.selected = true;
	entry.notifyOn('select');
}

function deselect() {

	if (active == null)
		return;

	showGrid(active, false);

	if (markers.active)
		markers.active.setMap(null);

	var entry = entries.get(active);

	if (entry) {
		entry.selected = false;
		entry.notifyOn('select');
	}

	stationView.setData(stations);
	stationSymbols.setData(stations);

	active = null;
}

function checkSession() {

	var status;

	$.ajax({
		type : 'POST',
		url : "srv/session",
		dataType : 'json',
		success : function(result) {
			status = result.status;

			if (status == 'success') {
				curuser = result.user;
				logIn(null);
			} else {
				showSplash(true);
				new Splash();
				checkStaticLink();
			}
		},
		error : function() {
		},
		complete : function() {
		}
	});
}

function signIn(user, password) {

	var resObj = null;

	$.ajax({
		type : 'POST',
		url : "srv/signin",
		data : {
			username : user,
			password : password
		},
		dataType : 'json',
		success : function(result) {

			resObj = result;

			console.log(resObj.status);
		},
		error : function() {
		},
		complete : function() {

			if (resObj.status == "success") {

				/* reset all password and status fields of sign-in widgets */
				$("#SignInDialog").modal("hide");
				$('#diaStatus').html("");
				$('#splashStatus').html("");

				curuser = resObj.user;
				logIn(signTarget);

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

function drpSignIn(e) {

	if (!loggedIn) {

		e.stopPropagation();
		signTarget = null;
		$("#SignInDialog").modal("show");
		return;
	}

}

function diaSignIn() {

	var parentId = $(this).attr('id');

	var user = "";
	var password = "";

	if (parentId == "diaSignIn") {

		user = $('#diaUser').val();
		password = $('#diaPass').val();

	} else if (parentId == "splashSignIn") {

		user = $('#splashUser').val();
		password = $('#splashPass').val();
	}

	$.cookie('username', user);

	signIn(user, password);
}

function logIn(callback) {

	load_gmaps();
	global = new GlobalControl();

	// show disclaimer - redirect to xkcd if not accepted
	if (!$.cookie('disclaimer')) {
		$('.disClose').click(function() {
			window.location.href = "http://dynamic.xkcd.com/random/comic/";
		});
		$('#disAccept').click(function() {
			$.cookie('disclaimer', 'true');
		});
		$('#DisclaimDia').modal({
			show : true,
			backdrop : 'static'
		});
	}

	loggedIn = true;

	console.log(curuser);

	getStationList(addGlobalStations);

	showSplash(false);

	simText = userText;

	deselect();

	delay = 0;
	eqlist.clear();
	saved.clear();
	entries.reset();
	getEvents(callback);

	$("#btnSignIn").css("display", "none");
	$("#grpSignOut").css("display", "block");

	$('.tab-private').css("display", "block");

	if (!checkPerm("comp")) {
		$('#tabCustom').css("display", "none");
		$('#tabSaved').css("display", "none");
	}

	if (!checkPermsAny("intmsg", "mail", "fax", "ftp", "sms")) {
		$('#tabMessages').css("display", "none");
	}

	if (!checkPerm("timeline")) {
		$('#tabTimeline').css("display", "none");
	}

	/* check chart permission */
	if (checkPerm("chart")) {
		/* show charts */
		showStationView(true);
		$('#statview').show();
		/* show station properties */
		$('#propTabStations').show();
	} else {
		/* hide charts */
		showStationView(false);
		$('#statview').hide();
		/* hide station properties */
		$('#propTabStations').hide();
	}

	if (checkPerm("vsdb")) {
		$('#vsdbPlayer').show();
		vsdbPlayer.setBase(curuser.inst.vsdblink);
	} else {
		$('#vsdbPlayer').css("display", "none");
	}
	
	if (checkPerm("admin")) {
		$('#btnAdmin').show();
	} else {
		$('#btnAdmin').hide();
	}

	onResize();

	shared.clear();
	checkStaticLink();

	$('#lnkUser').html(curuser.username);
	if (curuser.inst)
		$('#lnkUser').append(" &nbsp;&#183;&nbsp; " + curuser.inst.descr);
	$('#lnkUser').css("display", "block");
}

function signOut() {

	var status = null;

	$.ajax({
		type : 'POST',
		url : "srv/signout",
		data : {
			username : curuser.username
		},
		dataType : 'json',
		success : function(result) {

			status = result['status'];
		},
		error : function() {
		},
		complete : function() {

			if (status == "success") {
				logOut();
			}
		}
	});
}

function logOut() {

	loggedIn = false;

	// showSplash( true );

	simText = defaultText;

	$("#btnSignIn").css("display", "block");
	$("#grpSignOut").css("display", "none");

	$('.tab-private').css("display", "none");
	onResize();

	$('#tabRecent').find('a').trigger('click');

	deselect();
	delay = default_delay;
	eqlist.clear();
	saved.clear();
	timeline.clear();
	messages.clear();
	entries.reset();
	getEvents(null);

	shared.clear();
	checkStaticLink();

	$('#lnkUser').html("");
	$('#lnkUser').css("display", "none");

	/*
	 * to avoid caching problems, simply reload the page and start from session
	 * again
	 */
	window.location.reload();
}

function compute() {

	var params = getParams();

	$("#tabSaved").css("display", "block");
	$("#hrefSaved").click();

	ajax('srv/compute', params, null );
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
	params['root'] = $('#inRootId').html();
	params['parent'] = $('#inParentId').html();

	if ($('#inDate').html() != "")
		params['date'] = $('#inDate').data("dateObj").toISOString();

	return params;
}

function fillForm(entry) {

	if (!loggedIn) {

		signTarget = fillForm.bind(this, entry);
		$("#SignInDialog").modal("show");
		return;
	}

	var prop = entry['prop'];

	$('#inName').val(prop['region']);
	$('#inLon').val(prop['longitude']);
	$('#inLat').val(prop['latitude']);
	$('#inMag').val(prop['magnitude']);
	$('#inDepth').val(prop['depth']);
	$('#inDip').val(prop['dip']);
	$('#inStrike').val(prop['strike']);
	$('#inRake').val(prop['rake']);
	$('#inDuration').val(180);

	/* do not set parent and root ID if this is a preset event */
	if (entry['_id']) {
		$('#inParentId').html(entry['_id']);

		if (entry['root']) {
			$('#inRootId').html(entry['root']);
		} else {
			$('#inRootId').html(entry['_id']);
		}
	} else {
		$('#inParentId').html("");
		$('#inRootId').html("");
	}

	if (prop['date']) {
		var date = new Date(prop['date']);
		$('#inDate').html(getDateString(date) + " UTC");
		$('#inDate').data("dateObj", date);
	} else {
		$('#inDate').html("");
	}

	checkInput();

	$('#tabCustom').css("display", "block");
	$('#tabCustom').find('a').trigger('click');
}

function clearForm() {
	$('#custom :input').val('');
	$('#inRootId').html('');
	$('#inParentId').html('');
	$('#inDate').html('');
	checkInput();
}

function fillCustomForm(e) {

	var entry = $(this).parents('.entry').data('entry');
	fillForm(entry);
}

String.prototype.splice = function(idx, str) {
	return this.slice(0, idx) + str + this.slice(idx);
};

function splitSMS(smstext) {

	var result = smstext;

	/* split sms text to fit multiple messages */
	var maxlen = 160;
	var partEnd = "(CONTINUES)";
	var partBegin = "(CONTINUED)";
	var end = "END OF MSG;";
	while (result.length > maxlen) {

		result = result.splice(maxlen - partEnd.length, partEnd + partBegin);

		if (maxlen == 160)
			result = result.splice(result.length - "*TEST*".length, end);

		maxlen += 160;
	}

	return result;
}

function markMsgAsRead(msg) {

	$.ajax({
		type : 'POST',
		url : "msgsrv/readmsg",
		data : {
			apiver : 1,
			msgid : msg['Message-ID']
		},
		dataType : 'json',
		success : function(result) {
			status = result.status;

			if (!msg.ReadTime) {
				/*
				 * result.readtime contains a utc date, but Date() expects a
				 * local date - that's why we need to transform the utc date
				 * back to local time first
				 */
				var utc = new Date(result.readtime);
				msg.ReadTime = new Date(utc.getTime() - utc.getTimezoneOffset()
						* 60000);
			}

			/* TODO: handle this with update */
			messages.notifyOn('change');
			timeline.notifyOn('change');
		},
		error : function() {
			console.log("#error");
		},
		complete : function() {
		}
	});

}

function markMsgAsDisplayed(msg) {

	$.ajax({
		type : 'POST',
		url : "msgsrv/displaymapmsg",
		data : {
			apiver : 1,
			msgid : msg['Message-ID']
		},
		dataType : 'json',
		success : function(result) {
			status = result.status;

			if (!msg.MapDisplayTime) {
				/*
				 * result.readtime contains a utc date, but Date() expects a
				 * local date - that's why we need to transform the utc date
				 * back to local time first
				 */
				var utc = new Date(result.mapdisplaytime);
				msg.MapDisplayTime = new Date(utc.getTime()
						- utc.getTimezoneOffset() * 60000);
			}

			/* TODO: handle this with update */
			messages.notifyOn('change');
			timeline.notifyOn('change');
		},
		error : function() {
			console.log("#error");
		},
		complete : function() {
		}
	});

}

function clickMap(event) {

	if ($('#custom').css("display") == "block") {

		$('#inLon').val(event.latLng.lng().toFixed(2));
		$('#inLat').val(event.latLng.lat().toFixed(2));

		// checkAll();

		setMarkerPos(markers.compose, $('#inLat').val(), $('#inLon').val());
	}
}

function createDefaultMarker(lat, lon, color) {

	var link = getMarkerIconLink("%E2%80%A2", color);
	marker = addMarker(lat, lon, new google.maps.MarkerImage(link));
	marker.setZIndex(100);

	return marker;
}

function setMarkerPos(marker, lat, lon) {

	marker.setPosition({
		lat : Number(lat),
		lng : Number(lon)
	});
}

function tabChanged(e) {
	var tab = $(e.currentTarget).attr('id');
	if (tab == "tabCustom") {
		markers.compose.setMap(map);
	} else {
		markers.compose.setMap(null);
	}
}

function enableGrid(args) {

	var entry = args.data.entry;

	entry['show_grid'] = $(this).is(':checked');

	if (active == entry['_id'])
		showGrid(active, entry['show_grid']);
}

function checkInput() {

	var validLon = checkRange('#inLon', -180, 180);
	var validLat = checkRange('#inLat', -90, 90);

	var stat = validLon;
	stat = validLat && stat;
	stat = checkRange('#inMag', 0, 10.6) && stat;
	stat = checkRange('#inDepth', 0, 1000) && stat;
	stat = checkRange('#inDip', 0, 90) && stat;
	stat = checkRange('#inStrike', 0, 360) && stat;
	stat = checkRange('#inRake', -180, 180) && stat;
	stat = checkRange('#inDuration', 0, 600) && stat;

	$('#btnStart').prop('disabled', !stat);

	if (validLon && validLat) {
		setMarkerPos(markers.compose, $('#inLat').val(), $('#inLon').val());
	} else {
		markers.compose.setMap(null);
	}

	return stat;
}

function checkRange(id, start, end) {

	var val = $(id).val().replace(",", ".");

	$(id).val(val);
	$(id).css("color", "");

	if (val == '') {
		return false;
	}

	if (checkFloat(val) == false) {
		$(id).css("color", "red");
		return false;
	}

	if (val < start || val > end) {
		$(id).css("color", "red");
		return false;
	}

	return true;
}

function checkFloat(val) {

	if (isNaN(parseFloat(+val)) || !isFinite(val))
		return false;

	return true;
}

function loadPreset() {

	var data = {};
	var id = $(this).attr('id');

	data.preset1 = {
		latitude : 38.321,
		longitude : 142.369,
		magnitude : 9.0,
		depth : 24,
		strike : 193,
		dip : 14,
		rake : 81
	};
	data.preset2 = {
		latitude : 2.3,
		longitude : 92.9,
		magnitude : 8.57,
		depth : 25,
		strike : 199,
		dip : 80,
		rake : 3
	};
	data.preset3 = {
		latitude : 7.965,
		longitude : 156.40,
		magnitude : 8.1,
		depth : 23,
		strike : 331,
		dip : 38,
		rake : 120
	};
	data.preset4 = {
		latitude : 35,
		longitude : 29,
		magnitude : 8.5,
		depth : 24.1,
		strike : 260,
		dip : 42,
		rake : 95
	};
	data.preset5 = {
		latitude : 35.5,
		longitude : 31.9,
		magnitude : 7.3,
		depth : 15.1,
		strike : 310,
		dip : 69,
		rake : 111
	};
	data.preset6 = {
		latitude : 38.9,
		longitude : 26.4,
		magnitude : 6.5,
		depth : 11.4,
		strike : 140,
		dip : 56,
		rake : -120
	};
	data.preset7 = {
		latitude : 34.5,
		longitude : 27.1,
		magnitude : 8,
		depth : 21.3,
		strike : 66,
		dip : 33,
		rake : 90
	};
	data.preset8 = {
		latitude : 36.574,
		longitude : -9.890,
		magnitude : 8.1,
		depth : 4,
		strike : 20,
		dip : 35,
		rake : 90
	};
	data.preset9 = {
		latitude : 36.665,
		longitude : -11.332,
		magnitude : 8.1,
		depth : 5,
		strike : 53,
		dip : 35,
		rake : 90
	};
	data.preset10 = {
		latitude : 35.796,
		longitude : -9.913,
		magnitude : 8.3,
		depth : 4,
		strike : 42,
		dip : 35,
		rake : 90
	};
	data.preset11 = {
		latitude : 36.314,
		longitude : -8.585,
		magnitude : 8,
		depth : 2.5,
		strike : 266,
		dip : 24,
		rake : 90
	};
	data.preset12 = {
		latitude : 35.407,
		longitude : -8.059,
		magnitude : 8.6,
		depth : 20,
		strike : 349,
		dip : 5,
		rake : 90
	};
	data.preset13 = {
		latitude : -3.55,
		longitude : 100.05,
		magnitude : 7.7,
		depth : 15,
		strike : 325,
		dip : 12,
		rake : 90
	};
	data.preset14 = {
		latitude : -3.2,
		longitude : 99.70,
		magnitude : 7.5,
		depth : 15,
		strike : 325,
		dip : 12,
		rake : 90
	};
	data.preset15 = {
		latitude : 35.2,
		longitude : 23.4,
		magnitude : 8.3,
		depth : 0,
		strike : 315,
		dip : 30,
		rake : 90
	};

	var prop = data[id];
	prop.region = $(this).html();

	var entry = {
		prop : prop
	};
	fillForm(entry);

	$('#custom').scrollTop(0);
}

function searchEvents() {

	searchId = $('#inSearch').val();
	timeline.clear();

	$.ajax({
		type : 'POST',
		url : "srv/search",
		data : {
			text : searchId
		},
		dataType : 'json',
		success : function(result) {

			for (var i = result.length - 1; i >= 0; i--) {

				var obj;

				if (result[i].kind == "msg") {
					obj = new Message(result[i]);
				} else {
					obj = new Earthquake(result[i]);
				}

				var entry = entries.getOrInsert( obj );
				timeline.insert(entry);
			}

			timeline.notifyOn('change');
		},
		error : function() {
		},
		complete : function() {
		}
	});

}

function searched(obj) {

	if (searchId == null)
		return false;

	if (obj.id == searchId || obj.root == searchId || obj.parent == searchId)
		return true;

	return false;
}

function lnkIdOnClick(args) {
	$('#inSearch').val(args.data.id);
	$('#btnSearch').click();
	$("#hrefTimeline").click();
}

function lnkCopyOnClick(data) {
	
	if (!loggedIn) {

		signTarget = lnkCopyOnClick.bind(this, data);
		$("#SignInDialog").modal("show");
		return;
	}
	
	ajax('srv/copyToUser', {srcId : data._id}, function(result) {
		if (result.status == "success")
			data.notifyOn('copy',result.msg);
	});
}

function showProp(e, activeTab) {

	var prop = curuser.properties;
	var perm = curuser.permissions;
	var notify = curuser.notify;
	var api = curuser.api;

	/* clear all input fields to avoid displaying old data from another user! */
	$('#PropDia :input').val("");

	$('#propUser').html(curuser.username);

	if( checkPerm('api') ) {
		if( api ) {
			$('#propApiKey').val( api.key );
			$('#propApiEnabled').prop('checked',api.enabled);
		}
		$('#propApi').show();
	} else {
		$('#propApi').hide();
	}
	
	if (perm && (perm.fax || perm.ftp || perm.sms)) {

		/* hide all groups first */
		$('#PropDia .group').css("display", "none");

		if (perm.fax && perm.fax == true)
			$('#propGrpFax').css("display", "block");

		if (perm.ftp && perm.ftp == true)
			$('#propGrpFtp').css("display", "block");

		if (perm.sms && perm.sms == true)
			$('#propGrpSms').css("display", "block");

		if (prop) {
			$('#propFaxUser').val(prop.InterfaxUsername);
			$('#propFaxPwd').val(prop.InterfaxPassword);
			$('#propFTPUser').val(prop.FtpUser);
			$('#propFTPPwd').val(prop.FtpPassword);
			$('#propFTPHost').val(prop.FtpHost);
			$('#propFTPPath').val(prop.FtpPath);
			$('#propFTPFile').val(prop.FtpFile);
			$('#propSmsSID').val(prop.TwilioSID);
			$('#propSmsToken').val(prop.TwilioToken);
			$('#propSmsFrom').val(prop.TwilioFrom);
		}

		$('#propTabMsgs').css("display", "block");

	} else {

		$('#propTabMsgs').css("display", "none");
	}

	if (checkPerm("manage")) {

		var inst = curuser.inst;

		if (inst) {
			$('#propInstName').val(inst.descr);
			$('#propInstMsgName').val(inst.msg_name);
		}

		$('#propTabInst').css("display", "block");

	} else {
		$('#propTabInst').css("display", "none");
	}

	if (checkPerm("notify")) {

		if (notify) {
			$('#propNotifySms').val(notify.sms);
			$('#propNotifyMail').val(notify.mail);
			$('#propNotifyMag').val(notify.onMag);
			$('#propNotifyChangeVal').val(
					notify.onMagChange ? notify.onMagChange : "");
			$('#propNotifyChangeChk').prop('checked', notify.onMagChange);
			$('#propNotifySim').prop('checked', notify.onSim);
			$('#propNotifyMT').prop('checked', notify.onMT);
			$('#propNotifyPreMsg').prop('checked', notify.includeMsg);
			$('#propNotifyOffshore').prop('checked', notify.offshore);
		}

		$('#propTabNotify').show();

	} else {

		$('#propNotifySms').val("");
		$('#propNotifyMail').val("");
		$('#propNotifyMag').val("");
		
		$('#propTabNotify').hide();
	}

	/* stations */
	if (curuser.countries) {
		var widget = $('#propStations .countries');
		widget.empty();
		for (var i = 0; i < curuser.countries.length; i++) {
			var span = $('<span class="country-code"><input type="checkbox">'
					+ curuser.countries[i]._id + ' ('
					+ curuser.countries[i].count + ')</span>');
			var checkbox = span.find('input');
			checkbox.prop('checked', curuser.countries[i].on);
			checkbox.change(onCountrySelect);
			widget.append(span);
		}
		onCountrySelect();
	}

	if (activeTab)
		$(activeTab + ' a').click();
		
	$('#PropDia').modal('show');
}

function onCountrySelect() {

	var chkBoxes = $('#propStations .countries').find('input');
	var sum = 0;

	for (var i = 0; i < chkBoxes.length; i++) {
		if (chkBoxes.eq(i).is(':checked'))
			sum += curuser.countries[i].count;
	}

	$('#propStations .count').html("Selected stations in total: " + sum);

	if (sum > 100) {
		$('#propStations .warn')
				.html(
						"Using more than 100 stations may lead to a noticeable slowdown of the entire page!");
	} else {
		$('#propStations .warn').html("");
	}
}

function groupOnClick() {

	var content = $(this).parents('.group').children('.grpContent');
	var arrow = $(this).children('.grpArrow');

	content.css("display", arrow.hasClass('glyphicon-chevron-up') ? "none"
			: "inline");

	arrow.toggleClass('glyphicon-chevron-up');
	arrow.toggleClass('glyphicon-chevron-down');
}

/* this functions takes a variable number of arguments */
function checkPermsAny() {

	var result = false;

	for (var i = 0; i < arguments.length; i++) {
		result = result || checkPerm(arguments[i]);
	}

	return result;
}

function checkPerm(type) {

	if (!curuser)
		return false;

	var perm = curuser.permissions;

	if (!perm)
		return false;

	if (type == "vsdb")
		return (curuser.inst && curuser.inst.vsdblink);

	return perm[type];
}

/* checks whether the property is set and not empty */
function checkProp(field) {
	if (!curuser)
		return false;
	var prop = curuser.properties;
	return prop && prop[field] && prop[field] != "";
}

function propSubmit() {

	var curpwd = $('#propCurPwd').val();
	var newpwd = $('#propNewPwd').val();
	var confpwd = $('#propConfPwd').val();

	var prop = {
		"InterfaxUsername" : $('#propFaxUser').val(),
		"InterfaxPassword" : $('#propFaxPwd').val(),
		"FtpUser" : $('#propFTPUser').val(),
		"FtpPassword" : $('#propFTPPwd').val(),
		"FtpHost" : $('#propFTPHost').val(),
		"FtpPath" : $('#propFTPPath').val(),
		"FtpFile" : $('#propFTPFile').val(),
		"TwilioSID" : $('#propSmsSID').val(),
		"TwilioToken" : $('#propSmsToken').val(),
		"TwilioFrom" : $('#propSmsFrom').val()
	};

	var inst = {
		"descr" : $('#propInstName').val(),
		"msg_name" : $('#propInstMsgName').val(),
	};

	var notify = {
		"sms" : $('#propNotifySms').val(),
		"mail" : $('#propNotifyMail').val(),
		"onMag" : parseFloat($('#propNotifyMag').val()),
		"onMagChange" : $('#propNotifyChangeChk').is(':checked') ? parseFloat($(
				'#propNotifyChangeVal').val())
				: null,
		"onSim" : $('#propNotifySim').is(':checked'),
		"onMT" : $('#propNotifyMT').is(':checked'),
		"includeMsg": $('#propNotifyPreMsg').is(':checked'),
		"offshore": $('#propNotifyOffshore').is(':checked')
	};
	
	var api = {
		"key": $('#propApiKey').val(),
		"enabled": $('#propApiEnabled').is(':checked')
	};

	$('#propStatus').html("");

	if (newpwd != confpwd) {
		$('#propStatus').html("Error: The given passwords differ.");
		return;
	}

	var data = {
		props : JSON.stringify(prop),
		inst : JSON.stringify(inst),
		notify : JSON.stringify(notify),
		api: JSON.stringify(api)
	};

	/* stations */
	var statChanged = false;
	if (curuser.countries) {
		var widget = $('#propStations .countries');
		var clist = [];

		for (var i = 0; i < curuser.countries.length; i++) {
			var checked = widget.find('input').eq(i).is(':checked');
			if (checked != curuser.countries[i].on)
				statChanged = true;
			if (checked == true)
				clist.push(curuser.countries[i]._id);
		}

		if (statChanged)
			data.stations = JSON.stringify(clist);
	}

	if (newpwd != "" || curpwd != "") {
		data.curpwd = curpwd;
		data.newpwd = newpwd;
	}

	$('#propBtnSubmit')
			.html(
					'<i class="fa fa-spinner fa-spin fa-lg"></i><span class="pad-left">Save</span>');
	
	ajax_mt('webguisrv/saveusersettings', data, function(result) {
		if (result.status == "success") {
			curuser = result.user;
			/* TODO: generalize and support eq related stations too */
			if (statChanged)
				getStationList(addGlobalStations);
			$('#PropDia').modal("hide");
		} else {
			$('#propStatus').html("Error: " + result.error);
		}
	});
	
	$('#propBtnSubmit').html('<span>Save</span>');
}

function deleteEntry(entry) {

	var id = entry._id;
	var type = '';

	var eid = id;

	if (entry.kind == 'msg') {

		if (entry.Dir == 'in') {
			id = id.slice(0, -3);
			type = 'msg_in';
		} else {
			type = 'msg_out';
		}

		eid = entry.ParentId;
	}

	$.ajax({
		type : 'POST',
		url : 'srv/delete',
		data : {
			id : id,
			type : type
		},
		dataType : 'json',
		success : function(result) {

			if (result.status == 'success') {

				if (eid == active)
					global.deselect();

				entry.deleted = true;
				entry.notifyOn('delete');
			}
		},
		error : function() {
		},
		complete : function() {
		}
	});

}

function showMsg(msg) {

	var text = msg.Text;

	markMsgAsRead(msg);

	$('#msgDiaText').html(text);
	$('#showTextDia').modal('show');
}

function getDateString(date) {

	var year = date.getUTCFullYear();
	var month = date.getUTCMonth() + 1;
	var day = date.getUTCDate();
	var hour = date.getUTCHours();
	var minutes = date.getUTCMinutes();

	var datestr = year + "/" + zeroPad(month, 2) + "/" + zeroPad(day, 2);
	var timestr = zeroPad(hour, 2) + ":" + zeroPad(minutes, 2);

	return datestr + " &#183; " + timestr;
}

function getLocalDateString(date) {

	var year = date.getFullYear();
	var month = date.getMonth() + 1;
	var day = date.getDate();
	var hour = date.getHours();
	var minutes = date.getMinutes();

	var datestr = year + "/" + zeroPad(month, 2) + "/" + zeroPad(day, 2);
	var timestr = zeroPad(hour, 2) + ":" + zeroPad(minutes, 2);

	return datestr + " &#183; " + timestr;
}

// from the MDN
function getPageVar(sVar) {
	return unescape(window.location.search.replace(new RegExp("^(?:.*[&\\?]"
			+ escape(sVar).replace(/[\.\+\*]/g, "\\$&")
			+ "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}

function checkStaticLink() {

	var lnkId = getPageVar("share");

	if (!lnkId || lnkId == "")
		return;
	
	/* set cookie that authorizes the access to event specific data */
	$.cookie('auth_shared', lnkId);
	
	/* we need google maps from this point on */
	load_gmaps();
	if( typeof global === 'undefined' )
		global = new GlobalControl();

	toggleCloudButton();

	share = true;

	showSplash(false);
	showStationView(false);
	$('#stat-panel').hide();

	$('.tab-private').css("display", "none");
	$('#tabRecent').css("display", "none");

	$('#tabStatic').css("display", "inline");
	$('#tabStatic a').click();

	onResize();

	$.ajax({
		type : 'POST',
		url : "srv/getShared",
		data : {
			lnkid : lnkId
		},
		dataType : 'json',
		success : function(res) {

			if (res.status == "success") {
				deselect();
				var entry = entries.getOrInsert(new Earthquake(res.eq));
				entry.extern = true;
				shared.insert(entry);
				shared.notifyOn('change');

				global.vis(entry);
				map.panTo({
					lat : Number(res.pos.lat),
					lng : Number(res.pos.lon)
				});
				map.setZoom(res.pos.zoom);
			}
		},
		error : function() {
		},
		complete : function() {
		}
	});
}

function shareOnClick() {

	var entry = $(this).parents(".entry").data("entry");

	createStaticLink(entry);
}

function createStaticLink(entry) {

	if (!loggedIn) {

		signTarget = createStaticLink.bind(this, entry);
		$("#SignInDialog").modal("show");
		return;
	}

	var id = entry._id;

	var pos = map.getCenter();

	$.ajax({
		type : 'POST',
		url : "srv/staticLnk",
		data : {
			id : id,
			lon : pos.lng(),
			lat : pos.lat(),
			zoom : map.getZoom()
		},
		dataType : 'json',
		success : function(result) {

			if (result.status == "success") {
				var lnkKey = result.key;
				// var link = window.location.origin + window.location.pathname
				// + "?share=" + lnkKey;
				var link = getURL() + "?share=" + lnkKey;
				var link_enc = encodeURIComponent(link);
				$('#sharedLnk').html(link);
				$("#lnkTwitter").attr("href",
						"http://twitter.com/home?status=" + link_enc);
				$("#lnkGplus").attr("href",
						"https://plus.google.com/share?url=" + link_enc);
				$("#lnkFace").attr("href",
						"http://www.facebook.com/share.php?u=" + link_enc);
				$('#shareDia').modal('show');
			}
		},
		error : function() {
			console.log("#error");
		},
		complete : function() {
		}
	});
}

function toggleCloudButton() {

	if (loggedIn) {

		$('#btnDeselect span').removeClass('glyphicon-globe');
		$('#btnDeselect span').addClass('glyphicon-cloud-upload');

		$('#btnDeselect').unbind('click');
		$('#btnDeselect').click(reload);
		$('#btnDeselect').data('bs.tooltip').options.title = "Back to Cloud";

	} else {

		$('#btnDeselect span').addClass('glyphicon-globe');
		$('#btnDeselect span').removeClass('glyphicon-cloud-upload');

		$('#btnDeselect').unbind('click');
		$('#btnDeselect').click(deselect);
		$('#btnDeselect').data('bs.tooltip').options.title = "Deselect and show map only";
	}
}

function onResize() {

	/* check if fullscreen */
	/*
	 * if( window.screenTop == 0 && window.screenY == 0 ) return;
	 */

	/* adjust anything that was dynamically sized */
	var playerHeight = $('#vsdbPlayer').is(':visible') ? $('#vsdbPlayer')
			.outerHeight() : 0;
	var h = $('.tabs-head').height() + playerHeight + 1;
	$('.tab-pane').css("top", h);

	google.maps.event.trigger(map, 'resize');
}

function mapResized() {

	/* get size and position used for canvas */
	var pad_top = $("#stat-dias").innerHeight() - $("#stat-dias").height();
	var rect = $("#mapview").offset();
	rect.width = $("#mapview").width();
	rect.height = $("#mapview").height() + pad_top;

	canvas.resize(rect);
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

function showSplash(show) {

	$("#splash").css("display", show ? "block" : "none");
	$("#splash").css("display", show ? "block" : "none");
	$(".mainview").css("display", show ? "none" : "block");

	if (show == true) {

		if ($.cookie('username')) {

			$('#splashUser').val($.cookie('username'));
			$('#splashPass').focus();

		} else {

			$('#splashUser').focus();
		}

		/* load iframes after page initialization is finished to avoid blocking */
		/* the real src address is stored as a data member 'data-src' */
		$('iframe').each(function() {
			$(this).attr("src", $(this).data("src"));
		});

	} else {

		/** *** */
		$('.wrapper .border').css('height', '100%');
		$('.wrapper .border').addClass('normal');
		$('.wrapper .border').removeClass('border');
		$('.gfz-head').hide();
		$('.wrapper hr').hide();
		$('.wrapper').css('width', '100%');
		$('.wrapper').css('height', '100%');
		/*
		 * $('.gfz-logo-small').show(); $('.tridec-logo-small').show();
		 */
		// $('.tridec-logo').hide();
		$('.headline').css('background-color', '#f8f8f8');
		$('.headline').css('border-color', '#e7e7e7');
		/** *** */

		map.setCenter(new google.maps.LatLng(0, 0));
		onResize();
	}

}

function toggleStationView() {

	var lnk = $('#stat-toggle-lnk span');
	var visible = lnk.hasClass('glyphicon-chevron-down');

	lnk.toggleClass('glyphicon-chevron-up');
	lnk.toggleClass('glyphicon-chevron-down');

	showStationView(!visible);
	stationSymbols.enableLines(!visible);
}

function showStationView(flag) {

	if (flag == true) {
		$('#stat-dias').css("display", "block");
		$('#mapview').css("height",
				"calc( 100% - " + $('#stat-dias').css("height") + " )");
		stationView.reload();
	} else {
		$('#stat-dias').css("display", "none");
		$('#mapview').css("height", "100%");
		stationView.deactivate();
	}

	google.maps.event.trigger(map, 'resize');
}

function toggleStations() {

	var enabled = $(this).is(":checked");

	stationSymbols.show(enabled);
	stationView.enableLines(enabled);
}

function getStationList(handler) {

	var data = {};

	if (!checkPerm("chart"))
		return handler(null);

	if (!checkPerm("vsdb"))
		data['inst'] = "gfz_ex_test";
	else if (curuser.inst)
		data['inst'] = curuser.inst.name;

	$.ajax({
		type : 'POST',
		url : "webguisrv/stationlist",
		data : data,
		dataType : 'json',
		success : function(result) {
			serverTime = new Date(result.serverTime);

			/* filter stations according to properties */
			var filtered = [];
			for (var i = 0; i < result.stations.length; i++) {
				var stat = result.stations[i];
				var elem = contains(curuser.countries, '_id', stat.country);
				var type_ok = (!stat.sensor || [ "rad", "prs", "flt", "pr1" ]
						.indexOf(stat.sensor) >= 0);
				if (elem && elem.on && type_ok) {
					filtered.push(stat);
				}
			}
			result.stations = filtered;

			handler(result);
		},
		error : function() {
			handler(null);
		}
	});
}

function contains(array, field, value) {

	for (var i = 0; i < array.length; i++) {
		if (array[i][field] == value) {
			return array[i];
		}
	}

	return null;
}

function addGlobalStations(result) {

	if (!result)
		return;

	var list = result.stations;

	stations.clear();
	for (var i = 0; i < list.length; i++) {

		var stat = new Station(list[i]);
		stat.load();
		stations.insert(stat);
	}

	stationView.reload();
	stationView.enableLines($('#stat-chk').is(':checked'));
	stationSymbols.recreate();
}

var overlay;

function projection_changed() {

	overlay = new google.maps.OverlayView();
	overlay.draw = function() {
	};
	overlay.setMap(map);
}

function Canvas(widget, rect) {

	this.widget = widget;

	this.resize = function(rect) {

		this.rect = rect;
	};

	/* adjusts p1 according to the line created between p1 and p2 */
	this.adjust_point = function(p1, p2) {

		var p = this.rect;
		var left_adj, right_adj, top_adj, bottom_adj;

		var mx = (p2.top - p1.top) / (p2.left - p1.left);
		var my = (p2.left - p1.left) / (p2.top - p1.top);

		/* adjust point to the left */
		left_adj = Math.max(p1.left, p.left);
		p1.top = mx * (left_adj - p1.left) + p1.top;
		p1.left = left_adj;

		/* adjust point to the right */
		right_adj = Math.min(p1.left, p.left + p.width);
		p1.top = mx * (right_adj - p1.left) + p1.top;
		p1.left = right_adj;

		/* adjust point at top */
		top_adj = Math.max(p1.top, p.top);
		p1.left = my * (top_adj - p1.top) + p1.left;
		p1.top = top_adj;

		/* adjust point at bottom */
		bottom_adj = Math.min(p1.top, p.top + p.height);
		p1.left = my * (bottom_adj - p1.top) + p1.left;
		p1.top = bottom_adj;

		return p1;
	};

	this.drawLine = function(p1, p2) {

		if (this.rect != null) {
			p1 = this.adjust_point(p1, p2);
			p2 = this.adjust_point(p2, p1);
		}

		var width = Math.abs(p1.left - p2.left);
		var height = Math.abs(p1.top - p2.top);

		this.widget.width(width);
		this.widget.height(height);
		this.widget.css("left", Math.min(p1.left, p2.left) + "px");
		this.widget.css("top", Math.min(p1.top, p2.top) + "px");
		this.widget.css("display", "block");

		var canvas = this.widget[0];

		canvas.width = width;
		canvas.height = height;

		var ctx = canvas.getContext('2d');

		ctx.strokeStyle = 'black';
		ctx.lineWidth = 1;
		ctx.beginPath();

		if (p1.left < p2.left) {
			ctx.moveTo(0.5, canvas.height);
			ctx.lineTo(canvas.width, 0);
		} else {
			ctx.moveTo(canvas.width, canvas.height);
			ctx.lineTo(0, 0);
		}

		ctx.closePath();
		ctx.stroke();
	};

	this.clearCanvas = function() {

		this.widget.css("display", "none");

		var canvas = this.widget[0];

		canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
	};

	this.resize(rect);
}

function LatLonToPixel(lat, lon) {

	var latlon = new google.maps.LatLng(lat, lon);
	var pixel = overlay.getProjection().fromLatLngToContainerPixel(latlon);

	return pixel;
}

function Splash() {

	this.div = $('#splash');
	this.navArrow = this.div.find('.nav-arrow');
	this.slides = $('#splash .slide');

	this.lastTop = $(document).scrollTop();

	this.scrollMain = function(e) {

		var diff = $(document).scrollTop() - this.lastTop;

		this.slides.each(this.scrollDiv.bind(this, diff));

		this.lastTop = $(document).scrollTop();

		if ($(window).scrollTop() + $(window).height() == $(document).height()) {
			this.navArrow.removeClass('glyphicon-download');
			this.navArrow.addClass('glyphicon-upload');
		} else {
			this.navArrow.addClass('glyphicon-download');
			this.navArrow.removeClass('glyphicon-upload');
		}

	};

	this.scrollDiv = function(diff, idx, div) {

		div = $(div);
		var scrollTop = div.scrollTop();

		var top = $(document).scrollTop() + $(window).height(); // $('.container').height();

		/* start scrolling if image is visible for one half */
		// if( top > div.offset().top + div.height() / 2 &&
		// $(document).scrollTop() < div.offset().top + div.height() ) {
		if (div.offset().top < top) {
			var val = Math.min(scrollTop - diff / 1.5, div.height());
			val = Math.max(val, 0);
			div.scrollTop(val);
		}
	};

	this.navigate = function() {

		var elem = $(document.elementFromPoint(this.div.offset().left, 0));
		var pos = 0;

		elem = elem.closest('.section, .slide');

		if (elem.length == 0) {
			/* we are at the top */
			elem = this.div.find('.section:first');
		}

		elem = elem.nextAll('.section');

		if (elem.length > 0 && this.navArrow.hasClass('glyphicon-download')) {
			/* we are not at the bottom */
			pos = elem.offset().top + 1;
		}

		$("html, body").animate({
			scrollTop : pos
		}, 1000);
	};

	$(window).scroll(this.scrollMain.bind(this));

	// $( this.slides.get(1) ).scrollTop( 800 );
	this.slides.scrollTop(800);

	this.navArrow.click(this.navigate.bind(this));
}

function MailDialog() {
	
	this.init = function() {
		var grp;
		this.dialog = new HtmlDialog($('.mail-dialog'));
		this.secGroups1 = this.dialog.content.find('.secGroups1');
		this.secFtp = this.dialog.content.find('.secFtp');
		this.secMailText = this.dialog.content.find('.secMailText');
		this.secSmsText = this.dialog.content.find('.secSmsText');
		this.secGroups2 = this.dialog.content.find('.secGroups2');
		this.btnInfo = this.secMailText.find('.btnInfo');
		this.btnEnd = this.secMailText.find('.btnEnd');
		this.btnCancel = this.secMailText.find('.btnCancel');
		this.mailText = this.secMailText.find('.txtMsg');
		this.smsText = this.secSmsText.find('.txtMsg');
		this.btnSave = this.dialog.footer.find('.btnSave');
		
		this.txtCloud = new HtmlTextGroup('Cloud users:', 'cloud');
		grp = new HtmlDynGroup('Cloud addresses');
		grp.content.append( this.txtCloud.div );
		this.secGroups1.append(grp.div);
		this.grpCloud = grp;
		
		this.txtFrom = new HtmlTextGroup('From:', null, true);
		this.txtTo = new HtmlTextGroup('To:', 'envelope');
		this.txtCc = new HtmlTextGroup('Cc:', 'envelope');
		grp = new HtmlDynGroup('E-mail addresses');
		grp.content.append( this.txtFrom.div, this.txtTo.div, this.txtCc.div );
		grp.expand(true);
		this.secGroups1.append(grp.div);
		this.grpMail = grp;
		
		this.txtFax = new HtmlTextGroup('Fax numbers:', 'phone-alt');
		grp = new HtmlDynGroup('Fax addresses');
		grp.content.append( this.txtFax.div );
		this.secGroups1.append(grp.div);
		this.grpFax = grp;
		
		this.txtFTP = new HtmlInputGroup('Publish on FTP:', 'link', this.secFtp);		
		grp = new HtmlDynGroup('FTP / GTS address');
		grp.content.append( this.txtFTP.div );
		this.secFtp.append(grp.div);
		this.txtFtpFile = this.secFtp.find('.txtFile');
		this.chkFtp = this.secFtp.find('.spnChk > input[type=checkbox]');
		this.grpFtp = grp;
		
		this.txtSubject = new HtmlTextGroup('Subject:');
		grp = new HtmlDynGroup('Message', this.secMailText);
		grp.content.find('.subject').html( this.txtSubject.div );
		grp.expand(true);
		this.grpMailText = grp;
		
		this.txtSMS = new HtmlTextGroup('Mobile numbers:', 'phone');
		grp = new HtmlDynGroup('SMS', this.secSmsText);
		grp.content.prepend( this.txtSMS.div );
		this.grpSmsText = grp;
		
		this.txtEvtId = new HtmlTextGroup('Event-ID', 'map-marker', true);
		this.txtParentId = new HtmlTextGroup('Parent-ID', 'map-marker', true);
		grp = new HtmlDynGroup('Related events');
		grp.content.append( this.txtEvtId.div );
		grp.content.append( this.txtParentId.div );
		this.secGroups2.append(grp.div);
		this.grpIds = grp;
		
		/* register callback for radio buttons */
		this.dialog.content.find('.secMailText .btn').change(this.setMsgTexts.bind(this));
		
		/* auto resize text areas when the dialog becomes visible */
		this.dialog.div.on('shown.bs.modal', (function() {
			this.resize();
		}).bind(this));
		
		/* count and display number of characters in SMS text on change */
		this.smsText.on('input change', (function() {
			this.secSmsText.find('.spnNumChars').html( this.smsText.val().length );
		}).bind(this));
		
		/* send message if "save" button has been clicked */
		this.btnSave.click(this.send.bind(this));
	};
	
	this.show = function(eq) {
		/* store passed earthquake event for later use */
		this.eq = eq;
		/* clear all input fields */
		this.dialog.content.find(':input').val("");
		/* set static fields */
		var root = this.eq.root ? this.eq.root : this.eq._id;
		this.txtFrom.value(curuser.username);
		this.txtEvtId.value(root);
		this.txtParentId.value(this.eq._id);
		/* set FTP path according to user settings */
		if( curuser.properties ) {
			this.secFtp.find('txtPath').html( curuser.properties.FtpHost + curuser.properties.FtpPath );
			if( curuser.properties.FtpFile && curuser.properties.FtpFile != "") {
				this.txtFtpFile.val(curuser.properties.FtpFile);
			}
		}
		/* show/hide groups according to user permissions */
		var showFax = checkPerm('fax') && checkProp('InterfaxUsername')	&& checkProp('InterfaxPassword');
		var showFtp = checkPerm('ftp') && checkProp('FtpUser') && checkProp('FtpHost') && checkProp('FtpPath');
		this.grpCloud.show( checkPerm('intmsg') );
		this.grpMail.show( checkPerm('mail') );
		this.grpFax.show( showFax );
		this.grpFtp.show( showFtp );
		this.grpMailText.show( checkPermsAny('intmsg', 'mail') || showFax || showFtp );
		this.grpSmsText.show( checkPerm('sms') && checkProp('TwilioSID') && checkProp('TwilioToken') && checkProp('TwilioFrom') );
		this.grpIds.show(true);
		
		this.setMsgTexts();
		this.dialog.show();
	};
	
	this.setMsgTexts = function() {
		var kind = "info";
		kind = this.btnInfo.is(':checked') ? "info" : kind;
		kind = this.btnEnd.is(':checked') ? "end" : kind;
		kind = this.btnCancel.is(':checked') ? "cancel" : kind;
		
		var subject = {
			"info" : "Tsunami Information/Watch/Advisory",
			"end" : "Tsunami End",
			"cancel" : "Tsunami Cancelation"
		};
		
		this.txtSubject.value(subject[kind]);
		
		/* lock dialog */
		this.dialog.lock();
		
		ajax_mt('webguisrv/get_msg_texts', {evtid: this.eq._id, kind: kind}, (function(result) {
			this.mailText.val(result.mail);
			this.smsText.val(result.sms);
			this.msgnr = result.msgnr;
			this.smsText.trigger("change");
			this.resize();
			/* set FTP file if not already done */
			if( this.txtFtpFile.val() != "" )
				this.txtFtpFile.val( zeroPad(this.msgnr, 3) + ".txt");
			/* unlock dialog */
			this.dialog.unlock();
		}).bind(this));
	};
	
	this.resize = function() {
		/* back-up state of groups containing the text areas */
		var visMail = this.grpMailText.open;
		var visSms = this.grpSmsText.open;
		/* back-up scroll position */
		var sPos = this.dialog.div.scrollTop();
		/* make both groups visible to obtain there height */
		this.grpMailText.expand(true);
		this.grpSmsText.expand(true);
		/* adjust height of text areas */
		this.mailText.innerHeight(0);
		this.mailText.innerHeight( this.mailText.prop('scrollHeight') );
		this.smsText.innerHeight( this.smsText.prop('scrollHeight') );
		/* restore previous state */
		this.grpMailText.expand(visMail);
		this.grpSmsText.expand(visSms);
		/* restore scroll position */
		this.dialog.div.scrollTop( sPos );
	};
	
	this.send = function() {
		var sent = false;
		
		if( this.btnEnd.is(':checked') || this.btnCancel.is(':checked') )
			this.msgnr = 0;

		if( this.txtCloud.value() != '' ) {
			console.log('Sent internal message!');
			sent = true;
			ajax_mt(
				'msgsrv/intmsg',
				{ apiver: 1,
				  to: this.txtCloud.value(),
				  subject : this.txtSubject.value(),
				  text : this.mailText.val(),
				  evid : this.txtEvtId.value(),
				  parentid: this.txtParentId.value(),
				  msgnr: this.msgnr
				},
				function(result) { console.log(result.status); }
			);
		}
		
		if( this.txtTo.value() != '' || this.txtCc.value() != '' ) {
			console.log('Sent email!');
			sent = true;
			ajax_mt(
				'msgsrv/mail',
				{ apiver: 1,
				  to: this.txtTo.value(),
				  cc: this.txtCc.value(),
				  subject : this.txtSubject.value(),
				  text : this.mailText.val(),
				  evid : this.txtEvtId.value(),
				  parentid: this.txtParentId.value(),
				  msgnr: this.msgnr
				},
				function(result) { console.log(result.status); }
			);
		}
		
		if( this.txtFax.value() != '' ) {
			console.log('Sent fax!');
			sent = true;
			ajax_mt(
				'msgsrv/fax',
				{ apiver: 1,
				  to: this.txtFax.value(),
				  text : this.mailText.val(),
				  evid : this.txtEvtId.value(),
				  parentid: this.txtParentId.value(),
				  msgnr: this.msgnr
				},
				function(result) { console.log(result.status); }
			);
		}
		
		if( this.chkFtp.is(':checked') && this.txtFtpFile.val() != '' ) {
			console.log('Published on FTP-Server!');
			sent = true;
			ajax_mt(
				'msgsrv/ftp',
				{ apiver: 1,
				  fname : this.txtFtpFile.val(),
				  text : this.mailText.val(),
				  evid : this.txtEvtId.value(),
				  parentid: this.txtParentId.value(),
				  msgnr: this.msgnr
				},
				function(result) { console.log(result.status); }
			);
		}
		
		if( this.txtSMS.value() != '' ) {
			console.log('Sent sms!');
			sent = true;
			ajax_mt(
				'msgsrv/sms',
				{ apiver: 1,
				  to: this.txtSMS.value(),
				  text : this.smsText.val(),
				  evid : this.txtEvtId.value(),
				  parentid: this.txtParentId.value(),
				},
				function(result) { console.log(result.status); }
			);
		}
		
		if( ! sent ) {
			var options = {
				content : "Please specify at least one receiver and click again!",
				title : "Info",
				trigger : 'manual',
				placement : 'top'
			};
			this.btnSave.popover(options);
			this.btnSave.popover('show');
			setTimeout( (function() {
				this.btnSave.popover('hide');
			}).bind(this), 3000);
		} else {
			this.dialog.hide();
		}
	};
		
	this.init();
}

function AdminDialog() {
	
	this.init = function() {
		/* used to store users and institutions loaded from server */
		this.userlist = new Container(sort_string.bind(this, 'username'));
		this.instlist = new Container(sort_string.bind(this, 'name'));
		
		this.dialog = new HtmlDialog($('.admin'));
		this.inputs = {
			'InterfaxUsername': new HtmlTextGroup('Fax-Username', 'phone-alt'),
			'InterfaxPassword': new HtmlTextGroup('Fax-Password', 'phone-alt'),
			'TwilioFrom': new HtmlTextGroup('Twilio-Number', 'phone'),
			'TwilioSID': new HtmlTextGroup('Twilio-SID', 'phone'),
			'TwilioToken': new HtmlTextGroup('Twilio-Token', 'phone'),
			'FtpUser': new HtmlTextGroup('FTP-Username', 'link'),
			'FtpHost': new HtmlTextGroup('FTP-Host', 'link'),
			'FtpPath': new HtmlTextGroup('FTP-Path', 'link'),
			'FtpFile': new HtmlTextGroup('FTP-File', 'link'),
			'FtpPassword': new HtmlTextGroup('FTP-Password', 'link')
		};
		
		this.permInputs = {
			'fax': new HtmlCheckBox('Fax'),
			'ftp': new HtmlCheckBox('FTP / GTS'),
			'sms': new HtmlCheckBox('SMS'),
			'mail': new HtmlCheckBox('Mail'),
			'comp': new HtmlCheckBox('Computations'),
			'timeline': new HtmlCheckBox('Timeline'),
			'manage': new HtmlCheckBox('Manage'),
			'share': new HtmlCheckBox('Share'),
			'chart': new HtmlCheckBox('Chart'),
			'intmsg': new HtmlCheckBox('Cloud-Message'),
			'notify': new HtmlCheckBox('Notifications'),
			'api': new HtmlCheckBox('API'),
			'report': new HtmlCheckBox('Report')
		};
		
		this.instInputs = {
			'descr': new HtmlTextGroup('Description', 'user'),
			'msg_name': new HtmlTextGroup('Message-Line', 'user'),
			'secret': new HtmlTextGroup('Secret', 'user')
		};
		
		this.user_pwd = new HtmlPasswordGroup('Password', 'user');
		this.user_pwd.validate("^....+$");
		
		this.drpInst = new HtmlDropDown();
		this.drpInst.setSource(this.instlist);
		this.drpInst.setToString( function(o){return o.name;} );
				
		this.tabUser = $('#adminTabUser');
		this.tabInst = $('#adminTabInst');
		this.secProp = this.dialog.content.find('.secProp');
		this.secPerm = this.dialog.content.find('.secPerm');
		
		this.autoUsers = new HtmlDropDownAuto('Users');
		this.autoUsers.setSource(this.userlist);
		this.autoUsers.setToString( function(o){return o.username;} );
		this.secProp.append( this.autoUsers.div );
		
		var cbox = new HtmlInputGroup('Institution', 'user');
		cbox.input.append( this.drpInst.div );
		
		var ubox = new HtmlInputGroup('Username', 'user');
		ubox.input.append( this.autoUsers.div );
				
		var grp;
		grp = new HtmlDynGroup('General');
		grp.content.append(
			ubox.div,
			this.user_pwd.div,
			cbox.div );
		grp.expand(true);
		this.secProp.append(grp.div);
		
		grp = new HtmlDynGroup('Fax');
		grp.content.append(
			this.inputs.InterfaxUsername.div,
			this.inputs.InterfaxPassword.div );
		this.secProp.append(grp.div);
		
		grp = new HtmlDynGroup('FTP / GTS');
		grp.content.append(
			this.inputs.FtpUser.div,
			this.inputs.FtpHost.div,
			this.inputs.FtpPath.div,
			this.inputs.FtpFile.div,
			this.inputs.FtpPassword.div );
		this.secProp.append(grp.div);
		
		grp = new HtmlDynGroup('SMS');
		grp.content.append(
			this.inputs.TwilioFrom.div,
			this.inputs.TwilioSID.div,
			this.inputs.TwilioToken.div );
		this.secProp.append(grp.div);
		
		grp = new HtmlDynGroup('Permissions');
		for( var attr in this.permInputs )
			grp.content.append( this.permInputs[attr].div );
		this.secPerm.append(grp.div);
		
		this.btnSave = this.tabUser.find('.btnSave');
		this.btnModify = this.tabUser.find('.btnModify');
		this.btnDelete = this.tabUser.find('.btnDelete');
		this.btnClear = this.tabUser.find('.btnClear');
		
		this.btnSave.click(this.save.bind(this));
		this.btnModify.click(this.save.bind(this));
		this.btnDelete.click(this.remove.bind(this));
		this.btnClear.click(this.clear.bind(this));
		
		this.tabUser.find('.html-text, .html-check').change(this.control.bind(this));
		this.drpInst.setCallback('change', this.control.bind(this));
		this.autoUsers.setCallback('select', this.onUserSelect.bind(this));
		this.autoUsers.setCallback('change', this.onUserSelect.bind(this));
		
		/* institutions tab */		
		this.autoInst = new HtmlDropDownAuto();
		this.autoInst.setSource(this.instlist);
		this.autoInst.setToString( function(o){return o.name;} );
		
		var ibox = new HtmlInputGroup('Institution', 'user');
		ibox.input.append( this.autoInst.div );
		
		grp = new HtmlDynGroup('General');
		grp.content.append(ibox.div);
		for( var attr in this.instInputs )
			grp.content.append( this.instInputs[attr].div );
		grp.expand(true);
		this.tabInst.find('.secInputs').append(grp.div);
		
		grp = new HtmlDynGroup('Users');
		grp.content.append('<ul class="users"></ul>');
		grp.expand(true);
		this.tabInst.find('.secInputs').append(grp.div);
		
		this.btnInstSave = this.tabInst.find('.btnSave');
		this.btnInstModify = this.tabInst.find('.btnModify');
		this.btnInstDelete = this.tabInst.find('.btnDelete');
		this.btnInstClear = this.tabInst.find('.btnClear');
		
		this.btnInstSave.click(this.saveInst.bind(this));
		this.btnInstModify.click(this.saveInst.bind(this));
		this.btnInstDelete.click(this.removeInst.bind(this));
		this.btnInstClear.click(this.clearInst.bind(this));
		
		this.tabInst.find('.html-text').change(this.controlInst.bind(this));
		this.autoInst.setCallback('select', this.onInstSelect.bind(this));
		this.autoInst.setCallback('change', this.onInstSelect.bind(this));
	};
	
	this.load = function() {
		this.control();
		this.controlInst();
		ajaxCascade( 
			getAjax('webguisrv/userlist/', null, this.getUsers.bind(this)),
			getAjax('webguisrv/instlist/', null, this.getInsts.bind(this)) );
	};

	this.getUsers = function(result) {

		this.userlist.clear();
		
		if (result.status != "success") {
			console.log("Error in webguisrv/userlist");
			return;
		}

		for (var i = 0; i < result.users.length; i++)
			this.userlist.insert(result.users[i]);

		this.userlist.notifyOn('change');
	};

	this.getInsts = function(result) {

		this.instlist.clear();
		
		if (result.status != "success") {
			console.log("Error in webguisrv/instlist");
			return;
		}
				
		this.instlist.insert({name:'None'});
		
		for (var i = 0; i < result.institutions.length; i++)
			this.instlist.insert(result.institutions[i]);
		
		this.instlist.notifyOn('change');
						
		this.dialog.show();
	};
	
	this.onUserSelect = function() {
		var idx = this.autoUsers.select();
		if( idx >= 0 )
			this.loadUser();
		this.control();
	};
			
	this.control = function() {	
		this.btnSave.hide();
		this.btnModify.hide();
		this.btnDelete.hide();
						
		var sel = this.autoUsers.select();
		if( sel < 0 ) {
			/* New user */
			this.btnSave.show();
			this.btnSave.prop('disabled',this.autoUsers.value() == '');
			return;
		}
		
		/* Modify user */
		/* check if input was modified */
		var user = this.userlist.get(sel);
		var prop = user.properties ? user.properties : {};
		var perm = user.permissions ? user.permissions : {};
				
		var idx = Math.max( this.instlist.getByKey('_id', user.inst).idx, 0 );
		var modified = this.drpInst.select() != idx;
		
		modified = modified || this.user_pwd.valid();
						
		for (var attr in this.inputs)
			modified = modified || (this.inputs[attr].value() != prop[attr]);
		
		for (var attr in this.permInputs)
			modified = modified || (this.permInputs[attr].value() != perm[attr]);
				
		this.btnModify.show();
		this.btnModify.prop('disabled',!modified);
		
		if( ! modified )
			this.btnDelete.show();
	};
				
	this.loadUser = function() {
		var idx = this.autoUsers.select();
		if (idx < 0)
			return;

		var user = this.userlist.get(idx);
		/* don't care about undefined values - the HtmlInputField can handle them fine */
		var prop = user.properties ? user.properties : {};
		var perm = user.permissions ? user.permissions : {};

		this.user_pwd.value(user.password);
		
		for (var attr in this.inputs)
			this.inputs[attr].value(prop[attr]);
		
		for (var attr in this.permInputs)
			this.permInputs[attr].value(perm[attr]);

		var idx = Math.max( this.instlist.getByKey('_id', user.inst).idx, 0 );
		this.drpInst.select(idx);
	};
	
	this.save = function() {
		var idx = this.autoUsers.select();
		if (idx >= 0) {
			var user = this.userlist.get(idx);
			this.saveUser(user);
		} else {
			this.registerUser();
		}
	};
	
	this.remove = function() {
		var username = this.autoUsers.value();
		ajax('webguisrv/deluser/', { username : username },
		( function(result) {
			if( result.status == 'success' ) {
				this.userlist.remove('username', username);
				this.userlist.notifyOn('change');
				this.clear();
			} else {
				console.log('Error:', result.errors);
			}
		}).bind(this));
	};
	
	this.clear = function() {
		this.tabUser.find('.html-text').val('');
		this.tabUser.find('.html-text').change();
		this.tabUser.find('.html-check').prop('checked',false);
		this.tabUser.find('.html-check').change();
		this.drpInst.select(0);
	};
	
	this.registerUser = function(response, result) {		
		if (!response) {
			var data = {
				username : this.autoUsers.value(),
				password: this.user_pwd.value()
			};
			ajax('webguisrv/register', data, this.registerUser.bind(this, true));
			return;
		};

		if (result.status != 'success') {
			console.log('Unable to register user.');
			return;
		}
				
		this.saveUser(result.user);
	};

	this.saveUser = function(user) {

		if (!user.properties)
			user.properties = {};
		if (!user.permissions)
			user.permissions = {};
		
		var inst_idx = this.drpInst.select();
		user.inst = null;

		if (inst_idx > 0)
			user.inst = this.instlist.get(inst_idx)._id;
				
		for (var attr in this.inputs)
			user.properties[attr] = this.inputs[attr].value();
		
		for (var attr in this.permInputs)
			user.permissions[attr] = this.permInputs[attr].value();
		
		user.password = this.user_pwd.value();

		ajax('webguisrv/saveuser/', { userobj : JSON.stringify(user) },
		( function(result) {
			user.password = '';
			this.user_pwd.value('');
			if( result.status == 'success' ) {
				if( ! this.userlist.getByKey('username', result.user.username).item ) {
					this.userlist.insert(result.user);
					this.userlist.notifyOn('change');
					this.tabUser.find('.html-text').change();
				}
				this.control();
			}
		}).bind(this));
	};
	
	this.controlInst = function() {	
		this.btnInstSave.hide();
		this.btnInstModify.hide();
		this.btnInstDelete.hide();
		
		var sel = this.autoInst.select();
		if( sel < 0 ) {
			/* New inst */
			this.btnInstSave.show();
			this.btnInstSave.prop('disabled',this.autoInst.value() == '');
			return;
		}
		
		/* Modify inst */
		/* check if input was modified */
		var inst = this.instlist.get(sel);
				
		var modified = false;
		
		for (var attr in this.instInputs)
			modified = modified || (this.instInputs[attr].value() != inst[attr]);
						
		this.btnInstModify.show();
		this.btnInstModify.prop('disabled',!modified || inst.name == 'None');
		
		if( ! modified )
			this.btnInstDelete.show();
	};
	
	this.onInstSelect = function() {
		var idx = this.autoInst.select();
		if( idx >= 0 )
			this.loadInst();
		this.controlInst();
	};
	
	this.loadInst = function() {
		var idx = this.autoInst.select();
		if (idx < 0)
			return;

		var inst = this.instlist.get(idx);
		for( var attr in this.instInputs )
			this.instInputs[attr].value(inst[attr]);
		
		var users = this.userlist.filter('inst', inst._id);
		this.tabInst.find('.users').empty();
		for( var i = 0; i < users.length; i++ )
			this.tabInst.find('.users').append('<li>' + users[i].username + '</li>');
	};
	
	this.saveInst = function() {
		var idx = this.autoInst.select();
		var inst = {};
		if (idx >= 0) {
			inst = this.instlist.get(idx);
		}
		
		inst.name = this.autoInst.value();
		for( var attr in this.instInputs )
			inst[attr] = this.instInputs[attr].value();
		
		ajax('webguisrv/saveinst/', { instobj : JSON.stringify(inst) },
		( function(result) {
			if( result.status == 'success' ) {
				if( ! this.instlist.getByKey('name', result.institution.name).item ) {
					this.instlist.insert(result.institution);
					this.instlist.notifyOn('change');
					this.tabInst.find('.html-text').change();
				}
				this.controlInst();
			}
		}).bind(this));
	};
	
	this.removeInst = function() {
		var name = this.autoInst.value();
		ajax('webguisrv/delinst/', { name : name },
		( function(result) {
			if( result.status == 'success' ) {
				this.instlist.remove('name', name);
				this.instlist.notifyOn('change');
				this.clearInst();
				this.controlInst();
			} else {
				console.log('Error:', result.errors);
			}
		}).bind(this));
	};
	
	this.clearInst = function() {
		this.tabInst.find('.html-text').val('');
		this.tabInst.find('.html-text').change();
		this.tabInst.find('.users').empty();
	};
	
	this.show = function() {
		this.load();
	};
	
	this.init();
}

/* TODO: This is just a wrapper to use some new functionality in deprecated code. To be continued... */
function PropDialog() {
	this.init = function() {
		this.txtSMS = new HtmlTextGroup('SMS', 'phone');
		this.txtSMS.validate('^(\\+[1-9][0-9]*){0,1}$');
		this.txtSMS.div.find('input').attr('id', 'propNotifySms');
		this.txtSMS.setCallback('change', this.onChange.bind(this));
		$('#PropDia #propNotify .propNotifySmsTemplate').html(this.txtSMS.div);
	};
	this.onChange = function() {
		$('#propBtnSubmit').prop('disabled', ! this.txtSMS.valid());
	};
	this.init();
}

function InfoDialog() {
	this.init = function() {
		this.dialog = new HtmlDialog($('.info-dialog'));
		this.tabOthers = this.dialog.div.find('#info-dialog-tab-others');
		this.sourceTemplate = this.tabOthers.find('.source-template');
	};
		
	this.show = function(evt) {
		console.log(evt);
		/* load other sources */
		var data = {
			eventtype: 'EQ',
			y: evt.prop.latitude,
			x: evt.prop.longitude,
			time: new Date(evt.prop.date).getTime() / 1000
		};
		ajax_mt('gethazardevents', data, (function(result) {
			var hazards = result.hazard_events;
			this.tabOthers.html("");
			for( var i = 0; i < hazards.length; i++ ) {
				var form = this.sourceTemplate.clone();
				form.find('.source-provider > img').attr("src", "embed-data/logos/" + hazards[i].provider + ".png");
				form.find('.source-provider > img').attr("alt", "logo-" + hazards[i].provider);
				form.find('.source-provider > span').html( hazards[i].providername );
				form.find('.source-region').html( hazards[i].region );
				form.find('.source-evt-type').html( hazards[i].eventtype );
				form.find('.source-coords').html('Lat: ' + hazards[i].y + '&deg;, Lon: ' + hazards[i].x + '&deg;' );
				form.find('.source-magnitude').html( hazards[i].mag + ' ' + hazards[i].magtype );
				form.find('.source-depth').html( hazards[i].depth + ' km' );
				this.tabOthers.append( form );
			}
		}).bind(this));
		
		this.dialog.show();
	};
	
	this.init();
}

HtmlCheckBox.prototype = new ICallbacks();

function HtmlCheckBox(label, checked) {

	ICallbacks.call(this);
	
	this.init = function(label, checked) {

		this.div = $('.templates > .html-checkbox').clone();
		this.div.find('> .html-label').html(label);
		this.check = this.div.find('> .html-check');
		this.check.change(this.onChange.bind(this));
		
		if( arguments.length > 1 )
			this.value( checked );
	};

	this.value = function(checked,notify) {
		var curval = this.check.prop('checked');		
		if(arguments.length < 1)
			return curval;		
		if( curval == checked )
			return curval;
		
		this.check.prop('checked',checked == true);
		/* only notify others if explicit requested by the caller */
		if( notify == true )
			this.onChange();		
		return checked;
	};
	
	this.onChange = function() {
		this.notifyOn('change',this.value());
	};
	
	this.init(label, checked);
}

function HtmlButton(label, callback) {

	this.div;

	this.create = function(label, callback) {

		this.div = $('.templates .html-button').clone();
		this.div.html(label);

		this.__proto__ = this.div;

		if (callback)
			this.div.click(callback);
	};

	this.enable = function() {
		this.div.attr("disabled", false);
		return this;
	};

	this.disable = function() {
		this.div.attr("disabled", true);
		return this;
	};

	this.html = function() {

		return this.div;
	};

	this.create(label, callback);
}

function HtmlTabGroup() {

	this.div;

	this.create = function() {

		this.div = $('.templates .html-tabgroup').clone();
	};

	this.addTab = function(label, block) {

		/* generate a unique ID for the content block if there is no ID already */
		block.html().uniqueId(); /* jQuery-UI */
		var id = block.html().attr('id');
		block.html().addClass('tab-pane');

		/* generate new tab header */
		var tabHeader = $('.templates .html-tabheader').clone();
		tabHeader.find('a').attr('href', '#' + id);
		tabHeader.find('a').html(label);

		/*  */
		this.div.find('> .html-header').append(tabHeader);
		this.div.find('> .html-content').append(block.html());
	};

	this.header = function() {

		return this.div.find('> .html-header');
	};

	this.content = function() {

		return this.div.find('> .html-content');
	};

	/* call constructor */
	this.create();
}

HtmlDropDown.prototype = new ICallbacks();

function HtmlDropDown() {
	
	ICallbacks.call(this);
	
	this.init = function() {
		this.div = $('.templates .html-dropdown').clone();
		this.content = this.div.find('> ul');
		this.toString = function(o){return o;};
	};
	
	this.setSource = function(source) {
		this.idx = -1;
		this.source = source;
		this.source.setCallback('change',this.display.bind(this));
		this.display();
	};
	
	this.setToString = function(func) {
		this.toString = func;
	};
	
	this.display = function() {
		this.content.empty();
		for( var i = 0; i < this.source.length(); i++ ) {
			var obj = this.source.get(i);
			var item = $('<li><a href="#">' + this.toString(obj) + '</a></li>');
			item.find('> a').click(this.onChange.bind(this));
			this.content.append(item);
		}
	};

	this.onChange = function(e) {
		var item = $(e.delegateTarget);
		this.select(item.closest('li').index());
		this.notifyOn('change');
	};

	this.select = function(idx) {
		if (arguments.length > 0) {
			var items = this.div.find('> ul > li');
			if (idx < items.length) {
				var item = $(items[idx]);
				this.div.find('> button > .html-text').html(
						item.find('> a').html());
				this.idx = idx;
			}
		}
		return this.idx;
	};

	this.init();
};

HtmlDropDownAuto.prototype = new ICallbacks();

function HtmlDropDownAuto() {

	ICallbacks.call(this);
	
	this.init = function() {
		this.div = $('.templates .html-dropdown-auto').clone();
		this.input = this.div.find('> .html-text');
		this.input.change(this.onChange.bind(this));
		this.input.focus(this.onFocus.bind(this));
		this.input.autocomplete({
			minLength : 0,
			select : this.onSelect.bind(this)
		});
		this.toString = function(o){return o;};
	};
	
	this.setSource = function(source) {
		this.curSel = -1;
		this.source = source;
		this.source.setCallback('change',this.display.bind(this));
		this.display();
	};
	
	this.setToString = function(func) {
		this.toString = func;
	};
	
	this.display = function() {
		var list = [];
		for( var i = 0; i < this.source.length(); i++ )
			list.push( {
				label: this.toString(this.source.get(i)),
				idx: i
			});
		
		this.input.autocomplete({
			source : list
		});
	};

	this.onSelect = function(event, ui) {
		this.curSel = ui.item.idx;
		this.notifyOn('select');
	};

	this.onFocus = function() {
		this.input.autocomplete("search");
	};

	this.onChange = function() {
		var val = this.input.val();		
		this.curSel = -1;
		for( var i = 0; i < this.source.length(); i++ ) {
			if( this.toString(this.source.get(i)) == val ) {
				this.curSel = i;
				break;
			}
		}
		this.curSel > -1 ? this.notifyOn('select') : this.notifyOn('change');
	};

	this.enable = function() {
		this.input.autocomplete("enable");
	};

	this.disable = function() {
		this.input.autocomplete("disable");
	};

	this.select = function(idx) {
		if (arguments.length > 0) {
			this.input.val( this.toString(this.source.get(idx)) );
			this.input.change();
		}
		return this.curSel;
	};

	this.value = function(newValue) {
		if (arguments.length > 0)
			this.input.val(newValue);
		return this.input.val();
	};

	this.init();
}

HtmlPasswordGroup.prototype = new HtmlTextGroup();

function HtmlPasswordGroup(label, icon, readonly) {
	
	HtmlTextGroup.apply(this, arguments);
	this.div.find('> .html-text').prop('type', 'password');
}

HtmlTextGroup.prototype = new ICallbacks();

function HtmlTextGroup(label, icon, readonly) {
	
	ICallbacks.call(this);
	
	this.regex = null;

	this.init = function(label, icon, readonly) {
		this.div = $('.templates > .html-textgroup').clone();
		if( label != null ) {
			this.div.find('> .html-label').html(label);
		} else {
			this.div.find('> .html-label').hide();
		}
		if( icon ) {
			this.div.find('> .html-icon > span').addClass('glyphicon-' + icon);
		} else {
			this.div.find('> .html-icon').hide();
		}
		if( readonly )
			this.div.find('> .html-text').attr('readonly', true);
		this.div.find('> .html-text').on('change', this.onChange.bind(this));
	};

	this.value = function(newValue) {
		if (arguments.length > 0)
			this.div.find('> .html-text').val(newValue);
		return this.div.find('> .html-text').val();
	};

	this.validate = function(regex) {
		this.regex = new RegExp(regex);
	};
	
	this.valid = function() {
		if( ! this.regex )
			return true;
		return this.regex.test(this.value());
	};

	this.onChange = function() {
		if( ! this.valid() ) {
			this.div.find('> .html-text').css('color', 'red');
		} else {
			this.div.find('> .html-text').css('color', '');
		}
		this.notifyOn('change', this.value());
	};
	
	this.init.apply(this, arguments);
}

function HtmlInputGroup(label, icon, box) {

	this.init = function(label, icon, box) {

		this.div = $('.templates > .html-inputgroup').clone();
		this.div.find('> .html-label').html(label);
		this.div.find('> .html-icon > span').addClass('glyphicon-' + icon);
		this.input = this.div.find('> .html-input');
		
		if( box ) {
			this.input.replaceWith( box.find('> .content').children() );
			box.html(this.div);
		}
	};

	this.init(label, icon, box);
}

function HtmlDynGroup(label,box) {

	this.init = function(label,box) {

		this.div = $('.templates > .html-dyngroup').clone();
		this.header = this.div.find('> .html-header');
		this.content = this.div.find('> .html-content');
		this.arrow = this.header.find('> .html-arrow');
		this.icon = this.arrow.find('> span');
		
		this.header.find('> .html-label').html(label);
		this.arrow.click(this.onClick.bind(this));
		
		this.open = false;
		this.update();
		
		if( box ) {
			this.content.append(box.find('> .content'));
			box.html(this.div);
		}
	};
	
	this.update = function() {
		
		this.icon.removeClass('glyphicon-chevron-up');
		this.icon.removeClass('glyphicon-chevron-down');
		
		if( this.open ) {
			this.icon.addClass('glyphicon-chevron-up');
			this.content.show();
		} else {
			this.icon.addClass('glyphicon-chevron-down');
			this.content.hide();
		}
	};
	
	this.expand = function(open) {
		this.open = open;
		this.update();
	};
	
	this.show = function(show) {
		show ? this.div.show() : this.div.hide();
	};
	
	this.onClick = function() {
		this.expand(! this.open);
	};

	this.init(label,box);
}

function HtmlDialog(box) {

	this.init = function(box) {
		
		this.div = $('.templates > .html-dialog').clone();
		this.header = this.div.find('> .modal-dialog > .modal-content > .modal-header');
		this.content = this.div.find('> .modal-dialog > .modal-content > .modal-body');
		this.footer = this.div.find('> .modal-dialog > .modal-content > .modal-footer');
		
		if( box ) {
			this.header.append(box.find('> .header'));
			this.content.append(box.find('> .content'));
			this.footer.append(box.find('> .footer'));
			box.html(this.div);
		}
		this.unlock();
	};
	
	this.show = function() {
		this.div.modal('show');
	};
	
	this.hide = function() {
		this.div.modal('hide');
	};
	
	this.unlock = function() {
		this.div.find('> .modal-status').hide();
		this.div.find('.modal-content > .modal-overlay').hide();
	};
	
	this.lock = function() {
		this.div.find('> .modal-status').show();
		this.div.find('.modal-content > .modal-overlay').show();
	};
	
	this.init(box);
}

HtmlRangeSlider.prototype = new ICallbacks();

function HtmlRangeSlider(min,max,step) {

	ICallbacks.call(this);
	
	this.init = function(min,max,step) {
		this.div = $('.templates > .html-range-slider').clone();
		this.div.slider({
			range: true,
			min: min,
			max: max,
			step: step,
			values: [min,max],
			slide: this.onslide.bind(this),
			stop: this.notifyOn.bind(this,'change')
		});
	};
	
	this.onslide = function(event, ui) {
		this.notifyOn('slide',ui.values);
	};
	
	this.values = function(vals) {
		if (arguments.length > 0)
			this.div.slider('values',vals);
		return this.div.slider('values');
	};
	
	this.contains = function(val) {
		var range = this.values();
		if( val >= range[0] && val <= range[1] )
			return true;
		return false;
	};
	
	this.init(min,max,step);
}

/* ajax related framework functions */
function getAjax(url, data, callback) {

	var ajaxObj = {
		url : url,
		data : data,
		callback : callback
	};

	return ajaxObj;
}

function ajax( /* url, data, callback || ajaxObj */) {

	var ajaxObj;

	if (arguments.length == 1) {
		ajaxObj = arguments[0];
	} else if (arguments.length == 3) {
		ajaxObj = getAjax.apply(this, arguments);
	} else {
		return;
	}

	ajax_internal(ajaxObj);
}

function ajax_internal(ajaxObj) {

	$.ajax({
		type : 'POST',
		url : ajaxObj.url,
		dataType : "json",
		data : ajaxObj.data,
		success : function(result) {

			if (ajaxObj.callback)
				ajaxObj.callback(result);
		},
		error : function() {
			console.log('Internal error in ajax request: ', ajaxObj);
		}
	});
}

function ajaxCascade() {

	var remaining = [];

	if (arguments.length < 1)
		return;

	for (var i = 1; i < arguments.length; i++) {
		remaining.push(arguments[i]);
	}

	var ajaxObj = arguments[0];
	var callback = ajaxObj.callback;
	var f = function(result) {
		if (callback)
			callback(result);
		ajaxCascade.apply(this, remaining);
	};

	ajaxObj.callback = f;
	ajax(ajaxObj);
}

function Layer(name, map) {
	
	this.init = function(name, map) {
		this.name = name;
		this.map = map;
		this.data = null;
		this.visible = true;
	};
	
	this.setData = function(data) {
		/* nothing to update if data hasn't changed */
		if( this.data == data )
			return;
		/* if data was set previously, we need to deregister the callback and clear the layer */
		if( this.data ) {
			this.data.delCallback('update',this.cid);
			this.clear();
		}
		/* assign new data now */
		this.data = data;
		/* register callback and update view */
		if( this.data ) {
			this.cid = this.data.setCallback('update',this.update.bind(this));
			this.update();
		}
	};
		
	this.display = function() {};
	this.clear = function() {};
	
	this.update = function() {
		if( this.visible )
			this.display();
	};
	
	this.show = function(show) {
		if( arguments.length > 0 && show == false )
			return this.hide();
		this.visible = true;
		if( this.data )
			this.display();
	};
	
	this.hide = function() {
		this.visible = false;
		if( this.data )
			this.clear();
	};
	
	if( arguments.length > 0 )
		this.init(name, map);
}

JetLayer.prototype = new Layer();

function JetLayer(name,map) {
	
	Layer.call(this,name,map);
			
	this.update = function() {
		if( this.data.show_jets )
			return this.display();
		return this.clear();
	};
	
	this.display = function() {
		for (var i = 0; i < this.data.jets.length(); i++)
			this.data.jets.get(i).show(this.map);
	};
	
	this.clear = function() {
		for (var i = 0; i < this.data.jets.length(); i++)
			this.data.jets.get(i).show(null);
	};
}

IsoLayer.prototype = new Layer();

function IsoLayer(name,map) {
	
	Layer.call(this,name,map);
			
	this.update = function() {
		if( this.data.show_isos )
			return this.display();
		return this.clear();
	};
	
	this.display = function() {
		for (var i = 0; i < this.data.isos.length(); i++)
			this.data.isos.get(i).show(this.map);
	};
	
	this.clear = function() {
		for (var i = 0; i < this.data.isos.length(); i++)
			this.data.isos.get(i).show(null);
	};
}

CFZLayer.prototype = new Layer();

function CFZLayer(name,map) {
	
	Layer.call(this,name,map);
	
	this.init = function() {
		this.cfz_list = new Container(sort_string.bind(this,'FID_IO_DIS'));
		this.getCFZs();
	};
		
	this.getCFZs = function() {
		ajax('srv/getCFCZ/', null, (function(result) {
			for (var i = 0; i < result.length; i++)
				this.cfz_list.insert( new CFZ(result[i]) );
		}).bind(this));
	};
	
	this.update = function() {
		if( this.data.show_cfzs )
			return this.display();
		return this.clear();
	};
	
	this.display = function() {
		/* TODO: what about computed CFZs that doesn't exist anymore
		 * or CFZs that were not computed but reside in the database ??? */		
		var j = 0;
		for (var i = 0; i < this.cfz_list.length(); i++) {
			var pol = this.cfz_list.get(i);
			pol.show( null );
			while( j < this.data.cfzs.length() ) {
				var res = this.data.cfzs.get(j);
				if( res.code > pol.FID_IO_DIS )
					break;
				if( res.code == pol.FID_IO_DIS ) {
					pol.setInfoWin( new InfoWindow( res.toHtml() ) );
					pol.show( this.map, getPoiColor( res ) );
					j++;
					break;
				}
				j++;
			}
		}
	};
	
	this.clear = function() {
		for (var i = 0; i < this.cfz_list.length(); i++)
			this.cfz_list.get(i).show(null);
	};
		
	this.init();
}

TFPLayer.prototype = new Layer();

function TFPLayer(name,map) {
	
	Layer.call(this,name,map);
			
	this.init = function() {
		google.maps.event.addListener(this.map, 'zoom_changed', this.zoomed.bind(this));
	};
	
	this.update = function() {
		if( this.data.show_cfzs )
			return this.display();
		return this.clear();
	};
	
	this.display = function() {
		this.zoomed();
		for (var i = 0; i < this.data.tfps.length(); i++)
			this.data.tfps.get(i).point.show(this.map);
	};
	
	this.clear = function() {
		for (var i = 0; i < this.data.tfps.length(); i++)
			this.data.tfps.get(i).point.hide();
	};
	
	this.zoomed = function() {
		if( ! this.data )
			return;
		var scale = 5;
		if( this.map.getZoom() < 5 )
			scale -= (5 - this.map.getZoom()) * 1.5;
		for (var i = 0; i < this.data.tfps.length(); i++)
			this.data.tfps.get(i).point.setScale(scale);	
	};
	
	this.init();
}

Geometry.LatLon = function() {		
	if(arguments.length == 2) {
		this.lat = arguments[0];
		this.lon = arguments[1];
	} else {
		this.lat = arguments[0][0];
		this.lon = arguments[0][1];
	}
	return new google.maps.LatLng( this.lat, this.lon );
};

function Geometry()  {	
	this.init = function() {};
	this.init();
}

function Polygon(coords,color) {
		
	this.init = function(coords,color) {
		this.coords = [];
		this.window = null;
		if( coords ) {
			this.create(coords);
			this.apply(color);
		}
	};
		
	this.create = function(coords,color) {		
		this.coords = [];
		for( var i = 0; i < coords.length; i++ ) {
			this.coords.push([]);
			for (var j = 0; j < coords[i].length; j++) {
				var latlon = coords[i][j];
				/* TODO: agree on a consistent polygon format in MongoDB */
				if( latlon instanceof Array )
					this.coords[i].push( Geometry.LatLon(latlon[1], latlon[0]) );
				else
					this.coords[i].push( Geometry.LatLon(latlon.d, latlon.e) );
			}
		}				
	};
	
	this.apply = function(color) {
		this.poly = new google.maps.Polygon({
			paths : this.coords,
			strokeOpacity : 0.5,
			fillOpacity : 0.8
		});
		
		if( color )
			this.poly.setOptions({strokeColor: color, fillColor: color});
		
		/* register click event handler */
		google.maps.event.addListener(this.poly, 'click', (function(e) {
			if( ! this.window )
				return;
			this.window.open( this.poly.getMap(), e.latLng );
		}).bind(this));
	};
		
	this.show = function(map, color) {
		if( color )
			this.poly.setOptions({strokeColor: color, fillColor: color});
		this.poly.setMap(map);
	};
	
	this.setInfoWin = function(win) {
		this.window = win; 
	};
	
	this.init(coords,color);
}

Polyline.prototype = new Polygon();

function Polyline(coords,color) {
	
	Polygon.call(this);
	
	this.init = function(coords,color) {
		if( coords ) {
			this.create(coords);
			this.apply(color);
		}
		
		if( color )
			this.poly.setOptions({strokeColor: color});
	};
	
	this.apply = function() {
		this.poly = new google.maps.Polyline({
			path : this.coords[0],
			geodesic : true,
			strokeOpacity : 1.0,
			strokeWeight : 1,
		});
	};
	
	this.init(coords,color);
}

function Point(lat,lon) {
	
	this.init = function(lat,lon) {
		this.window = null;
		this.marker = new google.maps.Marker({
			position : Geometry.LatLon(lat,lon),
			map : null
		});
		this.defaultIcon();
		
		/* register click event handler */
		google.maps.event.addListener(this.marker, 'click', (function(e) {
			if( ! this.window )
				return;
			this.window.open( this.marker.getMap(), e.latLng );
		}).bind(this));
	};
	
	this.setIcon = function(icon) {
		this.marker.setIcon(icon);
	};
	
	this.defaultIcon = function() {
		var icon = {
			path : google.maps.SymbolPath.CIRCLE,
			fillOpacity : 0.7,
			fillColor : 'white',
			strokeOpacity : 1.0,
			strokeColor : 'white',
			strokeWeight : 1.5,
			scale : 5
		};
		this.setIcon(icon);
	};
	
	this.setColor = function(color) {
		this.marker.getIcon().fillColor = color;
	};
	
	this.setScale = function(scale) {
		var icon = this.marker.getIcon();
		icon.scale = scale;
		this.marker.setIcon(icon);
	};
	
	this.show = function(map) {
		/* avoid reloading */
		if( ! this.marker.getMap() )
			this.marker.setMap(map);
	};
	
	this.hide = function() {
		this.marker.setMap(null);
	};
	
	this.setInfoWin = function(win) {
		this.window = win; 
	};
		
	this.init(lat,lon);
}

CFZ.prototype = new Polygon();

function CFZ(meta) {
		
	Polygon.call(this);
	
	this.init = function(meta) {
		$.extend(this,meta);
		Polygon.call(this, this._COORDS_);
		delete this._COORDS_;
	};
	
	this.init(meta);
}

function CFZResult(meta) {
	
	this.init = function(meta) {
		$.extend(this,meta);
	};
	
	this.toHtml = function() {	
        var min = Math.floor(this.eta);
        var sec = Math.floor((this.eta % 1) * 60.0);
        var txt = '<b>' + this.COUNTRY + ' - ' + this.STATE_PROV + ' (' + this.code + ')</b><br>';

        if (this.eta != -1) {
        	txt += '<span>Estimated Arrival Time: ' + min + ':'	+ sec + ' minutes</span><br>';
        	txt += '<span>Estimated Wave Height: ' + this.ewh.toFixed(2) + ' meters</span><br>';
        } else {
        	txt += '<span>Not affected or not covered by computation.</span><br>';
        }
        
        return txt;
	};
		
	this.init(meta);
}

function TFP(meta) {
	this.init = function(meta) {
		$.extend(this,meta);
	};
	
	this.toHtml = function() {	
        var min = Math.floor(this.eta);
        var sec = Math.floor((this.eta % 1) * 60.0);
        var txt = '<b>' + this.country + ' - ' + this.name + ' (' + this.code + ')</b><br>';

        if (this.eta != -1) {
        	txt += '<span>Estimated Arrival Time: ' + min + ':'	+ sec + ' minutes</span><br>';
        	txt += '<span>Estimated Wave Height: ' + this.ewh.toFixed(2) + ' meters</span><br>';
        } else {
        	txt += '<span>Not affected or not covered by computation.</span><br>';
        }
        
        return txt;
	};
	
	this.init(meta);
}

function InfoWindow(html) {

	this.init = function(html) {
		this.window = new google.maps.InfoWindow();
		this.setHtml(html);
	};
	
	this.setHtml = function(html) {
		if( html )
			this.window.setContent(html);
	};
	
	this.open = function(map,latlon) {
		this.window.setPosition(latlon);
		this.window.open(map);
	};
	
	this.close = function() {
		this.window.close();
	};

	this.init(html);
}

/* real mutlithreaded ajax call */
function ajax_mt(url, data, callback) {
	var ajaxObj;
	if (arguments.length == 1) {
		ajaxObj = arguments[0];
	} else if (arguments.length == 3) {
		ajaxObj = getAjax.apply(this, arguments);
	} else {
		return;
	}
	
	delete ajaxObj.callback;
	
	var worker = new Worker('ajax_mt.js');
	worker.onmessage = function(msg) {
		console.log(msg);
		if( callback )
			callback( msg.data );
	};
	worker.postMessage(ajaxObj);
}
