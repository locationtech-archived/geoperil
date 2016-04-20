var wsgi = '../aristotel/';
var texts = null;
var user = null;

$(document).ready(function () {
	
	/* Initialize tooltips. */
	$(function () {
		$('[data-toggle="tooltip"]').tooltip();
	});
	
	var inv = new Inventory($('.frame'));
	
	var d1 = $.Deferred();
	var d2 = $.Deferred();
	deferred_ajax(d1, wsgi + '/whoami/', {apikey: inv.get_apikey()});
	deferred_ajax(d2, wsgi + '/get_texts/', {});
	$.when(d1, d2).always(function(res1, res2) {
		user = res1.person;
		texts = res2.texts;
	
		if( ! user ) {
			inv.div.find('.denied').show();
			return;
		}
		
		inv.div.find('.list, .details').show();
		window.onpopstate = inv.search.bind(inv);
		inv.search();
		
		$('.custom-popover').hide();
		$('.custom-popover .popover-title span').click( function() {
			$(this).closest('.custom-popover').hide(500);
		});
	});
	
//	setTimeout( function() {
//		$('.snapin').show(800);
//	}, 500 );

	$('.snapin .x').click( function() { $('.snapin').hide(500);} );
	
//	setTimeout( function() {
//		$('.sec-insts .custom-popover').show(800);
//	}, 1500 );
//	
//	setTimeout( function() {
//		$('.sec-offices .custom-popover').show(800);
//	}, 3000 );
//	
//	setTimeout( function() {
//		$('.sec-persons .custom-popover').show(800);
//	}, 4500 );
//	
//	setTimeout( function() {
//		$('.sec-decisions .custom-popover').show(800);
//	}, 6000 );
//	
//	setTimeout( function() {
//		$('.sec-advices .custom-popover').show(800);
//	}, 7500 );
});



