var wsgi = '../aristotlesrv/';
var texts = null;
var user = null;

/* Initial place after page load. */
$(document).ready(function () {
	
	/* Initialize tooltips. */
	$(function () {
		$('[data-toggle="tooltip"]').tooltip();
	});
	
	/* Create the inventory. */
	var inv = new Inventory($('.frame'));
	
	/* Load current user name and invitation texts from server and store them in global variables. */
	var d1 = deferred_ajax(wsgi + '/whoami/', {apikey: inv.get_apikey()});
	var d2 = deferred_ajax(wsgi + '/get_texts/', {});
	$.when(d1, d2).always(function(res1, res2) {
		user = res1.person;
		texts = res2.texts;
	
		/* Show log-in form if there is no current user. */
		if( ! user ) {
			inv.div.find('.denied').show();
			new SignInForm($('.login-form'));
			return;
		}
		
		/* Otherwise, show some hidden HTML elements and initialize the inventory. */
		inv.div.find('.list, .details, .stub, .navigation, .go-to-top, .map-btn, .links .print, .links .change-pwd').show();
		inv.init();
		/* Call 'search' method if the user navigates back or forth. */
		window.onpopstate = inv.search.bind(inv);
		/* Initial search. */
		inv.search();
				
		/* Remove cookie and reload page if 'Sign out' link is clicked. */
		$('a.sign-out').click( function() {
			Cookies.remove('apikey');
			/* Remove all parameters from the URL. It is important to remove at least the API key. */
			location.href = location.href.split('?')[0];
		});
		$('.sign-out').show();
	});
});


