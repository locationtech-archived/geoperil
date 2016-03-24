var wsgi = '../aristotlesrv/';
var texts = null;

ajax(wsgi + '/get_texts/', {}, function(res) {
	texts = res.texts;
});

$(document).ready(function () {
	
	/* Initialize tooltips. */
	$(function () {
		$('[data-toggle="tooltip"]').tooltip();
	});
	
	var inv = new Inventory($('.frame'));
	window.onpopstate = inv.search.bind(inv);
	inv.search();
		
	$('.custom-popover').hide();
	$('.custom-popover .popover-title span').click( function() {
		$(this).closest('.custom-popover').hide(500);
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
	this.items = new Container();
	this.ts = 0;
	this.tid = null;
	this.curview = null;
	this.search_data = {'in': [], id: [], display: [], text: ''};
	
	this.map = new Map('map', this);
	
	this.save_dialog = new SaveDialog();
	this.delete_dialog = new DeleteDialog();
	
	this.div.find('.sec-persons button.add').click((function() {
		this.load_details(
			new Person(), true
		);
	}).bind(this));
	
	this.div.find('.sec-persons button.invite').click((function() {
		this.load_details(
			new Invite(), true
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
		this.btn_search.find('.btn-clear')[this.btn_search.value() != '' ? 'show' : 'hide']({duration: 400});
		this.update_url( this.btn_search.value() );
	};
	var fun = function() {
		var tid = null;
		var fun = function(e) {
			clearTimeout(tid);
			var delay = (e.which == 13 || e.which == 32 || this.btn_search.value() == '') ? 0 : 1000;
			tid = setTimeout( (function(){ this.btn_search.text.div.change(); }).bind(this), delay);
			this.btn_search.find('.btn-clear')[this.btn_search.value() != '' ? 'show' : 'hide']({duration: 400});
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
	this.div.find('.search-box').append( this.btn_search.div );
		
	for(attr in {'search': '', 'map-tile': ''}) {
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
		} else {
			this.div.find('.details').html(
				$('<div>', {'class': 'intro', html: 'Select an Institute, Office or Contact.'})
			);
		}
		return view;
	},
	
	goto_details: function() {
		/* Jump to details view. */
		/* Cross browser fix: Chrome uses 'body', Firefox 'html'! */
		var elem = $('body').scrollTop() ? $('body') : $('html');
		var top = $('.details').offset().top - 40;
		this.div.find('.stub').find('.static.pinned').each(function() {
			top -= $(this).outerHeight();
		});
		elem.animate({scrollTop: top}, 500);
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
			var items = res.items;
			for(var i = 0; i < items.length; i++) {
				var item = this.new_item(items[i]);
				var ret = this.items.replace('_id', item);
				if(ret) console.log(item);
				/* TODO: better handle this over a callback */
				if( ret && this.curview != null && '_id' in this.curview.data && this.curview.data._id['$oid'] == item._id['$oid'] ) {
					if( ! this.curview.mode_edit ) {
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
				console.log("notify");
				this.items.notifyOn('data_change');
			}
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
		this.clear();
		if( this.items.length() > 0 ) {
			this.div.find('.list, .details').show();
			this.div.find('.denied').hide();
		} else {
			this.div.find('.list, .details').hide();
			this.div.find('.denied').show();
		}
		var filtfun = function(type) {
			var f =  function(type, obj) {
				return obj.type == type && obj.__show && ! obj.deleted;
			};
			return f.bind(null, type);
		};
		var divs = this.div.find('.sec-offices button, .sec-decisions button, .sec-advices button').attr('disabled', true);
		if( this.visible('institute') ) {
			var insts = this.items.filter( filtfun('institute') );
			for(var i = 0; i < insts.length(); i++) {
				this.div.find('.sec-insts .items').append(
					new InstItem(this, insts.get(i)).div
				);
				/* Disable 'new' button if there is no possibility to create something. */
				this.auth(insts.get(i), divs);
			}
		}
		var divs = this.div.find('.sec-persons button').attr('disabled', true);
		if( this.visible('office') ) {
			var insts = this.items.filter( filtfun('office') );
			for(var i = 0; i < insts.length(); i++) {
				this.div.find('.sec-offices .items').append(
					new OfficeItem(this, insts.get(i)).div
				);
				/* Disable 'new' button if there is no possibility to create something. */
				this.auth(insts.get(i), divs);
			}
			new Geocoder().get_locations( insts, this.map.set_offices.bind(this.map) );
		}
		if( this.visible('person') ) {
			var insts = this.items.filter( filtfun('person') );
			for(var i = 0; i < insts.length(); i++) {
				this.div.find('.sec-persons .items').append(
					new PersonItem(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('decision') ) {
			var insts = this.items.filter( filtfun('decision') );
			for(var i = 0; i < insts.length(); i++) {			
				this.div.find('.sec-decisions .items').append(
					new DecisionItem(this, insts.get(i)).div
				);
			}
		}
		if( this.visible('advice') ) {
			var insts = this.items.filter( filtfun('advice') );
			for(var i = 0; i < insts.length(); i++) {			
				this.div.find('.sec-advices .items').append(
					new AdviceItem(this, insts.get(i)).div
				);
			}
		}
	},
	
	visible: function(type) {
		return this.search_data.display.length == 0 || this.search_data.display.indexOf(type) >= 0;
	},
	
	auth: function(item, divs) {
		data = {
			data: JSON.stringify(item),
			perm: "edit",
			apikey: this.get_apikey()
		};
		ajax(wsgi + '/auth/', data, (function(divs, res) {
			if( res.status == 'success' )
				divs.attr('disabled', false);
		}).bind(this, divs));
	}
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
		for(var i = 0; i < items.length; i++) {
			var ret = items[i];
			if( ! ret ) continue;
			var popup = $('<span class="popup-content">' +
				'<a>' + ret.office.name + '</a>' +
				'<div>' + ret.office.address + '</div>' +
				'<div>' + ret.office.zip + ' ' + ret.office.city + '</div>' + 
				'<div>' + ret.office.country + '</div>' +
			'</span>');
			popup.find('> a').click( (function(popup, office) {
				this.inventory.load_details(office);
				popup.closest('.leaflet-popup').find('> .leaflet-popup-close-button').get(0).click();
			}).bind(this, popup, ret.office));
			var marker = L.marker([ret.res.lat, ret.res.lon]).addTo(this.map).bindPopup( popup.get(0) );			
			this.markers.insert(marker);
		}
	}
};
Map.prototype.constructor = Map;



function Geocoder() {
	
}
Geocoder.prototype = {
	from_address: function(office, callback) {
		var data = {
			format: 'json',
			city: office.city,
			country: office.country,
			street: office.address,
			postalcode: office.zip
		};
		$.ajax({
			url: 'http://nominatim.openstreetmap.org/search',
			type: 'GET',
			jsonp: 'json_callback',
			data: data,
			dataType: "jsonp",
			success: (function(callback, office, ret) {
				callback( ret.length > 0 ? {res: ret[0], office: office} : null);
			}).bind(this, callback, office)
		});
	},
	
	get_locations: function(items, callback) {
		var funs = [];
		for(var i = 0; i < items.length(); i++) {
			var item = items.get(i);
			funs.push( this.from_address.bind(this, item) );
		}
		new FunCascade().callback( callback ).invoke(funs);
	}
};
Geocoder.prototype.constructor = Geocoder;



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
function Item(inventory) {
	this.inventory = inventory;
}
Item.prototype = {
	inventory: null,
	templ: function() {
		return (
			$('<div>', {'class': 'item'}).append(
				$('<span>', {'class': 'title'}),
				$('<div>', {'class': 'subtitle'}),
				$('<div>', {'class': 'text'})
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
	}
};
/* ********* */



/* Class InstItem extends Item. */
function InstItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory);
	this.data = data;
	/* Set fields. */	
	this.div = this.templ();
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html( this.pretty(data.acronym, data.website) );
	
	this.div.find('.title').click( this.onTitleClick.bind(this) );
}
InstItem.prototype = Object.create(Item.prototype);
InstItem.prototype.constructor = InstItem;
/* ********* */



/* Class OfficeItem extends Item. */
function OfficeItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory);
	this.data = data;
	/* Set fields. */	
	this.div = this.templ();
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html( this.pretty(data.address, data.zip, data.city, data.country) );
	
	var inst = this.inventory.items.getByOid('_id', data.institute).item;
	this.div.find('.text').html( this.pretty(inst.acronym, inst.name) );
	
	this.div.find('.title').click( this.onTitleClick.bind(this) );
}
OfficeItem.prototype = Object.create(Item.prototype);
OfficeItem.prototype.constructor = OfficeItem;
/* ********* */



/* Class PersonItem extends Item. */
function PersonItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory);
	this.data = data;
	/* Set fields. */
	var office = this.inventory.items.getByOid('_id', data.office).item;
	var inst = this.inventory.items.getByOid('_id', office.institute).item;
	this.div = this.templ();
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html(
		$('<div>', {html: this.pretty(data.kind, data.mail)})
	);
	this.div.find('.subtitle').append(
		$('<div>', {html: this.pretty(['Tel ', data.phone] , ['Fax ', data.fax])})
	);
	this.div.find('.text').html( this.pretty(inst.acronym, inst.name, office.name) );
	
	this.div.find('.title').click( this.onTitleClick.bind(this) );
}
PersonItem.prototype = Object.create(Item.prototype);
PersonItem.prototype.constructor = PersonItem;
/* ********* */



function DetailsView(inventory, data) {
	console.log(this);
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
				$('<div>', {'class': 'content'}),
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
	},
	
	fill: function(edit) {
		this.sec.fill(edit, this.data);
		this.div.find('.content').html(this.sec.div);
		
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
	},

	extract: function() {
		this.sec.extract(this.data);
	},
			
	edit: function() {
		ajax(wsgi + '/lock/', {data: JSON.stringify(this.data)}, (function(res) {
			console.log(res);
			if(res.status == 'success')
				return this.fill(true);
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
		console.log(this.data);
		ajax(wsgi + '/save/', {data: JSON.stringify(this.data), apikey: this.inventory.get_apikey()}, (function(res) {
			console.log(res);
			if(res.status == 'success') {
				/* Update id of currently loaded item to identify it as already present. */
				this.data._id = res.id;
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
			divs.attr('disabled', res.status != 'success');
		}).bind(this, divs));
	},
		
	auth3:  function(item, fun) {
		data = {
			data: JSON.stringify(item),
			perm: "edit",
			apikey: this.inventory.get_apikey()
		};
		ajax(wsgi + '/auth/', data, (function(fun, item, res) {
			fun({item: item, res: res.status == 'success'});
		}).bind(this, fun, item));
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
	
	new_dropdown: function(label, type, edit) {
		var drp = new HtmlDropDownGroup(label);
		drp.setAsValue( function(o) { return o._id; });
		drp.setToString( function(o) { return o.name; });
		drp.setSource( this.inventory.items.filter('type', type) );
		this.auth_dropdown(edit, drp, type);
		this.add_callback(this.inventory.items, 'data_change', (function(drp) {
			var item = drp.selectedItem();
			drp.setSource( this.inventory.items.filter('type', type) );
			/* Try to setting the selection back to the previous one. */
			drp.selectByOid('_id', item._id);
		}).bind(this, drp));
		return drp;
	},
	
	auth_dropdown: function(edit, drp, key) {
		if( edit ) {
			var funs = [];
			for(var i = 0; i < drp.source.length(); i++) {
				funs.push( this.auth3.bind(this, drp.source.get(i)) );
			}
			new FunCascade().callback(
				(function(drp, reslst) {
					for(var i = 0; i < reslst.length; i++) {
						var ret = reslst[i];
						if( ! ret.res ) {
							console.log('Denied:', ret.item.name);
							drp.source.remove('name', ret.item.name);
							drp.source.notifyOn('change');
						} else {
							this.div.find('.save').attr('disabled', false);
						}
					}
					if( this.data[key] )
						drp.selectByOid('_id', this.data[key]);
				}).bind(this, drp)
			).invoke(funs);
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
	Item.call(this, inventory);
	this.data = data;
	/* Set fields. */	
	this.div = this.templ();
	this.div.find('.title').html(data.name);
	this.div.find('.subtitle').html(
		this.pretty(this.data.a.i ? 'Severity of the event' : '', this.data.a.ii ? 'Impact of the event' : '', this.data.a.iv ? 'Impending or imminent event' : '')
	);
	
	var inst = this.inventory.items.getByOid('_id', data.institute).item;
	this.div.find('.text').html( this.pretty(inst.acronym, inst.name) );
	
	this.div.find('.title').click( this.onTitleClick.bind(this) );
}
DecisionItem.prototype = Object.create(Item.prototype);
DecisionItem.prototype.constructor = DecisionItem;
/* ********* */



/* Class AdviceItem extends Item. */
function AdviceItem(inventory, data) {
	/* Call super constructor! */
	Item.call(this, inventory);
	this.data = data;
	/* Set fields. */	
	this.div = this.templ();
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
	
	this.div.find('.title').click( this.onTitleClick.bind(this) );
}
AdviceItem.prototype = Object.create(Item.prototype);
AdviceItem.prototype.constructor = AdviceItem;



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
PersonDetailView.prototype.fill = function(edit) {
	/* Create initial html elements and fill them with data. */
	var drp1 = this.new_dropdown('Office', 'office', edit);
	drp1.setToString( (function(o) {
		var inst = this.inventory.items.getByOid('_id', o.institute).item;		
		return inst.acronym ? inst.acronym + ' - ' + o.name : o.name;
	}).bind(this));
	drp1.display();
	drp1.select(0);
	
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
   	    {key: 'mail', html: new HtmlTextGroup('Mail')},
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
	var sel1 = new Selection( Advice.prototype.items.b, 'Communication channels');
	var sel2 = new Selection( Advice.prototype.items.a, 'Content'); 
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
	    		{key: 'i', html: new HtmlCheckBox('Severity of the event')},
				{key: 'ii', html: new HtmlCheckBox('Impact of the event')},
				{key: 'iv', html: new HtmlCheckBox('Impending or imminent event')},
				{key: 'iii', html: new Section(
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
OfficeDetailView.prototype.fill = function(edit) {

	/* Create initial html elements and fill them with data. */
	var drp1 = this.new_dropdown('Institute', 'institute', edit);
	
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
}
InviteDetailView.prototype = Object.create(DetailsView.prototype);
InviteDetailView.prototype.constructor = InviteDetailView;

InviteDetailView.prototype.fill = function(edit) {
	var drp1 = this.new_dropdown('Institute', 'institute', edit);
	var drp2 = this.new_dropdown('Office', 'office', edit);
	var txt1 = new HtmlTextGroup('New Institute').validate('^.+$').$hide();
	var txt2 = new HtmlTextGroup('New Office').validate('^.+$').$hide();
	
	var fun_add_other = function() {
		this.source.replace('name', new Institute({name: 'New'}));
		return this;
	};
	
	drp1.setCallback('source', fun_add_other.bind(drp1));
	drp1.setCallback('change', (function(drp, txt, drp_offices) {
		drp.value() ? txt.div.hide() : txt.div.css('display', '');
		drp_offices.setSource( this.inventory.items.filter('type', 'office').filter('institute', drp.value()) );
	}).bind(this, drp1, txt1, drp2));
	
	fun_add_other.call(drp1).display();
	
	drp2.setCallback('source', (function() {
		this.source.replace('name', new Office({name: 'New'}));
	}).bind(drp2));
	
	drp2.setCallback('change', (function(drp, txt) {		
		drp.value() ? txt.div.hide() : txt.div.css('display', '');
	}).bind(this, drp2, txt2));
	
	drp1.setSource( drp1.source );
	drp2.setSource( drp2.source );
	
	var btn_meteo = $('<label class="btn btn-default active"><input type="radio">Meteo</label>');
	var btn_geo = $('<label class="btn btn-default"><input type="radio">Geo</label>');
	var custom = new HtmlCustom( $('<div class="btn-group" data-toggle="buttons"></div>') );
	custom.append(btn_meteo).append(btn_geo);
	
	var text_area = new HtmlTextArea();
	
	var area_resize = function() {
		$(this).innerHeight(0);
		$(this).innerHeight( $(this).prop('scrollHeight') );
	};
	text_area.$find('textarea').bind('input onpropertychange', area_resize);
	
	var load_text = (function(txt, group) {
		txt.value(texts[group]);
		/* In order to do the initial resizing of the textarea, the engine needs to render the html elements on the screen first. */
		setTimeout( area_resize.bind(text_area.$find('textarea')), 0 );
	}).bind(this, text_area);
	btn_meteo.click( load_text.bind(this, 'meteo') );
	btn_geo.click( load_text.bind(this, 'geo') );
	
	btn_meteo.click();
	
	var fields = new Container(
		{key: 'institute', html: drp1, nodata: true},
		{key: 'institute-new', html: txt1, nodata: true},
		{key: 'office', html: drp2, nodata: true},
		{key: 'office-new', html: txt2, nodata: true},
	    {key: 'name', html: new HtmlTextGroup('Contact Name').validate('^.+$')},
	    {key: 'mail', html: new HtmlTextGroup('Mail').validate('^.+$')},
	    {key: 'version', html: custom},
	    {key: 'text', html: text_area}
	);
	
	this.div.find('.banner').html('Invite');
	this.div.find('.btn.save').html('Invite');
	this.sec = new Section(fields);
	
	DetailsView.prototype.fill.call(this, edit);
};

InviteDetailView.prototype.verify = function() {
	var required = {'name': 'a name', 'mail': 'a mail address'};
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
	this.data.institute = this.getField('institute').value() ?  this.getField('institute').selectedItem().name : this.getField('institute-new').value();
	this.data.office = this.getField('office').value() ?  this.getField('office').selectedItem().name : this.getField('office-new').value();
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
		var blk = $('<div>' /*, {'class': 'block'}*/);
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