function Inventory(div) {
	
	ICallbacks.call(this);
	
	this.div = div;
	this.items = new Container( function(a,b) { return a.name.localeCompare(b.name); });
	this.ts = 0;
	this.tid = null;
	this.curview = null;
	this.search_data = {'in': [], id: [], display: [], text: ''};
	
	this.map = new Map('map', this);
	
	this.save_dialog = new SaveDialog();
	this.delete_dialog = new DeleteDialog();
	
	this.div.find('.go-to-top').click(this.goto_top.bind(this));
	this.div.find('.navigation > div').click(function() {
		var target =  $(this).data('target');
		var top = $(target).offset().top;
		$('.stub').find('.static.pinned').each(function() {
			top -= $(this).outerHeight();
		});
		$('html, body').animate({scrollTop: top}, 500);
	});
	this.div.find('.notification').click(this.update_url.bind(this,'display:invite'));
	
	this.div.find('.invite-text a').click((function() {
		this.load_details(
			new Invite(), true
		);
	}).bind(this));
	
	this.div.find('.sec-persons button.add').click((function() {
		this.load_details(
			new Person(), true
		);
	}).bind(this));
	
	this.div.find('.sec-offices button').click((function() {
		ajax(wsgi + '/new/', {role: 'office'}, (function(res) {
			this.load_details(
				new Office(res.obj), true
			);
		}).bind(this));
	}).bind(this));
	
	this.div.find('.sec-decisions button').click((function() {
		this.load_details(
			new Decision({}), true
		);
	}).bind(this));
	
	this.div.find('.sec-advices button').click((function() {
		this.load_details(
			new Advice({}), true
		);
	}).bind(this));
	
	/* Search field - TODO: should this go into a separate class? */
	this.btn_search = new HtmlTextGroup('Search').setButton('search');
	this.btn_search.getButton().click( (function() {
		this.update_url( this.btn_search.value() );
	}).bind(this));
	var toogle_clear_btn = function() {
		this.btn_search.find('.btn-clear, .invite-text')[this.btn_search.value() != '' ? 'show' : 'hide']({duration: 400});
		this.div.find('.btn-clear, .invite-text')[this.btn_search.value() != '' ? 'show' : 'hide']();
		this.update_url( this.btn_search.value() );
	};
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
	this.btn_search.text.div.change( toogle_clear_btn.bind(this) );
	this.btn_search.text.div.keyup( fun.call(this) );
	this.div.find('.search-box').prepend( this.btn_search.div );
		
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
//	window.onbeforeprint = this.change_print_mode.bind(this, true);
//	window.onafterprint = this.change_print_mode.bind(this, false);
//	if(window.matchMedia) {
//		window.matchMedia('print').addListener((function(mql) {
//			this.change_print_mode(mql.matches);
//		}).bind(this));
//	}
	
	/* Toogle print mode. */
	$('a.print').click( (function() {
		this.change_print_mode();
	}).bind(this) );
	
	this.load_details(null);
}
Inventory.prototype = {
	split_url: function() {
		var parts = window.location.search.split(/[?&]/);
		var ret = {
			apikey: parts.length >= 2 ? parts[1] : null,
			search: parts.length >= 3 ? decodeURIComponent(parts[2]) : ''
		};
		return ret;
	},
		
	get_apikey: function() {
		return this.split_url().apikey;
	},
	
	get_search_string: function() {
		return this.split_url().search;
	},
	
	update_url: function(search_text) {
		//search_text = $.trim(search_text);
		/* Do not store history if the URL has not change. */
		if( this.split_url().search == search_text )
			return;
		var url = window.location.pathname.split("/").pop() + '?' + this.get_apikey() + '&' + encodeURIComponent(search_text);
		history.pushState(null, '', url);
		this.search();
	},
	
	load_details: function(data, edit, noscroll) {
		var view = null;
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
		if( data instanceof Person )
			view = new PersonDetailView(this, data);
		else if( data instanceof Office )
			view = new OfficeDetailView(this, data);
		else if( data instanceof Institute )
			view = new InstDetailView(this, data);
		else if( data instanceof Decision )
			view = new ProcessDetailView(this, data);
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
			this.div.find('.details').html(
				$('<div>', {'class': 'intro', html: 'Select an Institute, Office or Contact.'})
			);
		}
		return view;
	},
	
	goto_details: function() {
		/* Jump to details view. */
		var top = $('.details').offset().top - 40;
		this.div.find('.stub').find('.static.pinned').each(function() {
			top -= $(this).outerHeight();
		});
		/* Cross browser fix: Chrome uses 'body', Firefox 'html'! */
		$('html, body').animate({scrollTop: top}, 500);
	},
	
	goto_top: function() {
		var top = $('.tabs1').offset().top;
		$('html, body').animate({scrollTop: top}, 500);
	},
	
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
		ajax(wsgi + '/search/', data, (function(res) {
			$('.refresh').hide();
			if( res.status != 'success' ) {
				this.tid = setTimeout( this.load_data.bind(this), 5000 );
				return;
			}
			var items = res.items;
			for(var i = 0; i < items.length; i++) {
				var item = this.new_item(items[i]);
				var ret = this.items.replace('_id', item);
				if(ret) console.log(item);
				/* TODO: better handle this over a callback */
				if( ret && this.curview != null && '_id' in this.curview.data && this.curview.data._id['$oid'] == item._id['$oid'] ) {
					if( ! this.curview.mode_edit ) {
						console.log('load currently displayed item');
						this.load_details(item, false, true);
					} else {
						/* TODO: This page is editing an item which was updated on another site! What to do in this case? */
					}
				}
			}
			/* Throw all deleted entries away. */
			/* TODO: find a better way to filter inplace */
			this.items.setList( this.items.filter( function(obj) { return ! obj.deleted; } ).list );
			if( items.length > 0 || this.ts == 0) {
				this.draw();
				/* Inform all interested components about the changes. */
				this.items.notifyOn('data_change');
			}
			/* Show notification bell if there are open invites. */
			$('.notification')[this.items.findItem('type', 'invite') != null ? 'show' : 'hide']();
			this.ts = res.ts;
			this.tid = setTimeout( this.load_data.bind(this), 5000 );
		}).bind(this));
	},
	
	search: function(text) {
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
	
	clear: function() {
		this.div.find('.sec .items').empty();
		this.map.clear();
	},
	
	draw: function() {
		console.log('start drawing');
		var t0 = performance.now();
		this.clear();
		var filtfun = function(type) {
			var f =  function(type, obj) {
				return obj.type == type && obj.__show && ! obj.deleted;
			};
			return f.bind(null, type);
		};
		if( this.visible('institute') ) {
			var insts = this.items.filter( filtfun('institute') );
			var div = this.div.find('.sec-insts .items');
			for(var i = 0; i < insts.length(); i++)
				div.append( new InstItem(this, insts.get(i)).div );
		}
		if( this.visible('office')) {
			var insts = this.items.filter( filtfun('office') );
			if( ! this.print_mode  ) {
				var div = this.div.find('.sec-offices .items');
				for(var i = 0; i < insts.length(); i++)
					div.append(	new OfficeItem(this, insts.get(i)).div );
			}
			this.map.set_offices(insts);
		}
		if( this.visible('person') && ! this.print_mode  ) {
			var insts = this.items.filter( filtfun('person') );
			var div = this.div.find('.sec-persons .items');
			for(var i = 0; i < insts.length(); i++) {
				div.append(
					new PersonItem(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('decision') && ! this.print_mode ) {
			var insts = this.items.filter( filtfun('decision') );
			var div = this.div.find('.sec-decisions .items');
			for(var i = 0; i < insts.length(); i++) {			
				div.append(
					new DecisionItem(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('advice') && ! this.print_mode ) {
			var insts = this.items.filter( filtfun('advice') );
			var div = this.div.find('.sec-advices .items');
			for(var i = 0; i < insts.length(); i++) {			
				div.append(
					new AdviceItem(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('invite') && ! this.print_mode ) {
			var insts = this.items.filter( filtfun('invite') );
			var div = this.div.find('.sec-invites .items');
			for(var i = 0; i < insts.length(); i++) {			
				div.append(
					new InviteItem(this, insts.get(i)).div
				);
			}
			this.div.find('.sec-invites')[insts.length() > 0 ? 'show' : 'hide']();
		}
		
		if( ! this.print_mode ) {
			var divs = this.div.find('.sec-offices button, .sec-decisions button, .sec-advices button').attr('disabled', true);
			/* Disable 'new' button if there is no possibility to create something. */
			this.auth_many(this.items.filter('type', 'institute').list, divs);
			var divs = this.div.find('.sec-persons button').attr('disabled', true);
			/* Disable 'new' button if there is no possibility to create something. */
			this.auth_many(this.items.filter('type', 'office').list, divs);
		}
		
		var t1 = performance.now();
		console.log("Call to draw() took " + (t1 - t0) + " milliseconds.");
	},
	
	visible: function(type) {
		return this.search_data.display.length == 0 || this.search_data.display.indexOf(type) >= 0;
	},
		
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
		this.draw();
	},
};
Inventory.prototype.constructor = Inventory;



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
	
	clear: function() {
		for(var i = 0; i < this.markers.length(); i++) {
			this.map.removeLayer(this.markers.get(i));
		}
		this.markers.clear();
	},
		
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
	
	set_state: function() {
		this.btn.addClass(this.state);
		this.div.parents('.tile, .stub').addClass(this.state);
		Cookies.set('map-state', this.state);
	},
	
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



function Person(data) {
	$.extend(this, data);
	this.type = 'person';
}

function Office(data) {
	$.extend(this, data);
	this.type = 'office';
}

function Institute(data) {
	$.extend(this, data);
	this.type = 'institute';
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
Advice.prototype.items = {
	a: ["telephone", "video briefing", "mail", "expert on site", "customer web portal"],
	b: ["type of hazard", "intensity", "color-coded danger level", "timing", "impact", "uncertainties", "recommended actions"]
};

function Invite(data) {
	$.extend(this, data);
	this.type = 'invite';
};


/* Class Item. */
function Item(inventory, data) {
	this.inventory = inventory;
	this.data = data;
	this.div = this.templ();
	this.div.find('.title').click( this.onTitleClick.bind(this) );
	this.div.find('.id-search').click( (function() {
		this.inventory.update_url('id:' + (this.data.acronym || this.data._id['$oid']));
		this.inventory.goto_top();
	}).bind(this));
}
Item.prototype = {
	inventory: null,	
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
	
	pretty: function() {
		var strs = [];
		for(var i = 0; i < arguments.length; i++) {
			var item = Array.isArray(arguments[i]) ? arguments[i] : ['', arguments[i]];
			if( item[1] ) strs.push(item.join(''));
		}
		return strs.join(' &#183; ');
	},
	
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


/* Class InstItem extends Item. */
function InstItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory, data);
	/* Set fields. */
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html( this.pretty(data.acronym, data.website) );
	
	/* List subitems. */
	if( this.inventory.print_mode ) {
		var subitems = this.inventory.items.filter('institute', this.data._id).filter('__show', true);
		var kinds = new Container(
			{type: 'office', head: 'Offices', ctor: 'OfficeItem'},
			{type: 'advice', head: 'Advices', ctor: 'AdviceItem'},
			{type: 'decision', head: 'Processes', ctor: 'DecisionItem' }
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
InstItem.prototype = Object.create(Item.prototype);
InstItem.prototype.constructor = InstItem;
/* ********* */



/* Class OfficeItem extends Item. */
function OfficeItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory, data);
	/* Set fields. */
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html( this.pretty(data.address, data.zip, data.city, data.country) );
	
	var inst = this.inventory.items.getByOid('_id', data.institute).item;
	this.div.find('.text').html( this.pretty(inst.acronym, inst.name) );
		
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
				new PersonItem(	this.inventory, persons.get(i) ).div
			);
	}
}
OfficeItem.prototype = Object.create(Item.prototype);
OfficeItem.prototype.constructor = OfficeItem;
/* ********* */



/* Class PersonItem extends Item. */
function PersonItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory, data);
	/* Set fields. */
	var office = this.inventory.items.getByOid('_id', data.office).item;
	var inst = this.inventory.items.getByOid('_id', office.institute).item;
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html(
		$('<div>', {html: this.pretty(data.kind, data.mail)})
	);
	this.div.find('.subtitle').append(
		$('<div>', {html: this.pretty(['Tel ', data.phone] , ['Fax ', data.fax])})
	);
	this.div.find('.text').html( this.pretty(inst.acronym, inst.name, office.name) );
	
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
PersonItem.prototype = Object.create(Item.prototype);
PersonItem.prototype.constructor = PersonItem;
/* ********* */



function DetailsView(inventory, data) {	
	this.mode_edit = false;
	this.div = this.templ();
	this.inventory = inventory;
	this.data = data;
	this.cids = [];
	this.create();
	this.auth(this.div.find('.edit'));
	this.auth(this.div.find('.delete'), 'delete');
}
DetailsView.prototype = {
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
	
	create: function() {
		this.div.find('.edit').click( this.edit.bind(this) );
		this.div.find('.save').click( this.save.bind(this) );
		this.div.find('.cancel').click( this.cancel.bind(this) );
		this.div.find('.delete').click( (function() {
			this.inventory.delete_dialog.show(this.remove.bind(this));
		}).bind(this));
		this.div.find('.footer').hide();
	},
	
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

	extract: function() {
		this.sec.extract(this.data);
	},
			
	edit: function() {
		ajax(wsgi + '/lock/', {data: JSON.stringify(this.data)}, (function(res) {
			console.log(res);
			if(res.status == 'success') {
				this.inventory.goto_details();
				return this.fill(true);
			}
			/* TODO: Show error message! */
			console.log('Someone else is editing the data!');
		}).bind(this));
	},
	
	remove: function() {
		ajax(wsgi + '/delete/', {data: JSON.stringify(this.data), apikey: this.inventory.get_apikey()}, (function(res) {
			console.log(res);
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
			console.log(res);
			if(res.status == 'success') {
				/* Update id of currently loaded item to identify it as already present. */
				this.data._id = res.id;
				this.auth(this.div.find('.edit'));
				this.auth(this.div.find('.delete'), 'delete');
				this.inventory.load_data();
				this.inventory.goto_details();
				return this.fill(false);
			}
			//ajax(wsgi + '/unlock/', {data: JSON.stringify(this.data)});
		}).bind(this));
	},
	
	verify: function() {
		return null;
	},
	
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
	
	auth: function(divs, perm) {
		data = {
			data: JSON.stringify(this.data),
			perm: perm || "edit",
			apikey: this.inventory.get_apikey()
		};
		ajax(wsgi + '/auth/', data, (function(divs, res) {
			console.log(res);
			divs.attr('disabled', res.status != 'success');
		}).bind(this, divs));
	},
			
	add_callback: function(obj, event, fun) {
		var cid = obj.setCallback( event, fun );
		this.cids.push({obj: obj, cid: cid});
	},
	
	clear_callbacks: function() {
		for(var i = 0; i < this.cids.length; i++) {
			this.cids[i].obj.delCallback(this.cids[i].cid);
		}
	},
	
	new_dropdown2: function(d, label, type, edit) {
		var drp = new HtmlDropDownGroup(label);
		drp.setAsValue( function(o) { return o._id; });
		drp.setToString( function(o) { return o.name; });
		drp.setSource( this.inventory.items.filter('type', type).setSortFun(this.alpha_sort.bind(this)).sort() );
		this.auth_dropdown2(d, edit, drp, type);
		return drp;
	},
	
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
	
	new_dropdown: function(label, type, edit) {
		var drp = new HtmlDropDownGroup(label);
		drp.setAsValue( function(o) { return o._id; });
		drp.setToString( function(o) { return o.name; });
		drp.setSource( this.inventory.items.filter('type', type).setSortFun(this.alpha_sort.bind(this)).sort() );
		this.auth_dropdown(edit, drp, type);
		/* TODO: makes problems, is it really neccessary? */
//		this.add_callback(this.inventory.items, 'data_change', (function() {
//			var item = drp.selectedItem();
//			drp.setSource( this.inventory.items.filter('type', type) );
//			/* Try to set the selection back to the previous one. */
//			if( item != null )
//				drp.selectByOid('_id', item._id);
//		}).bind(this));
		return drp;
	},
	
	auth_dropdown2: function(d, edit, drp, key) {
		if( edit ) {
			data = {
				data: JSON.stringify(drp.source.list),
				perm: "edit",
				apikey: this.inventory.get_apikey()
			};
			deferred_ajax(d, wsgi + '/auth_many/', data, (function(drp, res) {
				console.log(res);
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
			}).bind(this, drp));
		} else {			
			if( this.data[key] )
				drp.selectByOid('_id', this.data[key]);
			d.resolve();
		}
	},
	
	auth_dropdown: function(edit, drp, key) {
		if( edit ) {
			data = {
				data: JSON.stringify(drp.source.list),
				perm: "edit",
				apikey: this.inventory.get_apikey()
			};
			ajax(wsgi + '/auth_many/', data, (function(drp, res) {
				console.log(res);
				var selected = drp.selectedItem();
				if( res.status == 'success' ) {
					for(var i = 0; i < res.invalid.length; i++) {
						var id = res.invalid[i];
						drp.source.remove('_id', id);
						drp.source.notifyOn('change');
					}
					if( res.valid.length > 0 )
						this.div.find('.save').attr('disabled', false);
				}
				drp.selectByObj(selected);
				if( this.data[key] )
					drp.selectByOid('_id', this.data[key]);
			}).bind(this, drp));
		} else {			
			if( this.data[key] )
				drp.selectByOid('_id', this.data[key]);
		}
	},
		
	clear: function() {
		/* Do not use empty() here because it removes all event listeners from the child elements
		 * which is quite not a good idea if the children are still used. */
		this.div.find('.content').children().detach();
	},
	
	getField: function(key) {
		return this.sec.htmls.findItem('key', key).html;
	}
};




/* Class DecisionItem extends Item. */
function DecisionItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory, data);
	/* Set fields. */	
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html(
		this.pretty(this.data.a['severity of the event'] ? 'Severity of the event' : '', this.data.a['impact of the event'] ? 'Impact of the event' : '', this.data.a['impending or imminent event'] ? 'Impending or imminent event' : '')
	);
	var inst = this.inventory.items.getByOid('_id', data.institute).item;
	this.div.find('.text').html( this.pretty(inst.acronym, inst.name) );
	
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
DecisionItem.prototype = Object.create(Item.prototype);
DecisionItem.prototype.constructor = DecisionItem;
/* ********* */



/* Class AdviceItem extends Item. */
function AdviceItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory, data);
	/* Set fields. */		
	this.div.find('.title').html(data.name);
	
	/* Display list of channels. */
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
AdviceItem.prototype = Object.create(Item.prototype);
AdviceItem.prototype.constructor = AdviceItem;


/* Class AdviceItem extends Item. */
function InviteItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory, data);	
	/* Set fields. */		
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html(
		$('<div>', {html: this.pretty(data.to)})
	);
	this.div.find('.text').html( this.pretty(data.new_institute, data.new_office) );
}
InviteItem.prototype = Object.create(Item.prototype);
InviteItem.prototype.constructor = InviteItem;


function InstDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
InstDetailView.prototype = Object.create(DetailsView.prototype);
InstDetailView.prototype.constructor = InstDetailView;

InstDetailView.prototype.fill = function(edit) {
	var fields = new Container(
	    {key: 'name', html: new HtmlTextGroup('Name').validate('^.+$')},
	    {key: 'acronym', html: new HtmlTextGroup('Acronym')},
	    {key: 'website', html: new HtmlTextGroup('Website')}
	);
	
	this.div.find('.banner').html('Institute');
	this.sec = new Section(fields);
	this.div.find('.save').attr('disabled', false);
	
	DetailsView.prototype.fill.call(this, edit);
};

InstDetailView.prototype.verify = function() {
	return this.sec.htmls.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};



function PersonDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
PersonDetailView.prototype = Object.create(DetailsView.prototype);
PersonDetailView.prototype.constructor = PersonDetailView;

PersonDetailView.prototype.fields = function(edit) {
	var label = new HtmlCustom($('<h5>', {
		html: edit ? 'Please specify working hours if the institute doesn’t provide a 24/7 operational service.' : 'Working hours if not 24/7 operational service.'
	}) );
	var fields = new Container(
		{html: new HtmlCustom( $('<h5>', {html: 'Provide contact details for the bodies that are responsible for issuing warnings and advice to civil protection authorities.'}) )},
		{key: 'name', html: new HtmlTextGroup('Contact Name').validate('^.+$')},
   	    {key: 'office', html: null},
   	    {key: 'mail', html: new HtmlTextGroup('E-Mail')},
   	    {key: 'phone', html: new HtmlTextGroup('Phone')},
   	    {key: 'fax', html: new HtmlTextGroup('Fax')},   	    
   	    {key: 'kind1', html: null},
   	    {key: 'kind2', html: null},
   	    {key: '247', html: null},
   	    {key: 'hours_label', html: label},
   	    {key: 'hours', html: new HtmlTextArea()},
   	    {html: new HtmlCustom($('<h5>', {html: 'Additional explanation.'}))},
   	    {key: 'explanation', html: new HtmlTextArea()}
	);
	return fields;
};

PersonDetailView.prototype.fill = function(edit) {
	/* Create initial html elements and fill them with data. */
	var d1 = $.Deferred();
	var drp1 = this.new_dropdown2(d1, 'Office', 'office', edit);	
	
	$.when(d1).always((function() {
		drp1.setToString( (function(o) {
			var inst = this.inventory.items.getByOid('_id', o.institute).item;
			return (inst.acronym != '' ? inst.acronym : inst.name) + ' - ' + o.name;
		}).bind(this));
		drp1.display();
	
		var txt1 = new HtmlTextGroup('Other Resp.');
		txt1.div.hide();
		
		var drp2 = new HtmlDropDownGroup('Responsibility');
		drp2.setSource(new Container(
	        'Crisis coordinator',
	        'Operational service',
	        'Civil protection authority',
	        'Other'
	    ));
		drp2.setCallback('change', (function(drpbox, txt) {
			if( drpbox.value() == 'Other' )
				txt.div.css('display', '');
			else
				txt.div.hide();
		}).bind(this, drp2, txt1));
		drp2.select(0);
		
		var chk = new HtmlCheckBox('24/7 operational service').addClass('operational');
		chk.setCallback('change', (function(chk) {
			chk.value() ? this.getField('hours').div.hide() : this.getField('hours').div.show();
			chk.value() ? this.getField('hours_label').div.hide() : this.getField('hours_label').div.show();
		}).bind(this, chk));
		
		var label = new HtmlCustom($('<h5>', {
			html: edit ? 'Please specify working hours if the institute doesn’t provide a 24/7 operational service.' : 'Working hours if not 24/7 operational service.'
		}) );
			
		var fields = new Container(
			{html: new HtmlCustom( $('<h5>', {html: 'Provide contact details for the bodies that are responsible for issuing warnings and advice to civil protection authorities.'}) )},
			{key: 'name', html: new HtmlTextGroup('Contact Name').validate('^.+$')},
	   	    {key: 'office', html: drp1},
	   	    {key: 'mail', html: new HtmlTextGroup('E-Mail')},
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
		
		this.div.find('.banner').html('Contact');
		this.sec = new Section(fields);
		
		DetailsView.prototype.fill.call(this, edit);
		
		chk.notifyOn('change');
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

PersonDetailView.prototype.extract = function() {
	DetailsView.prototype.extract.call(this);
		
	var kind1 = this.getField('kind1').value();
	this.data['kind'] = kind1 == 'Other' ? this.getField('kind2').value() : kind1;
	
	if( this.getField('247').value() ) {
		this.getField('hours').value('');
		this.data['hours'] = '';
	}
};

PersonDetailView.prototype.verify = function() {
	return this.getField('name').valid() ? null : 'Please provide a name.';
};



function AdviceDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
AdviceDetailView.prototype = Object.create(DetailsView.prototype);
AdviceDetailView.prototype.constructor = AdviceDetailView;
AdviceDetailView.prototype.fill = function(edit) {
	
	/* Create initial html elements and fill them with data. */
	var drp1 = this.new_dropdown('Institute', 'institute', edit);
	var sel1 = new Selection( Advice.prototype.items.a, 'Communication channels');
	var sel2 = new Selection( Advice.prototype.items.b, 'Content'); 
	var label = new HtmlCustom( $('<h5>', {
		html: edit ? 'Give a brief description of the following with regard to the type of information you provide.' : ''
	}) );
		
	var fields = new Container(
		{html: label},
		{key: 'institute', html: drp1},
		{key: 'name', type: 'text', html: new HtmlTextGroup('Name of Advice').validate('^.+$')},
		{key: 'a', html: sel1},
		{key: 'b', html: sel2},
		{key: 'c', html: new Section( new Container( {key: 'i', html: new HtmlTextArea()} ), 'Is this the case for every hazard type? If not, please describe how you provide advice for specific hazards.')},
		{key: 'explanation', html: new Section( new Container({key: 'text', html: new HtmlTextArea()}), 'Additional explanation.')}
	);
	
	this.div.find('.banner').html('Type of Advice');
	this.sec = new Section(fields);
	
	DetailsView.prototype.fill.call(this, edit);
};

AdviceDetailView.prototype.verify = function() {
	return this.getField('name').valid() ? null : 'Please provide a name.';
};




function ProcessDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
ProcessDetailView.prototype = Object.create(DetailsView.prototype);
ProcessDetailView.prototype.constructor = ProcessDetailView;
ProcessDetailView.prototype.fill = function(edit) {

	/* Create initial html elements and fill them with data. */
	var drp1 = this.new_dropdown('Institute', 'institute', edit);	
	var label = new HtmlCustom( $('<h5>', {
		html: edit ? 'Give a brief description of the following with regard to your decision making process.' : ''
	}));
	
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
	
	this.div.find('.banner').html('Decision Making Process');
	this.sec = new Section(fields);
	
	DetailsView.prototype.fill.call(this, edit);
};
ProcessDetailView.prototype.verify = function() {
	return this.getField('name').valid() ? null : 'Please provide a name.';
};



function OfficeDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
OfficeDetailView.prototype = Object.create(DetailsView.prototype);
OfficeDetailView.prototype.constructor = OfficeDetailView;

OfficeDetailView.prototype.hazards = function() {
	var groups = new Container(
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

OfficeDetailView.prototype.fill = function(edit, span) {
	/* Create initial html elements and fill them with data. */
	var drp1 = this.new_dropdown('Institute', 'institute', edit);
	var selections = this.hazards();
	
	var fields = new Container(
		{key: 'name', html: new HtmlTextGroup('Office Name').validate('^.+$')},
		{key: 'institute', html: drp1},
		{key: 'address', html: new HtmlTextGroup('Address')},
   	    {key: 'address2', html: new HtmlTextGroup('Address 2')},
   	    {key: 'city', html: new HtmlTextGroup('City')},
   	    {key: 'zip', html: new HtmlTextGroup('ZIP Code')},
   	    {key: 'country', html: new HtmlTextGroup('Country')},
   	    {key: 'lawfully_mandated', html: new HtmlCheckBox('Advices/warnings are provided as <b>lawfully</b> mandated services').addClass('lawfully')},
   	    {key: 'hazard_types', html: new Section(selections, 'For the following hazardous phenomena please select the items for which warnings are issued and/or advice is supplied').intend(false) },
   	    {html: new HtmlCustom($('<h5>', {html: 'Additional explanation.'}))},
   	    {key: 'explanation', html: new HtmlTextArea()}
	);
	
	this.div.find('.banner').html('Office');
	this.sec = new Section(fields);
	
	DetailsView.prototype.fill.call(this, edit);
};

OfficeDetailView.prototype.verify = function() {
	return this.sec.htmls.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};




function InviteDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
	this.div.addClass('invite');
}
InviteDetailView.prototype = Object.create(DetailsView.prototype);
InviteDetailView.prototype.constructor = InviteDetailView;

InviteDetailView.prototype.create = function() {
	DetailsView.prototype.create.call(this);
	this.div.find('.footer').prepend(
		$('<button>', {'class': 'btn btn-success pull-right confirm', html: 'Confirm', click: this.confirm.bind(this)})
	);
};

InviteDetailView.prototype.confirm = function() {
	ajax(wsgi + '/confirm/', {id: JSON.stringify(this.data._id), apikey: this.inventory.get_apikey()}, (function(res) {		
		if( res.status == 'success' ) {
			this.inventory.load_data();
			this.inventory.load_details(null);
			this.inventory.goto_details();
		}
	}).bind(this));
};

InviteDetailView.prototype.save = function() {
	if( !('_id' in this.data) && ! this.verify() ) {
		this.inventory.curview = null;
		this.inventory.load_details(null);
		this.inventory.goto_details();
	}
	DetailsView.prototype.save.call(this);
};

InviteDetailView.prototype.fill = function(edit) {
	var d1 = $.Deferred();
	var d2 = $.Deferred();
	var drp1 = this.new_dropdown2(d1, 'Institute', 'institute', edit);
	var drp2 = this.new_dropdown2(d2, 'Office', 'office', edit);
	var txt1 = new HtmlTextGroup('New Institute').validate('^.+$').$hide();
	var txt2 = new HtmlTextGroup('New Office').validate('^.+$').$hide();
	
	$.when( d1, d2 ).always((function() {
		drp1.source.replace('name', new Institute({name: 'New'}));
		drp1.source.notifyOn('change');
		
		drp1.setCallback('change', (function(drp, txt, drp_offices) {
			drp.value() ? txt.div.hide() : txt.div.css('display', '');
			drp_offices.setSource( this.inventory.items.filter('type', 'office').filter('institute', drp.value()) );
		}).bind(this, drp1, txt1, drp2));
		
		drp2.setCallback('source', (function() {
			this.source.replace('name', new Office({name: 'New'}));
		}).bind(drp2));
		
		drp2.setCallback('change', (function(drp, txt) {		
			drp.value() ? txt.div.hide() : txt.div.css('display', '');		
		}).bind(this, drp2, txt2));
		
		var known_inst = drp1.source.findItem('name', this.data.new_institute) != null;
		drp1.selectByVal('name', known_inst ? this.data.new_institute : 'New');
		txt1.value(known_inst ? '' : this.data.new_institute);
		
		var known_office = drp2.source.findItem('name', this.data.new_office) != null;
		drp2.selectByVal('name', known_office ? this.data.new_office : 'New');
		txt2.value(known_office ? '' : this.data.new_office);
	
		var btn_meteo = $('<label class="btn btn-default active"><input type="radio">Meteo</label>');
		var btn_geo = $('<label class="btn btn-default"><input type="radio">Geo</label>');
		var btn_custom = $('<label class="btn btn-default"><input type="radio">Custom</label>');
		var custom = new HtmlCustom( $('<div class="btn-group" data-toggle="buttons"></div>') );
		custom.append(btn_meteo).append(btn_geo).append(btn_custom);
		custom.div.css('display', edit ? '' : 'none');
		
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
		text_area.$find('textarea').bind('input onpropertychange', area_resize);
		text_area.$find('textarea').bind('input onpropertychange', (function(btn) { btn.click(); }).bind(this, btn_custom));
		
		var load_text = (function(txt, group) {
			if( group ) txt.value(texts[group]);
			/* In order to do the initial resizing of the textarea, the engine needs to render the html elements on the screen first. */
			setTimeout( area_resize.bind(text_area.$find('textarea')), 0 );
		}).bind(this, text_area);
		btn_meteo.click( load_text.bind(this, 'meteo') );
		btn_geo.click( load_text.bind(this, 'geo') );
		btn_custom.click( load_text.bind(this) );
			
		this.data.from = this.data.from || user.mail;
		
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
		
		this.div.find('.banner').html('Invite');
		if( !('_id' in this.data) ) {
			/* Request invite. */
			this.div.find('.btn.save').html('Request Invite').css('width', '120px');
		}
		this.div.find('.btn.confirm')[ !('_id' in this.data) || edit ? 'hide' : 'show' ]();
		this.sec = new Section(fields);
		
		DetailsView.prototype.fill.call(this, edit);
		
		if( !('_id' in this.data) ) {
			/* Load meteo text for new entries. */
			btn_meteo.click();
		} else {
			/* Assume custom otherwise. */
			btn_custom.click();
		}
		
		this.getField('from').readonly();
	
	}).bind(this));
};

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

InviteDetailView.prototype.extract = function() {
	DetailsView.prototype.extract.call(this);
	this.data.new_institute = this.getField('institute').value() ?  this.getField('institute').selectedItem().name : this.getField('institute-new').value();
	this.data.new_office = this.getField('office').value() ?  this.getField('office').selectedItem().name : this.getField('office-new').value();	
};


function Section(htmls, title) {
	this.div = $('<div>', {'class': 'section'}).append(
		$('<h5>', {html: arguments.length > 1 ? title : ''}),
		$('<div>', {'class': 'block'})
	);
	this.htmls = htmls;
}
Section.prototype = {
	fill: function(edit, data) {
		/* html elements need to be set from outside */
		for(var i = 0; i < this.htmls.length(); i++) {
			var item = this.htmls.get(i);
			if( item.html instanceof HtmlCustom )
				continue;
			if( item.html instanceof HtmlElement ) {
				if( ! item.nodata )
					item.html.value( data[item.key] );
				item.html.readonly(!edit);
			} else {
				if( ! (item.key in data) ) data[item.key] = {};
				item.html.fill(edit, data[item.key]);
			}
		}
		this.draw();
	},
	
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
	
	extract: function(data) {
		for(var i = 0; i < this.htmls.length(); i++) {
			var item = this.htmls.get(i);
			if( item.html instanceof HtmlCustom || item.nodata )
				continue;
			if( item.html instanceof HtmlElement ) {
				data[item.key] = item.html.value();
			} else
				item.html.extract(data[item.key]);
		}
	},
	
	intend: function(yes) {
		var blk = this.div.find('> div');
		yes ? blk.addClass('block') : blk.removeClass('block');
		return this;
	}
};



/* Input: A Container that includes items of the form {key: String, value: Boolean} */
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
			if(edit) {
				if( this.sortarr.indexOf(attr) >= 0 || data[attr] )
					html = new HtmlCheckBox(attr, data[attr]);
			} else if( data[attr] ) {
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
			this.other = new HtmlTextGroup('Other:').setButton('plus').validate('^.+$');
			this.other.getButton().click( (function(html, data) {
				if( ! html.valid() ) return;
				var chk = new HtmlCheckBox(html.value(), true);
				chk.setCallback('change', (function(chk, data) {					
					data.remove('key', chk.label());
					this.draw();
				}).bind(this, chk, data));
				var item = data.findItem('key', html.value());
				if( item ) {
					item.html.value(true);
				} else {
					data.insert({key: html.value(), html: chk});
				}
				html.value('');
				this.draw();
			}).bind(this, this.other, this.htmls));
		} else if(last) {
			/* remove last dot */
			last.html.find('.dot').detach();
		}
	},
	
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



function SaveDialog() {
	this.div = $('.modal-save');
	this.dialog = this.div.modal('hide');
	this.handlers = {};
	
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
	show: function(on_save, on_cancel) {
		this.handlers.on_save = on_save;
		this.handlers.on_cancel = on_cancel;
		this.div.modal('show');
	},
	
	hide: function() {
		this.div.modal('hide');
	}
};



function SortFuns() {}
SortFuns.prototype = {
	byArray: function(arr, attr) {
		return this.byArray_fun.bind(this, arr, attr);
	},
		
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