/* Main class which is used to control the components of the system. */
function Inventory(div) {
	ICallbacks.call(this);
	this.div = div;
}
Inventory.prototype = {
	/*  */
	init: function() {
		/* Holds all items loaded from the server and sorts them alphabetically. */
		this.items = new Container( function(a,b) { return a.name.localeCompare(b.name); });
		/* Stores last time stamp at which the server was fetched for new data. */
		this.ts = 0;
		this.tid = null;
		/* Holds the current instance of type DetailView that is shown on the right side of the page. */
		this.curview = null;
		/* Initial search parameters used to load everything. */
		this.search_data = {'in': [], id: [], display: [], text: ''};
		
		/* Create a geographical map shown on top of the page. */
		this.map = new Map('map', this);
		
		/* Create modal dialogs. */
		this.save_dialog = new SaveDialog();
		this.delete_dialog = new DeleteDialog();
		this.change_pwd_dialog = new ChangePwdDialog();
		
		/* Connect navigation buttons with functionality. */
		this.div.find('.go-to-top').click(this.goto_top.bind(this));
		this.div.find('.navigation > div').click(function() {
			var target =  $(this).data('target');
			var top = $(target).offset().top;
			$('.stub').find('.static.pinned').each(function() {
				top -= $(this).outerHeight();
			});
			$('html, body').animate({scrollTop: top}, 500);
		});
		/* Search for invites once the notification bell is clicked. */
		this.div.find('.notification').click(this.update_url.bind(this,'display:invite'));
		
		/* Connect links and buttons to new DetailView instance used to create a new item. */
		this.div.find('.invite-text a').click((function() {
			this.load_details( new Invite(), true );
		}).bind(this));
		
		this.div.find('.sec-persons button.add').click((function() {
			this.load_details( new Person({}), true );
		}).bind(this));
				
		this.div.find('.sec-offices button').click((function() {
			this.load_details( new Office({}), true );
		}).bind(this));
		
		this.div.find('.sec-decisions button').click((function() {
			this.load_details( new Decision({}), true );
		}).bind(this));
		
		this.div.find('.sec-advices button').click((function() {
			this.load_details( new Advice({}), true );
		}).bind(this));
		
		/* Search field initialization. */
		this.btn_search = new HtmlTextGroup('Search').setButton('search');
		this.btn_search.getButton().click( (function() {
			this.update_url( this.btn_search.value() );
		}).bind(this));
		
		/* Show clear button if and only if the search field is not empty. */
		var toogle_clear_btn = function() {
			this.btn_search.find('.btn-clear, .invite-text')[this.btn_search.value() != '' ? 'show' : 'hide']({duration: 400});
			this.div.find('.btn-clear, .invite-text')[this.btn_search.value() != '' ? 'show' : 'hide']();
			this.update_url( this.btn_search.value() );
		};
		this.btn_search.text.div.change( toogle_clear_btn.bind(this) );
		
		/* This function is called for each key-up event on the search field. */
		/* It checks for special keys like space and enter, and starts an idle timer used to start the search on key press or after some inactivity. */
		var fun = function() {
			var tid = null;
			var fun = function(e) {
				clearTimeout(tid);
				var delay = (e.which == 13 || e.which == 32 || this.btn_search.value() == '') ? 0 : 2000;
				tid = setTimeout( (function(){ this.btn_search.text.div.change(); }).bind(this), delay);
				this.btn_search.find('.btn-clear, .invite-text')[this.btn_search.value() != '' ? 'show' : 'hide']({duration: 400});
				this.div.find('.btn-clear, .invite-text')[this.btn_search.value() != '' ? 'show' : 'hide']();
			};
			this.btn_search.find('.html-btn').append($('<div>', {
				'class': 'btn-clear', html: '&times;', click: (function() {
					clearTimeout(tid); 
					this.btn_search.value('');
				}).bind(this)
			}));
			return fun.bind(this);
		};
		this.btn_search.text.div.keyup( fun.call(this) );
		
		/* Add dynamically created search group to HTML page. */
		this.div.find('.search-box').prepend( this.btn_search.div );
		
		/* The following loop walks through all statically pinned bars at the top of the page and sets required callbacks to handle their functionality. */
		for(attr in {'search': '', 'map-tile': '', 'navigation-tile': ''}) {
			/* Pin search bar at the top of the page if requested. */
			$(window).bind('scroll', (function (attr) {
				var threshold = this.div.find('.header .banner').position().top + this.div.find('.header .banner').outerHeight();
				this.div.find('.' + attr).parent().prevAll().find('.static:not(.pinned)').each(function() {
					threshold += $(this).outerHeight();
				});
				var top = 0;
				this.div.find('.' + attr).parent().prevAll().find('.static.pinned').each(function() {
					top += $(this).outerHeight();
				});
			    if ($(window).scrollTop() > threshold) {
			    	this.div.find('.' + attr).addClass('fixed');
			    } else {
			    	this.div.find('.' + attr).removeClass('fixed');
			    }
			    this.div.find('.' + attr).css('top', this.div.find('.' + attr).is('.fixed.pinned') ? top : '');
			    /* Make pinned bar move horizontally while scrolling. */
			    var left = this.div.find('.' + attr).is('.fixed.pinned') ? -$(window).scrollLeft() : 0;
			    this.div.find('.' + attr).css({'left': left});
			    this.div.find('.' + attr).css({'width': 'calc(100% - ' + left + 'px)'});
			}).bind(this, attr));
			
			var push = this.div.find('.' + attr).find('.btn-push');
			push.click( (function(attr) {
				$(this).toggleClass('active');
				$(this).closest('.' + attr).toggleClass('pinned');
				$(this).hasClass('active') ? Cookies.set('pin-' + attr, 1) : Cookies.remove('pin-' + attr);
				$(window).scroll();
			}).bind(push, attr));
			if( Cookies.get('pin-' + attr) )
				push.click();
		}
		
		/* Print mode detection. */
		this.print_mode = false;
		
		/* Enable to auto-adapt the layout if the page is being printed. This is buggy in some browsers! */
		//window.onbeforeprint = this.change_print_mode.bind(this, true);
		//window.onafterprint = this.change_print_mode.bind(this, false);
		//if(window.matchMedia) {
		//	window.matchMedia('print').addListener((function(mql) {
		//		this.change_print_mode(mql.matches);
		//	}).bind(this));
		//}
		
		/* Toggle print mode. */
		$('a.print').click( (function() {
			this.change_print_mode();
		}).bind(this) );
		
		
		/* Open password dialog if the corresponding link is clicked. */
		$('a.change-pwd').click( (function() {
			this.change_pwd_dialog.show();
		}).bind(this) );
		
		/* Load initial DetailView which shows some introductory text. */
		this.load_details(null);
	},
	
	/* Extract parameters from URL. */
	split_url: function() {
		var parts = window.location.search.split(/[?&]/);
		var ret = {search: ''};
		var search_prefix = 'search=';
		for(var i = 0; i < parts.length; i++) {
			if( parts[i].startsWith(search_prefix) )
				ret.search = decodeURIComponent(parts[i].substr(search_prefix.length));
			else
				ret.apikey = parts[i];
		}
		return ret;
	},
		
	/* Return the API key either given as an URL parameter or provided by a cookie. */
	get_apikey: function() {
		var urlkey = this.split_url().apikey;
		if( urlkey )
			Cookies.set('apikey', urlkey);
		return Cookies.get('apikey');
	},
	
	/* Shortcut to obtain the search string. */
	get_search_string: function() {
		return this.split_url().search;
	},
	
	/* Used to update the URL if the search text changes. It also modifies the browser's history to enable for- and backward navigation.
	 * Triggers a new search. */
	update_url: function(search_text) {
		//search_text = $.trim(search_text);
		/* Do not store history if the URL has not changed. */
		if( this.split_url().search == search_text )
			return;
		var urlkey = this.split_url().apikey;
		var api_comp = urlkey ? urlkey + '&' : '';
		var search_comp = 'search=' + encodeURIComponent(search_text);
		var url = window.location.pathname.split("/").pop() + '?' + api_comp + search_comp;
		history.pushState(null, '', url);
		this.search();
	},
	
	/* Creates and shows a new instance of type DetailView depending on the type of data given. */
	load_details: function(data, edit, noscroll) {
		var view = null;
		/* If another view is still opened in 'edit' mode, show the save-dialog. */
		if( this.curview != null && this.curview.mode_edit ) {
			this.save_dialog.show(
				(function(data, edit) {
					this.curview.save();
					this.curview = null;
					this.load_details(data, edit);
				}).bind(this, data, edit),
				(function(data, edit) {
					this.curview = null;
					this.load_details(data, edit);
				}).bind(this, data, edit)
			);
			return view;
		}
		/* Create specialized instance based on data type. */
		if( data instanceof Person )
			view = new PersonDetailView(this, data);
		else if( data instanceof Office )
			view = new OfficeDetailView(this, data);
		else if( data instanceof Institute )
			view = new InstituteDetailView(this, data);
		else if( data instanceof Decision )
			view = new DecisionDetailView(this, data);
		else if( data instanceof Advice )
			view = new AdviceDetailView(this, data);
		else if( data instanceof Invite )
			view = new InviteDetailView(this, data);
		this.curview = view;
		if( view != null ) {
			view.fill(edit);
			this.div.find('.details').html( view.div );
			if( ! noscroll )
				this.goto_details();
			/* effect */
			this.div.find('.details .banner').addClass('effect');
			setTimeout( (function() { this.div.find('.details .banner').removeClass('effect'); }).bind(this), 400 );
		} else {
			/* Show introductary text if 'null' is passed as data. */
			this.div.find('.details').html(
				$('<div>', {'class': 'intro', html: 'Select an Institute, Office or Contact.'})
			);
		}
		return view;
	},
	
	/* Jump to details view. */
	goto_details: function() {
		var top = $('.details').offset().top - 40;
		this.div.find('.stub').find('.static.pinned').each(function() {
			top -= $(this).outerHeight();
		});
		/* Cross browser fix: Chrome uses 'body', Firefox 'html'! */
		$('html, body').animate({scrollTop: top}, 500);
	},
	
	/* Scroll to top. */
	goto_top: function() {
		var top = $('.headline').offset().top;
		$('html, body').animate({scrollTop: top}, 500);
	},
	
	/* Creates an instance based on 'type' field of the given item. */
	new_item: function(item) {
		if( item.type == 'person' ) {
			return new Person(item);
		} else if( item.type == 'office' ) {
			return new Office(item);
		} else if( item.type == 'institute' ) {
			return new Institute(item);
		} else if( item.type == 'decision' ) {
			return new Decision(item);
		} else if( item.type == 'advice' ) {
			return new Advice(item);
		} else if( item.type == 'invite' ) {
			return new Invite(item);
		}
		/* Should never be reached. */
		return null;
	},
	
	/* Loads data from server. */
	load_data: function() {
		if( this.tid ) {
			clearTimeout(this.tid);
			this.tid = null;
		}
		data = {
			ts: this.ts,
			apikey: this.get_apikey(),
			set_in: this.search_data['in'].join(','),
			set_id: this.search_data['id'].join(','),
			text: this.search_data.keywords
		};
		$('.refresh').show();
		/* Call search service of web server. */
		ajax(wsgi + '/search/', data, (function(res) {
			$('.refresh').hide();
			/* Try again in 5 seconds in case of an error. */
			if( res.status != 'success' ) {
				this.tid = setTimeout( this.load_data.bind(this), 5000 );
				return;
			}
			/* Walk through returned items and insert them into the global data structure. */
			var items = res.items;
			for(var i = 0; i < items.length; i++) {
				var item = this.new_item(items[i]);
				var ret = this.items.replace('_id', item);
				if( ret && this.curview != null && '_id' in this.curview.data && this.curview.data._id['$oid'] == item._id['$oid'] ) {
					if( ! this.curview.mode_edit ) {
						/* Reload details if an item is currently loaded in 'view' mode and was updated somewhere else. */
						this.load_details(item, false, true);
					} else {
						/* TODO: This page is editing an item which was updated on another site! What to do in this case? */
					}
				}
			}
			
			/* Throw all deleted entries away. */
			this.items.setList( this.items.filter( function(obj) { return ! obj.deleted; } ).list );
			
			/* Redraw the item list if something has changed. */
			if( items.length > 0 || this.ts == 0) {
				this.draw();
				/* Inform all interested components about the changes. */
				this.items.notifyOn('data_change');
			}
			
			/* Show notification bell if there are open invites. */
			$('.notification')[this.items.findItem('type', 'invite') != null ? 'show' : 'hide']();
			/* Store time stamp of last query. */
			this.ts = res.ts;
			/* Check every 5 seconds for updated data. */
			this.tid = setTimeout( this.load_data.bind(this), 5000 );
		}).bind(this));
	},
	
	/* Used to start a fresh query based on the search text. */
	search: function() {
		/* Determine search data. */
		var text = this.split_url().search;
		var regex = /(?:^|\s)((id|in|display):([^ "]+|"[^"]+"))/g;
		this.search_data = {'in': [], id: [], display: []};
		this.btn_search.value(text);
		var search_text = text;
		var matches;
		while((matches = regex.exec(text)) !== null) {
			var kind = matches[2];
			var values = matches[3].split(',');
			for(var i = 0; i < values.length; i++) {
				this.search_data[kind].push(values[i].replace(/"/g, ''));
				search_text = search_text.replace(matches[1], '');
			}
		}
		this.search_data.keywords = search_text.replace(/ +/g, ' ');
		/* Reset time stamp and clear all data. */
		this.ts = 0;
		this.items.clear();
		/* Load data. */
		this.load_data();
	},
	
	/* Clear item list and map icons. */
	clear: function() {
		this.div.find('.sec .items').empty();
		this.map.clear();
	},
	
	/* Used to draw the item list. */
	draw: function() {
		this.clear();
		/* Filter function used to show search hits only (marked with '__show') and to hide deleted entries. */
		var filtfun = function(type) {
			var f =  function(type, obj) {
				return obj.type == type && obj.__show && ! obj.deleted;
			};
			return f.bind(null, type);
		};
		/* Draw items for each category provided that their visibility was not restricted. */
		if( this.visible('institute') ) {
			var insts = this.items.filter( filtfun('institute') );
			var div = this.div.find('.sec-insts .items');
			for(var i = 0; i < insts.length(); i++)
				div.append( new InstitutePreview(this, insts.get(i)).div );
		}
		if( this.visible('office')) {
			var insts = this.items.filter( filtfun('office') );
			if( ! this.print_mode  ) {
				var div = this.div.find('.sec-offices .items');
				for(var i = 0; i < insts.length(); i++)
					div.append(	new OfficePreview(this, insts.get(i)).div );
			}
			this.map.set_offices(insts);
		}
		if( this.visible('person') && ! this.print_mode  ) {
			var insts = this.items.filter( filtfun('person') );
			var div = this.div.find('.sec-persons .items');
			for(var i = 0; i < insts.length(); i++) {
				div.append(
					new PersonPreview(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('decision') && ! this.print_mode ) {
			var insts = this.items.filter( filtfun('decision') );
			var div = this.div.find('.sec-decisions .items');
			for(var i = 0; i < insts.length(); i++) {			
				div.append(
					new DecisionPreview(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('advice') && ! this.print_mode ) {
			var insts = this.items.filter( filtfun('advice') );
			var div = this.div.find('.sec-advices .items');
			for(var i = 0; i < insts.length(); i++) {			
				div.append(
					new AdvicePreview(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('invite') && ! this.print_mode ) {
			var insts = this.items.filter( filtfun('invite') );
			var div = this.div.find('.sec-invites .items');
			for(var i = 0; i < insts.length(); i++) {			
				div.append(
					new InvitePreview(this, insts.get(i)).div
				);
			}
			this.div.find('.sec-invites')[insts.length() > 0 ? 'show' : 'hide']();
		}
				
		if( ! this.print_mode ) {
			var divs = this.div.find('.sec-offices button, .sec-decisions button, .sec-advices button').attr('disabled', true);
			/* Disable 'new' buttons if there is no possibility to create something. */
			this.auth_many(this.items.filter('type', 'institute').list, divs);
			var divs = this.div.find('.sec-persons button').attr('disabled', true);
			/* Disable 'new' button if there is no possibility to create something. */
			this.auth_many(this.items.filter('type', 'office').list, divs);
		}
	},
	
	/* Check if items with given type should be displayed. */
	visible: function(type) {
		return this.search_data.display.length == 0 || this.search_data.display.indexOf(type) >= 0;
	},
	
	/* Check if the current user has the permission to edit at least one of many IDs and enable a list of HTML elements in case it has. */
	auth_many: function(items, divs) {
		data = {
			data: JSON.stringify(items),
			perm: "edit",
			apikey: this.get_apikey()
		};
		ajax(wsgi + '/auth_many/', data, (function(divs, res) {
			if( res.status == 'success' && res.valid.length > 0 )
				divs.attr('disabled', false);
		}).bind(this, divs));
	},
	
	/* Set or toggle the print mode. */
	change_print_mode: function(res) {
		this.print_mode = arguments.length > 0 ? res : ! this.print_mode;
		var fun = this.print_mode ? 'hide' : 'show';
		$('.sec-invites, .sec-offices, .sec-persons, .sec-advices, .sec-decisions, .navigation, .notification')[fun]();
		$('a.print').html(this.print_mode ? 'Edit mode' : 'Print mode');
		this.draw();
	},
};
Inventory.prototype.constructor = Inventory;


/* This class encapsulates a Leaflet map and provides methods to interact with that map on an abstract level. */
function Map(id, inventory) {
	this.div = $('#' + id);
	this.inventory = inventory;
	this.btn = $('.map-btn');
	this.state = Cookies.get('map-state') || 'map-show';
	this.markers = new Container();
	
	this.btn.click( this.toggle.bind(this) );
	this.init();
	this.set_state();
}
Map.prototype = {
	/* Create the tile layer and scroll to a specific position. */
	init: function() {
		var layer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		});
		this.map = L.map(this.div.attr('id'), {
			scrollWheelZoom: true,
			center: [52.5163528, 13.378686420054],
			zoom: 4
		});
		this.map.addLayer(layer);
	},
	
	/* Clear all markers on the map. */
	clear: function() {
		for(var i = 0; i < this.markers.length(); i++) {
			this.map.removeLayer(this.markers.get(i));
		}
		this.markers.clear();
	},
	
	/* Controls the different map states. */
	toggle: function() {
		var next = {
			'map-show': 'map-expand',
			'map-expand': 'map-hide',
			'map-hide': 'map-show'
		};
		this.btn.removeClass(this.state);
		this.div.parents('.tile, .stub').removeClass(this.state);
		this.state = next[this.state];
		this.set_state();
	},
	
	/* Set a specific map state. */
	set_state: function() {
		this.btn.addClass(this.state);
		this.div.parents('.tile, .stub').addClass(this.state);
		Cookies.set('map-state', this.state);
	},
	
	/* Display markers on the map for a given list of offices. */
	set_offices: function(items) {
		for(var i = 0; i < items.length(); i++) {
			var office = items.get(i);
			if( ! office.lat || ! office.lon ) continue;
			var popup = $('<span class="popup-content">' +
				'<a>' + office.name +'</a>' +
				'<span class="id-search glyphicon glyphicon-search"></span>' +
				'<div>' + office.address + '</div>' +
				'<div>' + office.zip + ' ' + office.city + '</div>' + 
				'<div>' + office.country + '</div>' +
			'</span>');
			popup.find('> a').click( (function(popup, office) {
				this.inventory.load_details(office);
				popup.closest('.leaflet-popup').find('> .leaflet-popup-close-button').get(0).click();
			}).bind(this, popup, office));
			popup.find('.id-search').click( (function(popup, office) {
				this.inventory.update_url('id:' + (office.acronym || office._id['$oid']));
				popup.closest('.leaflet-popup').find('> .leaflet-popup-close-button').get(0).click();
				this.inventory.goto_top();
			}).bind(this, popup, office));
			var marker = L.marker([office.lat, office.lon]).addTo(this.map).bindPopup( popup.get(0) );			
			this.markers.insert(marker);
		}
	}
};
Map.prototype.constructor = Map;

/* Data classes. */
function Institute(data) {
	$.extend(this, data);
	this.type = 'institute';
}

function Office(data) {
	this.type = 'office';
	/* Initialize hazard types. */
	this.hazard_types = {};
	for(var i = 0; i < Office.prototype.groups.length(); i++) {
		var item = Office.prototype.groups.get(i);
		this.hazard_types[item.key] = {};
		for(var j = 0; j < item.list.length; j++) {
			this.hazard_types[item.key][item.list[j]] = null;
		}
	}
	$.extend(this, data);
}
/* Definition of predefined hazard types and their order. */
Office.prototype.groups = new Container(
     {key: 'Severe Weather', list: ['High temperatures', 'Low temperatures', 'Wind gusts land', 'Wind gusts coast', 'Wind gusts sea',
           'Mean windspeed gusts land', 'Mean windspeed gusts coast', 'Mean windspeed gusts sea', 'Visibility', 'Lightning',
           'Gusts in thunderstorms/showers', 'Hail', 'Ice', 'Heavy rain', 'Road conditions (black ice)', 'Snow(accumulation/load)',
           'Ice accretion on vessel structures', 'Orographic winds', 'Tornadoes', 'Sand storm', 'Dust storm']},
     {key: 'Flooding', list: ['Coastal flooding/storm surge', 'River flooding', 'Flash flooding']},
     {key: 'Droughts', list: ['Meteorological Drought']},
     {key: 'Forest Fires', list: ['Crown fires', 'Surface fires', 'Ground fires']},
     {key: 'Earthquakes', list: ['Earthquake (regional/local)', 'Earthquake Focal Parameters', 'Seismic Intensity', 'Shake Maps',
           'Focal Mechanism', 'Tsunami (basin wide/regional/local)']},
     {key: 'Volcanic Eruption', list: ['Tephra/Ash', 'Lava Flows', 'Lahars', 'Gas', 'Pyroclastic Flows', 'Landslides']}
);

function Person(data) {
	$.extend(this, data);
	this.type = 'person';
}

function Decision(data) {
	$.extend(this, data);
	this.type = 'decision';
}

function Advice(data) {
	$.extend(this, data);
	this.type = 'advice';
	/* Initialize a) and b) if not already set. */
	for(attr in this.items) {
		if( ! this[attr] ) {
			this[attr] = {};
			for(var i = 0; i < this.items[attr].length; i++)
				this[attr][this.items[attr][i]] = false;
		}
	}
}
/* Pre-defined check boxes and their order. */
Advice.prototype.items = {
	a: ["telephone", "video briefing", "mail", "expert on site", "customer web portal"],
	b: ["type of hazard", "intensity", "color-coded danger level", "timing", "impact", "uncertainties", "recommended actions"]
};

function Invite(data) {
	$.extend(this, data);
	this.type = 'invite';
};



/* Class Preview. Provides basic functionality for all subclasses. */
function Preview(inventory, data) {
	this.inventory = inventory;
	this.data = data;
	this.div = this.templ();
	this.div.find('.title').click( this.onTitleClick.bind(this) );
	this.div.find('.id-search').click( (function() {
		this.inventory.update_url('id:' + (this.data.acronym || this.data._id['$oid']));
		this.inventory.goto_top();
	}).bind(this));
}
Preview.prototype = {
	inventory: null,
	/* Dynamically create a new HTML preview element. */
	templ: function() {
		return (
			$('<div>', {'class': 'item'}).append(
				$('<span>', {'class': 'title'}),
				$('<span>', {'class': 'id-search glyphicon glyphicon-search'}),
				$('<div>', {'class': 'subtitle'}),
				$('<div>', {'class': 'text'}),
				$('<div>', {'class': 'content'}),
				$('<div>', {'class': 'subitems'})
			)
		);
	},
		
	onTitleClick: function() {
		/* Show item details in detail view. */
		this.inventory.load_details(this.data);
	},
	
	/* Used to print a list of text separated by bullets. Handles missing values. */
	pretty: function() {
		var strs = [];
		for(var i = 0; i < arguments.length; i++) {
			var item = Array.isArray(arguments[i]) ? arguments[i] : ['', arguments[i]];
			if( item[1] ) strs.push(item.join(''));
		}
		return strs.join(' &#183; ');
	},
	
	/* Print additional content in print mode in a consistent way. */
	print_content: function(fields) {
		for(var i = 0; i < fields.length(); i++) {
			var item = fields.get(i);
			var data = item.data || this.data;
			if( data[item.key] ) {
				var head = item.head ? $('<div class="head">' + item.head + '</div>') : null;
				var text = $('<div class="text">' + (item.text || data[item.key]) + '</div>');
				this.div.find('> .content').append(head).append(text);
			}
		}
	}
};
/* ********* */


/* Class InstitutePreview extends Preview. */
function InstitutePreview(inventory, data) {
	/* Call super constructor! */
	Preview.call(this, inventory, data);
	/* Set fields. */
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html( this.pretty(data.acronym, data.website) );
	
	/* List subitems (in print mode only). */
	if( this.inventory.print_mode ) {
		var subitems = this.inventory.items.filter('institute', this.data._id).filter('__show', true);
		var kinds = new Container(
			{type: 'office', head: 'Offices', ctor: 'OfficePreview'},
			{type: 'advice', head: 'Advices', ctor: 'AdvicePreview'},
			{type: 'decision', head: 'Processes', ctor: 'DecisionPreview' }
		);
		var div = this.div.find('> .subitems');
		for(var k = 0; k < kinds.length(); k++) {
			var sublist = subitems.filter('type', kinds.get(k).type);
			if( sublist.length() > 0 )
				div.append('<h3>' + kinds.get(k).head + '</h3>');
			for(var i = 0; i < sublist.length(); i++) {
				var ctor = window[kinds.get(k).ctor];
				div.append( new ctor(this.inventory, sublist.get(i)).div);
			}
		}
	}
	this.inventory.print_mode ? this.div.addClass('item-print') : this.div.removeClass('item-print');
}
InstitutePreview.prototype = Object.create(Preview.prototype);
InstitutePreview.prototype.constructor = InstitutePreview;
/* ********* */


/* Class OfficePreview extends Preview. */
function OfficePreview(inventory, data) {
	/* Call super constructor! */
	Preview.call(this, inventory, data);
	/* Set fields. */
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html( this.pretty(data.address, data.zip, data.city, data.country) );
	
	if( ! this.inventory.print_mode ) {
		var inst = this.inventory.items.getByOid('_id', data.institute).item;
		this.div.find('.text').html( this.pretty(inst.acronym, inst.name) );
	}
		
	/* Print contents. */
	if( this.inventory.print_mode ) {
		
		var fields = new Container(
			{key: 'lawfully_mandated', text: 'Advices/warnings are provided as <b>lawfully</b> mandated services'}
		);
		this.print_content(fields);
		
		var hazards = new Section(OfficeDetailView.prototype.hazards());
		hazards.fill(false, this.data.hazard_types);
		hazards.draw();
		if( hazards.div.text() != '' ) {
			this.div.find('> .content').append('<div class="head">For the following hazardous phenomena warnings are issued and/or advice is supplied</div>');
			this.div.find('> .content').append(hazards.div);
		}
		
		fields = new Container(
			{key: 'explanation', head: 'Additional explanation', 'class': 'wrap'}
		);
		this.print_content(fields);
		
		/* List subitems. */
		var persons = this.inventory.items.filter('office', this.data._id).filter('type', 'person').filter('__show', true);
		if( persons.length() > 0 )
			this.div.find('> .subitems').append('<h3>Contacts</h3>');
		for(var i = 0; i < persons.length(); i++)
			this.div.find('> .subitems').append(
				new PersonPreview(	this.inventory, persons.get(i) ).div
			);
	}
}
OfficePreview.prototype = Object.create(Preview.prototype);
OfficePreview.prototype.constructor = OfficePreview;
/* ********* */


/* Class PersonPreview extends Preview. */
function PersonPreview(inventory, data) {
	/* Call super constructor! */
	Preview.call(this, inventory, data);
	/* Set fields. */
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html(
		$('<div>', {html: this.pretty(data.kind, data.mail)})
	);
	this.div.find('.subtitle').append(
		$('<div>', {html: this.pretty(['Tel ', data.phone] , ['Fax ', data.fax])})
	);
	
	if( ! this.inventory.print_mode ) {
		var office = this.inventory.items.getByOid('_id', data.office).item;
		var inst = this.inventory.items.getByOid('_id', office.institute).item;
		this.div.find('.text').html( this.pretty(inst.acronym, inst.name, office.name) );
	}
	
	/* Print contents. */
	if( this.inventory.print_mode ) {
		var fields = new Container(
			{key: '247', text: 'Provides 24/7 operational service'},
			{key: 'hours', head: 'Working hours'},
			{key: 'explanation', head: 'Additional explanation'}
		);
		this.print_content(fields);
	}
}
PersonPreview.prototype = Object.create(Preview.prototype);
PersonPreview.prototype.constructor = PersonPreview;
/* ********* */


/* Class DecisionPreview extends Preview. */
function DecisionPreview(inventory, data) {
	/* Call super constructor! */
	Preview.call(this, inventory, data);
	/* Set fields. */	
	this.div.find('.title').html(data.name);
	
	if( ! this.inventory.print_mode ) {
		this.div.find('.subtitle').html(
			this.pretty(this.data.a['severity of the event'] ? 'Severity of the event' : '', this.data.a['impact of the event'] ? 'Impact of the event' : '', this.data.a['impending or imminent event'] ? 'Impending or imminent event' : '')
		);
		var inst = this.inventory.items.getByOid('_id', data.institute).item;
		this.div.find('.text').html( this.pretty(inst.acronym, inst.name) );
	}
	
	/* Print contents. */
	if( this.inventory.print_mode ) {
		this.div.find('.content').append('<div class="head">Criteria that trigger the issue of a warning</div>');
		this.div.find('.content').append('<div class="text">' +
			this.pretty(this.data.a['severity of the event'] ? 'Severity of the event' : '', this.data.a['impact of the event'] ? 'Impact of the event' : '', this.data.a['impending or imminent event'] ? 'Impending or imminent event' : '') +
			'</div>'
		);
		var fields = new Container(
			{key: 'a', head: 'Is this the case for every hazard type?', data: this.data.a.details},
			{key: 'i', head: 'Are emergency responders/civil crisis managers involved within the decision process for issuing  warnings?', data: this.data.b},
			{key: 'a', head: 'Does your institute communicate with other entities?', data: this.data.c.i },
			{key: 'a', head: 'Is there a coordinated approach to communicate multiple hazards/warnings?', data: this.data.c.ii },
			{key: 'text', head: 'Additional explanation', data: this.data.explanation }
		);
		this.print_content(fields);
	}
}
DecisionPreview.prototype = Object.create(Preview.prototype);
DecisionPreview.prototype.constructor = DecisionPreview;
/* ********* */



/* Class AdvicePreview extends Preview. */
function AdvicePreview(inventory, data) {
	/* Call super constructor! */
	Preview.call(this, inventory, data);
	/* Set fields. */		
	this.div.find('.title').html(data.name);
	
	/* Display list of channels. */
	if( ! this.inventory.print_mode ) {
		var channels = new Container().setSortFun(
			SortFuns.prototype.byArray(Advice.prototype.items.a)
		);
		for(attr in this.data.a) {
			if( this.data.a[attr] )
				channels.insert(attr);
		}
		this.div.find('.subtitle').html(
			$('<div>', {html: this.pretty.apply(this, channels.list)})
		);
		
		/* Display list of content. */
		var content = new Container().setSortFun(
			SortFuns.prototype.byArray(Advice.prototype.items.b)
		);
		for(attr in this.data.b) {
			if( this.data.b[attr] )
				content.insert(attr);
		}
		this.div.find('.subtitle').append(
			$('<div>', {html: this.pretty.apply(this, content.list)})
		);
		
		var inst = this.inventory.items.getByOid('_id', data.institute).item;
		this.div.find('.text').html( this.pretty(inst.acronym, inst.name) );
	}
	
	/* Print contents. */
	if( this.inventory.print_mode ) {
		var sel1 = new Selection( Advice.prototype.items.a, 'Communication channels');
		var sel2 = new Selection( Advice.prototype.items.b, 'Content');
		sel1.fill(false, this.data.a);
		sel1.draw();
		sel2.fill(false, this.data.b);
		sel2.draw();
	
		this.div.find('> .content').append(sel1.div).append(sel2.div);
		
		var fields = new Container(
			{key: 'i', head: 'Advice for specific hazards', data: this.data.c},
			{key: 'text', head: 'Additional explanation', 'class': 'wrap', data: this.data.explanation }
		);
		this.print_content(fields);
	}
}
AdvicePreview.prototype = Object.create(Preview.prototype);
AdvicePreview.prototype.constructor = AdvicePreview;


/* Class AdvicePreview extends Preview. */
function InvitePreview(inventory, data) {
	/* Call super constructor! */
	Preview.call(this, inventory, data);	
	/* Set fields. */		
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html(
		$('<div>', {html: this.pretty(data.to)})
	);
	this.div.find('.text').html( this.pretty(data.new_institute, data.new_office) );
}
InvitePreview.prototype = Object.create(Preview.prototype);
InvitePreview.prototype.constructor = InvitePreview;


/* Base class used to view and edit item details in an appropriate form. */
function DetailView(inventory, data) {
	this.mode_edit = false;
	this.div = this.templ();
	this.inventory = inventory;
	this.data = data;
	this.cids = [];
	this.create();
	this.auth(this.div.find('.edit'));
	this.auth(this.div.find('.delete'), 'delete');
}
DetailView.prototype = {
	/* Dynamic HTML template. */
	templ: function() {		
		return (
			$('<div>', {'class': 'inst'}).append(
				$('<div>', {'class': 'banner'}),
				$('<div>', {'class': 'content', html: '<span = class="busy"><i class="glyphicon glyphicon-repeat spin"></i></span>'}),
				$('<div>', {'class': 'footer'}).append(
					$('<div>', {'class': 'status'}),
					$('<button>', {'class': 'btn btn-default pull-left cancel', html: 'Discard'}),
					$('<button>', {'class': 'btn btn-primary pull-right edit', html: 'Edit', disabled: true}),
					$('<button>', {'class': 'btn btn-danger pull-right delete', html: 'Delete', disabled: true}),
					$('<button>', {'class': 'btn btn-primary pull-right save', html: 'Save', disabled: true})
				)
			)
		);
	},
	
	/* Initial actions at view creation. */
	create: function() {
		this.div.find('.edit').click( this.edit.bind(this) );
		this.div.find('.save').click( this.save.bind(this) );
		this.div.find('.cancel').click( this.cancel.bind(this) );
		this.div.find('.delete').click( (function() {
			this.inventory.delete_dialog.show(this.remove.bind(this));
		}).bind(this));
		this.div.find('.footer').hide();
	},
	
	/* Draw content either in view or in edit mode. Load data into form. */
	fill: function(edit) {
		var edit_buttons = this.div.find('.footer .cancel, .footer .save');
		var other_buttons = this.div.find('.footer .edit, .footer .delete');
		if( edit ) {
			edit_buttons.show();
			other_buttons.hide();
		} else {		
			edit_buttons.hide();
			other_buttons.show();
		}
		this.mode_edit = edit;
		this.sec.fill(edit, this.data);
		this.div.find('.content').html(this.sec.div);
		this.div.find('.footer').css('display', '');
	},

	/* Transfer form content back to the data object. */
	extract: function() {
		this.sec.extract(this.data);
	},
	
	/* Switch to edit mode and redraw view's content. */
	edit: function() {
		ajax(wsgi + '/lock/', {data: JSON.stringify(this.data)}, (function(res) {
			if(res.status == 'success') {
				this.inventory.goto_details();
				return this.fill(true);
			}
			/* TODO: Someone else is editing the data! What to do in this case? */
		}).bind(this));
	},
	
	/* Remove item from database. */
	remove: function() {
		ajax(wsgi + '/delete/', {data: JSON.stringify(this.data), apikey: this.inventory.get_apikey()}, (function(res) {			
			if(res.status == 'success') {
				this.data = {};
				this.inventory.load_data();
				return this.cancel();
			} else {
				this.div.find('.footer .status').html('Deletion failed: ' + res.msg);
				this.div.find('.footer .status').show();
			}
		}).bind(this));
	},
	
	/* Save item changes in the database. */
	save: function() {
		var reason = this.verify();
		if( reason ) {
			this.div.find('.footer .status').html('Save unsuccessful: ' + reason);
			this.div.find('.footer .status').show();
			return;
		} else {
			this.div.find('.footer .status').hide();
		}
		/* Copy contents to data object. */
		this.extract();
		/* Request server to store the data. */
		ajax(wsgi + '/save/', {data: JSON.stringify(this.data), apikey: this.inventory.get_apikey()}, (function(res) {			
			if(res.status == 'success') {
				/* Update id of currently loaded item to identify it as already present. */
				this.data._id = res.id;
				this.auth(this.div.find('.edit'));
				this.auth(this.div.find('.delete'), 'delete');
				this.inventory.load_data();
				this.inventory.goto_details();
				return this.fill(false);
			} else {
				this.div.find('.footer .status').html('Save unsuccessful: ' + res.reason);
				this.div.find('.footer .status').show();
			}
			//ajax(wsgi + '/unlock/', {data: JSON.stringify(this.data)});
		}).bind(this));
	},
	
	/* Can be overridden to signal an error in the provided form data. */
	verify: function() {
		return null;
	},
	
	/* Leave edit mode or deselect an item. */
	cancel: function() {
		
		this.div.find('.footer .status').hide();
		
		if( ! this.data._id ) {
			this.inventory.curview = null;
			this.inventory.load_details(null);
			this.inventory.goto_details();
			return;
		}
		
		this.fill();
		this.inventory.goto_details();
	},
	
	/* Check if the user has appropriate permission to access the item and enable HTML elements if this is the case. */
	auth: function(divs, perm) {
		data = {
			data: JSON.stringify(this.data),
			perm: perm || "edit",
			apikey: this.inventory.get_apikey()
		};
		ajax(wsgi + '/auth/', data, (function(divs, res) {			
			divs.attr('disabled', res.status != 'success');
		}).bind(this, divs));
	},
	
	/* Creates a smart dropdown box which filters its elements based on the user's permissions. */
	new_dropdown: function(label, type, edit, d) {
		if( !d ) d = $.Deferred();
		var drp = new HtmlDropDownGroup(label);
		drp.setAsValue( function(o) { return o._id; });
		drp.setToString( function(o) { return o.name; });
		drp.setSource( this.inventory.items.filter('type', type).setSortFun(this.alpha_sort.bind(this)).sort() );
		this.auth_dropdown(d, edit, drp, type);
		return drp;
	},
	
	/* Used to filter elements of a dropdown box based on the user's permissions. */
	auth_dropdown: function(d, edit, drp, key) {
		if( edit ) {
			data = {
				data: JSON.stringify(drp.source.list),
				perm: "edit",
				apikey: this.inventory.get_apikey()
			};
			deferred_ajax(wsgi + '/auth_many/', data, (function(drp, res) {				
				var selected = drp.selectedItem();
				if( res.status == 'success' ) {
					for(var i = 0; i < res.invalid.length; i++) {
						var id = res.invalid[i];
						drp.source.remove('_id', id);
					}
					if( res.invalid.length > 0 )
						drp.source.notifyOn('change');
					if( res.valid.length > 0 )
						this.div.find('.save').attr('disabled', false);
				}
				drp.selectByObj(selected);
				if( this.data[key] )
					drp.selectByOid('_id', this.data[key]);
			}).bind(this, drp), d);
		} else {			
			if( this.data[key] )
				drp.selectByOid('_id', this.data[key]);
			d.resolve();
		}
	},
	
	/* Used to sort the conjunction of institute and office name alphabetically. */
	alpha_sort: function(a, b) {
		var fun = (function(o) {
			if( ! o.institute ) return o.name;
			var inst = this.inventory.items.getByOid('_id', o.institute).item;
			return (inst.acronym ? inst.acronym : inst.name) + ' - ' + o.name;
		}).bind(this);
		if ( fun(a) < fun(b) )
			return -1;
		if ( fun(a) > fun(b) )
			return 1;
		return 0;
	},
		
	/* Clear view's content. */
	clear: function() {
		/* Do not use empty() here because it removes all event listeners from the child elements
		 * which is quite not a good idea if the children are still in use. */
		this.div.find('.content').children().detach();
	},
	
	/* Return a specific element from the main section of the view. */
	getField: function(key) {
		return this.sec.htmls.findItem('key', key).html;
	}
};


/* Class InstituteDetailView extends DetailView. */
function InstituteDetailView(inventory, data) {
	DetailView.call(this, inventory, data);
}
InstituteDetailView.prototype = Object.create(DetailView.prototype);
InstituteDetailView.prototype.constructor = InstituteDetailView;

/* Draw content of this view either in view or in edit mode. */
InstituteDetailView.prototype.fill = function(edit) {
	/* Define a mapping between item properties and HTML elements which are used to view and edit the item's data. */
	var fields = new Container(
	    {key: 'name', html: new HtmlTextGroup('Name').validate('^.+$')},
	    {key: 'acronym', html: new HtmlTextGroup('Acronym')},
	    {key: 'website', html: new HtmlTextGroup('Website')}
	);
	
	this.div.find('.banner').html('Institute');
	/* Create a dynamic section that contains all HTML elements defined above. */
	this.sec = new Section(fields);
	/* Save is always allowed after entering the edit mode. */
	this.div.find('.save').attr('disabled', false);
	
	/* Call parent method. */
	DetailView.prototype.fill.call(this, edit);
};

/* Verfiy input. Return an error mesage in case of invalid data or 'null' otherwise. */
InstituteDetailView.prototype.verify = function() {
	return this.sec.htmls.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};
/* ********* */


/* Class OfficeDetailView extends DetailView. */
function OfficeDetailView(inventory, data) {
	DetailView.call(this, inventory, data);
}
OfficeDetailView.prototype = Object.create(DetailView.prototype);
OfficeDetailView.prototype.constructor = OfficeDetailView;

/* Create a list of selections based on the pre-defined hazard types and their surrounding groups. */
OfficeDetailView.prototype.hazards = function() {
	var groups = Office.prototype.groups;
	var selections = new Container();
	for(var i = 0; i < groups.length(); i++) {
		var item = groups.get(i);
		selections.insert({
			key: item.key,
			html: new Selection(item.list, item.key)
		});
	}
	return selections;
};

/* Draw content of this view in view or edit mode. */
OfficeDetailView.prototype.fill = function(edit, span) {
	/* Create a dropdown box used to select the parent institute. */
	var drp1 = this.new_dropdown('Institute', 'institute', edit);
	/* Obtain hazard types separated in groups. */
	var selections = this.hazards();
	
	/* Define HTML elements and their corresponding item properties. */
	var fields = new Container(
		{key: 'name', html: new HtmlTextGroup('Office Name').validate('^.+$')},
		{key: 'institute', html: drp1},
		{key: 'address', html: new HtmlTextGroup('Address')},
   	    {key: 'address2', html: new HtmlTextGroup('Address 2')},
   	    {key: 'city', html: new HtmlTextGroup('City')},
   	    {key: 'zip', html: new HtmlTextGroup('ZIP Code')},
   	    {key: 'country', html: new HtmlTextGroup('Country')},
   	    {key: 'lawfully_mandated', html: new HtmlCheckBox('Advices/warnings are provided as <b>lawfully</b> mandated services').addClass('lawfully')},
   	    {key: 'hazard_types', html: new Section(selections, 'For the following hazardous phenomena please select the items for which warnings are issued and/or advice is supplied').indent(false) },
   	    {html: new HtmlCustom($('<h5>', {html: 'Additional explanation.'}))},
   	    {key: 'explanation', html: new HtmlTextArea()}
	);
	
	this.div.find('.banner').html('Office');
	/* Draw defined HTML elements. */
	this.sec = new Section(fields);
	
	/* Call parent method. */
	DetailView.prototype.fill.call(this, edit);
};

/* Verify user input. */
OfficeDetailView.prototype.verify = function() {
	return this.sec.htmls.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};
/* ********* */


/* Class PersonDetailView extends DetailView. */
function PersonDetailView(inventory, data) {
	DetailView.call(this, inventory, data);
}
PersonDetailView.prototype = Object.create(DetailView.prototype);
PersonDetailView.prototype.constructor = PersonDetailView;

PersonDetailView.prototype.fill = function(edit) {
	/* Create a new dropdown box containing all valid offices. Use object 'd1' to identify when the asynchronous method has finished loading. */
	var d1 = $.Deferred();
	var drp1 = this.new_dropdown('Office', 'office', edit, d1);	
	
	/* Execute the inner part after the dropdown box is loaded completely. */
	$.when(d1).always((function() {
		/* Adapt string representation of dropdown box. */
		drp1.setToString( (function(o) {
			/* Search institute item based on institute ID. */
			var inst = this.inventory.items.getByOid('_id', o.institute).item;
			return (inst.acronym != '' ? inst.acronym : inst.name) + ' - ' + o.name;
		}).bind(this));
		/* Redraw box. */
		drp1.display();
		
		/* Create a dropdown box that contains the pre-defined responsibilities. */
		var drp2 = new HtmlDropDownGroup('Responsibility');
		drp2.setSource(new Container(
	        'Crisis coordinator',
	        'Operational service',
	        'Civil protection authority',
	        'Other'
	    ));
		
		/* Create a text box for other responsibilities and make it invisible first. */
		var txt1 = new HtmlTextGroup('Other Resp.');
		txt1.div.hide();
		
		/* Show this text box if and only if 'Other' is choosen as responsibility. */
		drp2.setCallback('change', (function(drpbox, txt) {
			if( drpbox.value() == 'Other' )
				txt.div.css('display', '');
			else
				txt.div.hide();
		}).bind(this, drp2, txt1));
		/* Select first entry of dropdown box. */
		drp2.select(0);
		
		/* Checkbox to choose 24/7 operational service. */
		var chk = new HtmlCheckBox('24/7 operational service').addClass('operational');
		/* Show additional text field and corresponding label if and only if 24/7 service is provided. */
		chk.setCallback('change', (function(chk) {
			chk.value() ? this.getField('hours').div.hide() : this.getField('hours').div.show();
			chk.value() ? this.getField('hours_label').div.hide() : this.getField('hours_label').div.show();
		}).bind(this, chk));
		
		/* Shortcut. */
		var label = new HtmlCustom($('<h5>', {
			html: edit ? 'Please specify working hours if the institute doesn’t provide a 24/7 operational service.' : 'Working hours if not 24/7 operational service.'
		}) );
		
		/* Define view's layout. HTML elements defined above are embedded into this structure. */
		var fields = new Container(
			{html: new HtmlCustom( $('<h5>', {html: 'Provide contact details for the bodies that are responsible for issuing warnings and advice to civil protection authorities.'}) )},
			{key: 'name', html: new HtmlTextGroup('Contact Name').validate('^.+$')},
	   	    {key: 'office', html: drp1},
	   	    {key: 'mail', html: new HtmlTextGroup('E-Mail').validate('^.+$')},
	   	    {key: 'phone', html: new HtmlTextGroup('Phone')},
	   	    {key: 'fax', html: new HtmlTextGroup('Fax')},   	    
	   	    {key: 'kind1', html: drp2, nodata: true},
	   	    {key: 'kind2', html: txt1, nodata: true},
	   	    {key: '247', html: chk},
	   	    {key: 'hours_label', html: label, nodata: true},
	   	    {key: 'hours', html: new HtmlTextArea()},
	   	    {html: new HtmlCustom($('<h5>', {html: 'Additional explanation.'}))},
	   	    {key: 'explanation', html: new HtmlTextArea()}
		);
		
		/* Set banner. */
		this.div.find('.banner').html('Contact');
		/* Draw HTML elements according to the defined layout. */
		this.sec = new Section(fields);
		
		/* Call parent method. */
		DetailView.prototype.fill.call(this, edit);
		
		/* Notify all listeners about the initial checkbox value. */
		chk.notifyOn('change');
		
		/* Display responsibility. */
		if( this.data['kind'] ) {
			if( ! drp2.source.findItem(null, this.data['kind']) ) {
				drp2.selectByVal(null, 'Other');
				txt1.value( this.data['kind'] );
			} else {
				drp2.selectByVal(null, this.data['kind']);
			}
		}
	
	}).bind(this));
};

/* Override parent method to define custom save functionality required to handle special fields. */
PersonDetailView.prototype.extract = function() {
	DetailView.prototype.extract.call(this);
	
	/* Use custom text value if responsibility is set to 'Other'. */
	var kind1 = this.getField('kind1').value();
	this.data['kind'] = kind1 == 'Other' ? this.getField('kind2').value() : kind1;
	
	/* Clear additional text field if 24/7 service is provided. */
	if( this.getField('247').value() ) {
		this.getField('hours').value('');
		this.data['hours'] = '';
	}
};

/* Verify user input. Required: Contact Name, E-Mail. */
PersonDetailView.prototype.verify = function() {
	if( ! this.getField('name').valid() ) return 'Please provide a name.';
	if( ! this.getField('mail').valid() ) return 'Please provide an email address.';
	return null;
};
/* ********* */


/* Class DecisionDetailView extends DetailView. */
function DecisionDetailView(inventory, data) {
	DetailView.call(this, inventory, data);
}
DecisionDetailView.prototype = Object.create(DetailView.prototype);
DecisionDetailView.prototype.constructor = DecisionDetailView;
DecisionDetailView.prototype.fill = function(edit) {

	/* Create a dropdown box with a list of valid institutes. */
	var drp1 = this.new_dropdown('Institute', 'institute', edit);
	
	/* Shortcut. */
	var label = new HtmlCustom( $('<h5>', {
		html: edit ? 'Give a brief description of the following with regard to your decision making process.' : ''
	}));
	
	/* Define HTML fields and corresponding item properties. */
	/* This becomes a nested structure if embedded sections are used. */
	var fields = new Container(
		{html: label},
		{key: 'institute', html: drp1},
		{key: 'name', html: new HtmlTextGroup('Name of Process').validate('^.+$')},
		{key: 'a', html: new Section(
			new Container(
	    		{key: 'severity of the event', html: new HtmlCheckBox('Severity of the event')},
				{key: 'impact of the event', html: new HtmlCheckBox('Impact of the event')},
				{key: 'impending or imminent event', html: new HtmlCheckBox('Impending or imminent event')},
				{key: 'details', html: new Section(
					new Container({key: 'a', html: new HtmlTextArea('Description')}),
					'Is this the case for every hazard type? If not, please specify:'
				)}
			),
			'Please select the criteria that trigger the issue of a warning.'
		)},
		{key: 'b', html: new Section(
			new Container({key: 'i', html: new HtmlTextArea()}),
			'Are emergency responders/civil crisis managers involved within the decision process for issuing  warnings? Please describe how.'
		)},
		{key: 'c', html: new Section(
			new Container(
	    		{key: 'i', html: new Section(
	    			new Container({key: 'a', html: new HtmlTextArea()}),
	    			'Does your institute communicate with those entities? Please describe how.'
	    		)},
	    		{key: 'ii', html: new Section(
	        		new Container({key: 'a', html: new HtmlTextArea()}),
	        		'Is there a coordinated approach to communicate these multiple hazards/warnings? Please describe that approach.'
	    		)}
			),
			'Give details of what happens when events involve more than one hazard or when warnings are issued by more than one institute.'
		)},
		{key: 'explanation', html: new Section(
			new Container({key: 'text', html: new HtmlTextArea()}),
			'Additional explanation.'
		)}
	);
	
	/* Set banner. */
	this.div.find('.banner').html('Decision Making Process');
	/* Draw HTML elements. */
	this.sec = new Section(fields);
	
	/* Call parent method. */
	DetailView.prototype.fill.call(this, edit);
};

/* Verify user input. Required: Name */
DecisionDetailView.prototype.verify = function() {
	return this.getField('name').valid() ? null : 'Please provide a name.';
};
/* ********* */


/* Class AdviceDetailView extends DetailView. */
function AdviceDetailView(inventory, data) {
	DetailView.call(this, inventory, data);
}
AdviceDetailView.prototype = Object.create(DetailView.prototype);
AdviceDetailView.prototype.constructor = AdviceDetailView;
AdviceDetailView.prototype.fill = function(edit) {
	
	/* Create a dropdown box with a list of valid institutes. */
	var drp1 = this.new_dropdown('Institute', 'institute', edit);
	/* Create selection for communication channels. */
	var sel1 = new Selection( Advice.prototype.items.a, 'Communication channels');
	/* Create selection for content. */
	var sel2 = new Selection( Advice.prototype.items.b, 'Content');
	
	/* Shortcut. */
	var label = new HtmlCustom( $('<h5>', {
		html: edit ? 'Give a brief description of the following with regard to the type of information you provide.' : ''
	}) );
	
	/* Define HTML fields and corresponding item properties in anested structure. */
	var fields = new Container(
		{html: label},
		{key: 'institute', html: drp1},
		{key: 'name', type: 'text', html: new HtmlTextGroup('Name of Advice').validate('^.+$')},
		{key: 'a', html: sel1},
		{key: 'b', html: sel2},
		{key: 'c', html: new Section( new Container( {key: 'i', html: new HtmlTextArea()} ), 'Is this the case for every hazard type? If not, please describe how you provide advice for specific hazards.')},
		{key: 'explanation', html: new Section( new Container({key: 'text', html: new HtmlTextArea()}), 'Additional explanation.')}
	);
	
	/* Set banner. */
	this.div.find('.banner').html('Type of Advice');
	/* Draw HTML elements. */
	this.sec = new Section(fields);
	
	/* Call parent method. */
	DetailView.prototype.fill.call(this, edit);
};

/* Verify user input. Required: Name */
AdviceDetailView.prototype.verify = function() {
	return this.getField('name').valid() ? null : 'Please provide a name.';
};
/* ********* */



/* Class InviteDetailView extends DetailView. */
function InviteDetailView(inventory, data) {
	DetailView.call(this, inventory, data);
	/* Extra class used to specialize the layout with CSS. */
	this.div.addClass('invite');
}
InviteDetailView.prototype = Object.create(DetailView.prototype);
InviteDetailView.prototype.constructor = InviteDetailView;

/* Override parent method to add a 'Confirm' button. */
InviteDetailView.prototype.create = function() {
	DetailView.prototype.create.call(this);
	this.div.find('.footer').prepend(
		$('<button>', {'class': 'btn btn-success pull-right confirm', html: 'Confirm', click: this.confirm.bind(this)})
	);
};

/* This method gets executed if the user confirms the requested invite. */
InviteDetailView.prototype.confirm = function() {
	/* Redirect request to the web server and clear the details view. */
	ajax(wsgi + '/confirm/', {id: JSON.stringify(this.data._id), apikey: this.inventory.get_apikey()}, (function(res) {		
		if( res.status == 'success' ) {
			this.inventory.load_data();
			this.inventory.load_details(null);
			this.inventory.goto_details();
		}
	}).bind(this));
};

/* Clear details if the user clicks the 'Request' button. */
InviteDetailView.prototype.save = function() {
	if( !('_id' in this.data) && ! this.verify() ) {
		this.inventory.curview = null;
		this.inventory.load_details(null);
		this.inventory.goto_details();
	}
	DetailView.prototype.save.call(this);
};

InviteDetailView.prototype.fill = function(edit) {
	/* Create two dropdown boxes that hold an office and an institute list respectively. */
	var d1 = $.Deferred();
	var d2 = $.Deferred();
	var drp1 = this.new_dropdown('Institute', 'institute', edit, d1);
	var drp2 = this.new_dropdown('Office', 'office', edit, d2);
	/* Custom text fields used to specify a new institute and/or office. */
	var txt1 = new HtmlTextGroup('New Institute').validate('^.+$').$hide();
	var txt2 = new HtmlTextGroup('New Office').validate('^.+$').$hide();
	
	/* The inner part is executed after both dropdown boxes are completely loaded. */
	$.when( d1, d2 ).always((function() {
		/* Add a 'New' entry to the dropdown box. */
		drp1.source.replace('name', new Institute({name: 'New'}));
		drp1.source.notifyOn('change');
		
		/* Show custom text box if and only if the dummy 'New' entry was choosen.
		 * Reload office dropdown box if the institute selection changes. */
		drp1.setCallback('change', (function(drp, txt, drp_offices) {
			drp.value() ? txt.div.hide() : txt.div.css('display', '');
			drp_offices.setSource( this.inventory.items.filter('type', 'office').filter('institute', drp.value()) );
		}).bind(this, drp1, txt1, drp2));
		
		/* Add a 'New' entry to the office dropdown box. */
		drp2.setCallback('source', (function() {
			this.source.replace('name', new Office({name: 'New'}));
		}).bind(drp2));
		
		/* Show custom text box if and only if the dummy 'New' entry was choosen. */
		drp2.setCallback('change', (function(drp, txt) {		
			drp.value() ? txt.div.hide() : txt.div.css('display', '');		
		}).bind(this, drp2, txt2));
		
		/* Fill institute dropdown and corresponding custom text field. */
		var known_inst = drp1.source.findItem('name', this.data.new_institute) != null;
		drp1.selectByVal('name', known_inst ? this.data.new_institute : 'New');
		txt1.value(known_inst ? '' : this.data.new_institute);
		
		/* Fill office dropdown and corresponding custom text field. */
		var known_office = drp2.source.findItem('name', this.data.new_office) != null;
		drp2.selectByVal('name', known_office ? this.data.new_office : 'New');
		txt2.value(known_office ? '' : this.data.new_office);
	
		/* Create radio buttons used to switch bertween pre-defined text fragments. */
		var btn_meteo = $('<label class="btn btn-default active"><input type="radio">Meteo</label>');
		var btn_geo = $('<label class="btn btn-default"><input type="radio">Geo</label>');
		var btn_custom = $('<label class="btn btn-default"><input type="radio">Custom</label>');
		var custom = new HtmlCustom( $('<div class="btn-group" data-toggle="buttons"></div>') );
		custom.append(btn_meteo).append(btn_geo).append(btn_custom);
		custom.div.css('display', edit ? '' : 'none');
		
		/* Create text area and set up automatic resizing. */
		var text_area = new HtmlTextArea();
		var area_resize = function() {
			/* Cross-browser! */
			var pos1 = $('body').scrollTop();
			var pos2 = $('html').scrollTop();
			$(this).innerHeight(0);
			$(this).innerHeight( $(this).prop('scrollHeight') );
			$('body').scrollTop(pos1);
			$('html').scrollTop(pos2);
		};
		/* Resize text area and select the 'Custom' button as soon as the input text changes. */
		text_area.$find('textarea').bind('input onpropertychange', area_resize);
		text_area.$find('textarea').bind('input onpropertychange', (function(btn) { btn.click(); }).bind(this, btn_custom));
		
		/* Load text if a radio button was pressed. */
		var load_text = (function(txt, group) {
			if( group ) txt.value(texts[group]);
			/* In order to do the initial resizing of the textarea, the engine needs to render the html elements on the screen first. */
			setTimeout( area_resize.bind(text_area.$find('textarea')), 0 );
		}).bind(this, text_area);
		btn_meteo.click( load_text.bind(this, 'meteo') );
		btn_geo.click( load_text.bind(this, 'geo') );
		btn_custom.click( load_text.bind(this) );
		
		/* Pre-fill the 'From' address with the user's email address. */
		this.data.from = this.data.from || user.mail;
		
		/* Define HTML fields. */
		var fields = new Container(
			{key: 'institute', html: drp1, nodata: true},
			{key: 'institute-new', html: txt1, nodata: true},
			{key: 'office', html: drp2, nodata: true},
			{key: 'office-new', html: txt2, nodata: true},
		    {key: 'name', html: new HtmlTextGroup('Contact Name').validate('^.+$')},
		    {key: 'to', html: new HtmlTextGroup('Mail/To').validate('^.+$')},
		    {key: 'from', html: new HtmlTextGroup('From').validate('^.+$')},
		    {key: 'cc', html: new HtmlTextGroup('CC').validate('^.+$')},
		    {key: 'version', html: custom},
		    {key: 'text', html: text_area},
		    {html: new HtmlCustom($('<div class="invite-url-info">Use <b>%s</b> to define the position of the URL which can be used by the invited recipient to open this website.</div>'))}
		);
		
		/* Switch between 'Request' and 'Confirm' mode according to the '_id' field which is not set if an invite is requested. */
		if( !('_id' in this.data) ) {
			/* Request invite. */
			this.div.find('.btn.save').html('Request Invite').css('width', '120px');
		}
		this.div.find('.btn.confirm')[ !('_id' in this.data) || edit ? 'hide' : 'show' ]();
		
		/* Set banner. */
		this.div.find('.banner').html('Invite');
		/* Draw HTML elements. */
		this.sec = new Section(fields);
		
		/* Call parent method. */
		DetailView.prototype.fill.call(this, edit);
		
		/* Load mail text from data. */
		if( !('_id' in this.data) ) {
			/* Load meteo text for new entries. */
			btn_meteo.click();
		} else {
			/* Assume custom otherwise. */
			btn_custom.click();
		}
		
		/* Deactivate HTML text field 'Form'. */
		this.getField('from').readonly();
	
	}).bind(this));
};

/* Verify user input. Required: Office Name, Institute Name, Mail addresses */
InviteDetailView.prototype.verify = function() {	
	var required = {'name': 'a name', 'to': 'a mail address (to)', 'from': 'a mail address (from)'};
	if( ! this.getField('institute').value() )
		required['institute-new'] = 'an institute name';
	if( ! this.getField('office').value() )
		required['office-new'] = 'an office name';
	for(var attr in required) {
		if( ! this.getField(attr).valid() )
			return 'Please provide ' + required[attr] + '.';
	}
};

/* In case of a request, store office and institute as temporary attributes 'new_office' and 'new_institute' respectively. */
InviteDetailView.prototype.extract = function() {
	DetailView.prototype.extract.call(this);
	this.data.new_institute = this.getField('institute').value() ?  this.getField('institute').selectedItem().name : this.getField('institute-new').value();
	this.data.new_office = this.getField('office').value() ?  this.getField('office').selectedItem().name : this.getField('office-new').value();	
};
/* ********* */


/* This class provides functionality to draw a list of HTML elements, fill them with initial content and extract customized content back to the data object. */
function Section(htmls, title) {
	this.div = $('<div>', {'class': 'section'}).append(
		$('<h5>', {html: arguments.length > 1 ? title : ''}),
		$('<div>', {'class': 'block'})
	);
	this.htmls = htmls;
}
Section.prototype = {
	/* Recursively walk through a list of HTML elements to fill them according to the corresponding properties. */
	fill: function(edit, data) {
		for(var i = 0; i < this.htmls.length(); i++) {
			var item = this.htmls.get(i);
			if( item.html instanceof HtmlCustom )
				continue;
			/* Set value of HTML element to the value of the corresponding item property (unless 'nodata' is specified). */
			if( item.html instanceof HtmlElement ) {
				if( ! item.nodata )
					item.html.value( data[item.key] );
				/* Set readonly attribute according to the current view mode. */
				item.html.readonly(!edit);
			} else {
				/* Recursive call for objects of class Section and Selection. */
				if( ! (item.key in data) ) data[item.key] = {};
				item.html.fill(edit, data[item.key]);
			}
		}
		/* Draw the elements. */
		this.draw();
	},
	
	/* Draw all HTML elements by recursively traversing the nested list structure. */
	draw: function() {
		var blk = this.div.find('> div');
		blk.children().detach();
		for(var i = 0; i < this.htmls.length(); i++) {
			var item = this.htmls.get(i);
			if( ! (item.html instanceof HtmlElement) )
				item.html.draw();
			blk.append(item.html.div);
		}
	},
	
	/* Extract values of HTML elements and store them in the corresponding item properties. */
	extract: function(data) {
		for(var i = 0; i < this.htmls.length(); i++) {
			var item = this.htmls.get(i);
			if( item.html instanceof HtmlCustom || item.nodata )
				continue;
			if( item.html instanceof HtmlElement ) {
				data[item.key] = item.html.value();
			} else
				/* Recursive call for objects of class Section and Selection. */
				item.html.extract(data[item.key]);
		}
	},
	
	/* Used to indent or unindent a section. */
	indent: function(yes) {
		var blk = this.div.find('> div');
		yes ? blk.addClass('block') : blk.removeClass('block');
		return this;
	}
};


/* This class is used to display selected values consistently in view and edit mode.
 * Input: A Container that includes items of the form {key: String, value: Boolean} */
function Selection(sortarr, title) {
	this.div = $('<div>', {'class': 'section'});
	this.sortarr = sortarr;
	this.title = arguments.length > 1 ? title : '';
}
Selection.prototype = {
	fill: function(edit, data) {
		this.htmls = new Container().setSortFun(SortFuns.prototype.byArray(this.sortarr, 'key'));
		for(var attr in data) {
			var html = null;
			/* Display selection either as pure text (view mode) or as checkboxes (edit mode). */
			if(edit) {
				if( this.sortarr.indexOf(attr) >= 0 || data[attr] )
					html = new HtmlCheckBox(attr, data[attr]);
			} else if( data[attr] ) {
				/* In view mode, values are separated by dots. */
				html = new HtmlCustom($('<span>')).append(
					$('<span>', {'class': 'text', html: attr}),
					$('<span>', {'class': 'dot', html: '&bull;'})
				);
			}
			if( html )
				this.htmls.insert( {key: attr, html: html} );
		}
		this.other = new HtmlCustom();
		var last = this.htmls.last();
		if(edit) {
			/* Add button 'Other' (only in edit mode) that is used to add custom values to the pre-defined list. */
			this.other = new HtmlTextGroup('Other:').setButton('plus').validate('^.+$');
			this.other.getButton().click( (function(html, data) {
				/* Ignore invalid values. */
				if( ! html.valid() ) return;
				/* Create a new checked checkbox. */
				var chk = new HtmlCheckBox(html.value(), true);
				/* Remove the value again if the box gets unchecked. */
				chk.setCallback('change', (function(chk, data) {					
					data.remove('key', chk.label());
					this.draw();
				}).bind(this, chk, data));
				/* Add new checkbox only if the value does not already exist. */
				var item = data.findItem('key', html.value());
				if( item ) {
					item.html.value(true);
				} else {
					data.insert({key: html.value(), html: chk});
				}
				/* Clear text field. */
				html.value('');
				/* Redraw the selection. */
				this.draw();
			}).bind(this, this.other, this.htmls));
		} else if(last) {
			/* Remove last dot. */
			last.html.find('.dot').detach();
		}
	},
	
	/* Draw the HTML elements previously created in the 'fill' method. */
	draw: function() {
		var blk = $('<div>');
		for(var i = 0; i < this.htmls.length(); i++) {
			var item = this.htmls.get(i);
			blk.append(item.html.div);
		}
		blk.append(this.other.div);
		this.div.children().detach();
		if( this.htmls.length() > 0 )
			this.div.append($('<h5>', {html: this.title}), blk);
	},

	/* Used to extract the values of the selection and store them in the data object. */
	extract: function(data) {
		for(var i = 0; i < this.htmls.length(); i++) {
			var item = this.htmls.get(i);
			if( this.sortarr.indexOf(item.key) >= 0 || item.html.value() )
				data[item.key] = item.html.value();
			else
				delete data[item.key];
		}		
	}
};
/* ********* */


/* Class that encapsulates the sign in functionality. */
function SignInForm(div) {
	this.div = div;
	/* Set click callbacks. */
	this.div.find('.btn-next').click( this.next.bind(this) );
	/* Accept enter key on mail field. */
	this.div.find('.inp-mail').keypress( (function(e) {
		if(e.which == 13) this.next();
	}).bind(this));
	this.div.find('.btn-sign-in').click( this.sign_in.bind(this) );
	/* Accept enter key on password field.. */
	this.div.find('.inp-pwd').keypress( (function(e) {
		if(e.which == 13) this.sign_in();
	}).bind(this));
	this.div.find('.lnk-back').click( this.back.bind(this) );
	this.div.find('.lnk-reset-pwd').click( this.reset_pwd.bind(this) );
	this.div.find('.inp-mail, .btn-next').show();
}
SignInForm.prototype = {
	/* Called after email was provided. */
	next: function() {
		/* Call the 'login' method of the web server without providing a password.
		 * In this way, the existence of the mail address can be checked. */
		var d = deferred_ajax(wsgi + '/login/', {mail: this.div.find('.inp-mail').val()});
		$.when(d).always( (function(res) {
			if( res.status == 'success' ) {
				this.div.find('.btn-next, .inp-mail, .mail-help').hide();
				this.div.find('.btn-sign-in, .lnk-back, .lnk-reset-pwd, .inp-pwd').show();
				this.div.find('.status').html('');
				this.div.find('.inp-pwd').focus();
			} else {
				this.div.find('.status').html('Unknown email address.');
			}
		}).bind(this));
	},
	
	/* Called after back link was clicked. */
	back: function() {
		/* Toggle visibility of some DOM elements. Reset status. */
		this.div.find('.status, .success').html('');
		this.div.find('.btn-sign-in, .lnk-back, .lnk-reset-pwd, .inp-pwd').hide();
		this.div.find('.btn-next, .inp-mail, .mail-help').show();
	},
	
	/* Called if sign-in is requested. */
	sign_in: function() {
		/* Call 'login' method of the web server with given email and password.
		 * The server will sent a cookie and return 'success' if the credentials are valid. */
		var d = deferred_ajax(wsgi + '/login/', {mail: this.div.find('.inp-mail').val(), password: this.div.find('.inp-pwd').val()});
		$.when(d).always( (function(res) {
			if( res.status == 'success' ) {
				this.div.find('.status').html('');
				location.reload();
			} else {
				this.div.find('.status').html('Sign in failed.');
			}
		}).bind(this));
	},
	
	/* Called after 'Reset password' link was clicked. */
	reset_pwd: function() {
		/* Call corresponding method of the web server.
		 * The generated password is sent to the user's mail address. */
		var d = deferred_ajax(wsgi + '/reset_pwd/', {mail: this.div.find('.inp-mail').val()});
		$.when(d).always( (function(res) {
			if( res.status == 'success' ) {
				this.div.find('.status').html('');
				this.div.find('input, button, a').hide();
				this.div.find('.success').html(
					'Password successfully reset. Check your mail account ' + this.div.find('.inp-mail').val() + '.'
				);
				this.div.find('.lnk-back').show();
			} else {
				this.div.find('.status').html('Failed to reset your password.');
			}
		}).bind(this));
	}
};
SignInForm.prototype.constructor = SignInForm;


/* Controls the save dialog. */
function SaveDialog() {
	this.div = $('.modal-save');
	this.dialog = this.div.modal('hide');
	this.handlers = {};
	
	/* Set click callbacks. */
	this.div.find('.btn-save').click( (function() {
		if( this.handlers.on_save )
			this.handlers.on_save();
	}).bind(this));
	
	this.div.find('.btn-discard').click( (function() {
		if( this.handlers.on_discard )
			this.handlers.on_discard();
	}).bind(this));
	
	this.div.find('.btn-cancel').click( (function() {
		if( this.handlers.on_cancel )
			this.handlers.on_cancel();
	}).bind(this));
}
SaveDialog.prototype = {
	/* Pass callbacks which are executed based on the user's choice. */
	show: function(on_save, on_discard, on_cancel) {
		this.handlers.on_save = on_save;
		this.handlers.on_discard = on_discard;
		this.handlers.on_cancel = on_cancel;
		this.div.modal('show');
	},
	
	hide: function() {
		this.div.modal('hide');
	}
};


/* Controls the delete dialog. */
function DeleteDialog() {
	this.div = $('.modal-delete');
	this.dialog = this.div.modal('hide');
	this.handlers = {};
	
	this.div.find('.btn-confirm').click( (function() {
		if( this.handlers.on_save )
			this.handlers.on_save();
	}).bind(this));
		
	this.div.find('.btn-cancel').click( (function() {
		if( this.handlers.on_cancel )
			this.handlers.on_cancel();
	}).bind(this));
}
DeleteDialog.prototype = {
	/* Pass callbacks which are executed based on the user's choice. */
	show: function(on_save, on_cancel) {
		this.handlers.on_save = on_save;
		this.handlers.on_cancel = on_cancel;
		this.div.modal('show');
	},
	
	hide: function() {
		this.div.modal('hide');
	}
};


/* Controls the password dialog. */
function ChangePwdDialog() {
	this.div = $('.modal-change-pwd');
	this.dialog = this.div.modal('hide');
	this.handlers = {};
	
	this.div.find('.btn-change-pwd').click( (function() {
		this.save();
		if( this.handlers.on_save )
			this.handlers.on_save();
	}).bind(this));
}
ChangePwdDialog.prototype = {
	show: function(on_save) {
		this.handlers.on_save = on_save;
		this.div.modal('show');
	},
	
	hide: function() {
		this.div.modal('hide');
	},
	
	save: function() {
		/* Client-side checks. */
		var cur_pwd = this.div.find('.inp-cur-pwd').val();
		var new_pwd_1 = this.div.find('.inp-new-pwd').val();
		var new_pwd_2 = this.div.find('.inp-new-pwd-confirm').val();
		if( new_pwd_1 != new_pwd_2 ) {
			this.div.find('.status').html('Mismatch in new password.');
			return false;
		}
		/* Call server method to request a password change. */
		var d = deferred_ajax(wsgi + '/change_pwd/', {mail: user.mail, curpwd: cur_pwd, newpwd: new_pwd_1});
		$.when(d).always( (function(res) {
			if( res.status == 'success' ) {
				this.div.find('.status').html('');
				this.hide();
			} else {
				this.div.find('.status').html('Failed to change your password.');
			}
		}).bind(this));
	}
};


/* Static helper class that provides specialized search functions. */
function SortFuns() {}
SortFuns.prototype = {
	byArray: function(arr, attr) {
		return this.byArray_fun.bind(this, arr, attr);
	},
	
	/* Function that can be used to sort an array based on another array that defines the order. */
	byArray_fun: function(arr, attr, a, b) {		
		var val_a = attr ? a[attr] : a;
		var val_b = attr ? b[attr] : b;
		var idx_a = arr.indexOf(val_a);
		var idx_b = arr.indexOf(val_b);
		if( idx_a < idx_b && idx_a != -1 ) return -1;
		if( idx_a > idx_b && idx_b != -1 ) return 1;
		if( idx_a == -1 && idx_b != -1 ) return 1;
		if( idx_b == -1 && idx_a != -1 ) return -1;
		return 0;
	}
};
