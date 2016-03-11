var wsgi = '../aristotel/';

$(document).ready(function () {
	
	$('.custom-popover').hide();
	$('.custom-popover .popover-title span').click( function() {
		$(this).closest('.custom-popover').hide(500);
	});
	
	var inv = new Inventory($('.frame'));
	inv.load_data(0);
	
	setTimeout( function() {
		$('.snapin').show(800);
	}, 500 );
	
	$('.snapin .x').click( function() { $('.snapin').hide(500);} );
	
	setTimeout( function() {
		$('.sec-insts .custom-popover').show(800);
	}, 1500 );
	
	setTimeout( function() {
		$('.sec-offices .custom-popover').show(800);
	}, 3000 );
	
	setTimeout( function() {
		$('.sec-persons .custom-popover').show(800);
	}, 4500 );
	
	setTimeout( function() {
		$('.sec-decisions .custom-popover').show(800);
	}, 6000 );
	
	setTimeout( function() {
		$('.sec-advices .custom-popover').show(800);
	}, 7500 );
});



function Inventory(div) {
	this.div = div;
	this.items = new Container();
	this.ts = 0;
	this.tid = null;
	this.curview = null;
	
	this.save_dialog = new SaveDialog();
	
	this.div.find('.sec-persons button').click((function() {
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
	
	this.load_details(null);
}
Inventory.prototype = {
	get_apikey: function() {
		return window.location.search == '' ? null : window.location.search.slice(1);
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
			view = new DecisionDetailView(this, data);
		else if( data instanceof Advice )
			view = new AdviceDetailView(this, data);
		this.curview = view;
		if( view != null ) {
			view.edit_mode(edit);
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
		if( elem.scrollTop() > this.div.find('.details').offset().top )
			elem.animate({scrollTop: this.div.find('.details').offset().top}, 500);
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
		ajax(wsgi + '/load/', {ts: this.ts, apikey: this.get_apikey()}, (function(res) {			
			if( this.tid ) {
				clearTimeout(this.tid);
				this.tid = null;
			}
			var items = res.items;
			for(var i = 0; i < items.length; i++) {
				var item = this.new_item(items[i]);
				var ret = this.items.replaceByFun( function(o1, o2) {
					return o1['_id']['$oid'] == o2['_id']['$oid'];
				}, item);
				if( ret && this.curview != null && this.curview.data._id['$oid'] == item._id['$oid'] ) {
					if( ! this.curview.mode_edit ) {
						this.load_details(item, false, true);
					} else {
						/* TODO: This page is editing an item which was updated on another site! What to do in this case? */
					}
				}
			}
			if( items.length > 0 || this.ts == 0)
				this.draw();
			this.ts = res.ts;
			this.tid = setTimeout( this.load_data.bind(this), 5000 );
		}).bind(this));
	},
	
	clear: function() {
		this.div.find('.sec .items').empty();
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
		var insts = this.items.filter('type', 'institute');
		var divs = this.div.find('.sec-offices button, .sec-decisions button, .sec-advices button').attr('disabled', true);
		for(var i = 0; i < insts.length(); i++) {
			this.div.find('.sec-insts .items').append(
				new InstItem(this, insts.get(i)).div
			);
			/* Disable 'new' button if there is no possibility to create something. */
			this.auth(insts.get(i), divs);
		}
		var insts = this.items.filter('type', 'office');
		var divs = this.div.find('.sec-persons button').attr('disabled', true);
		for(var i = 0; i < insts.length(); i++) {
			this.div.find('.sec-offices .items').append(
				new OfficeItem(this, insts.get(i)).div
			);
			/* Disable 'new' button if there is no possibility to create something. */
			this.auth(insts.get(i), divs);
		}
		var insts = this.items.filter('type', 'person');
		for(var i = 0; i < insts.length(); i++) {
			this.div.find('.sec-persons .items').append(
				new PersonItem(this, insts.get(i)).div
			);
		}
		var insts = this.items.filter('type', 'decision');
		for(var i = 0; i < insts.length(); i++) {			
			this.div.find('.sec-decisions .items').append(
				new DecisionItem(this, insts.get(i)).div
			);
		}
		var insts = this.items.filter('type', 'advice');
		for(var i = 0; i < insts.length(); i++) {			
			this.div.find('.sec-advices .items').append(
				new AdviceItem(this, insts.get(i)).div
			);
		}
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
	this.mode_edit = false;
	this.div = this.templ();
	this.inventory = inventory;
	this.data = data;
	this.fields = new Container();
	this.layout();
	this.create();
	this.fill();
	this.edit_mode(this.mode_edit);
	this.auth(this.div.find('.edit'));
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
					$('<button>', {'class': 'btn btn-primary pull-right save', html: 'Save', disabled: true})
				)
			)
		);
	},
	
	create: function() {
		this.div.find('.edit').click( this.edit.bind(this) );
		this.div.find('.save').click( this.save.bind(this) );
		this.div.find('.cancel').click( this.cancel.bind(this) );
	},
		
	edit_mode: function(yes) {
		var edit_buttons = this.div.find('.footer .cancel, .footer .save');
		if( yes ) {
			/* Enable all input fields. */
			for(var i = 0; i < this.fields.length(); i++)
				this.fields.get(i).html.readonly(false);
			edit_buttons.show();
			this.div.find('.footer .edit').hide();
		} else {
			/* Disable all input fields. */
			for(var i = 0; i < this.fields.length(); i++)
				this.fields.get(i).html.readonly();
			edit_buttons.hide();
			this.div.find('.footer .edit').show();
		}
		this.mode_edit = yes; 
	},
	
	edit: function() {
		ajax(wsgi + '/lock/', {data: JSON.stringify(this.data)}, (function(res) {
			console.log(res);
			if(res.status == 'success')
				return this.edit_mode(true);
			/* TODO: Show error message! */
			console.log('Someone else is editing the data!');
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
				this.inventory.load_data();
				this.inventory.goto_details();
				return this.edit_mode(false);
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
		this.edit_mode(false);
	},
	
	extract: function() {
		for(var i = 0; i < this.fields.length(); i++) {
			var field = this.fields.get(i);
			if( field.key == 'kind1' || field.key == 'kind2' )
				continue;
			if( field.html instanceof HtmlTextGroup )
				this.data[field.key] = field.html.value();
			if( field.html instanceof HtmlDropDown )
				this.data[field.key] = field.html.value();
			if( field.html instanceof HtmlTextArea )
				this.data[field.key] = field.html.value();
			if( field.html instanceof HtmlCheckBox )
				this.data[field.key] = field.html.value();
		}
	},
		
	fill: function() {
		this.clear();
		this.div.find('.content').append($('<div>', {'class': 'fields'}));
		for(var i = 0; i < this.fields.length(); i++) {
			var field = this.fields.get(i);
			this.div.find('.content .fields').append(
				field.html.div
			);
			if( typeof this.data[field.key] == 'undefined')
				this.data[field.key] = '';			
			if( field.html instanceof HtmlTextGroup )
				field.html.value( this.data[field.key] );
			if( field.html instanceof HtmlTextArea )
				field.html.value( this.data[field.key] );
			if( field.html instanceof HtmlCheckBox )
				field.html.value( this.data[field.key] );
		}
	},
	
	auth: function(divs) {
		data = {
			data: JSON.stringify(this.data),
			perm: "edit",
			apikey: this.inventory.get_apikey()
		};
		ajax(wsgi + '/auth/', data, (function(divs, res) {
			divs.attr('disabled', res.status != 'success');
		}).bind(this, divs));
	},
	
	auth2:  function(item, fun) {
		data = {
			data: JSON.stringify(item),
			perm: "edit",
			apikey: this.inventory.get_apikey()
		};
		ajax(wsgi + '/auth/', data, (function(fun, item, res) {
			fun(item, res.status == 'success');
		}).bind(this, fun, item));
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
	
	layout: function() {},
	
	clear: function() {
		/* Do not use empty() here because it removes all event listeners from the child elements
		 * which is quite not a good idea if the children are still used. */
		this.div.find('.content').children().detach();
	},
	
	getField: function(key) {
		return this.fields.findItem('key', key).html;
	}
};



function PersonDetailView(inventory, data) {	
	DetailsView.call(this, inventory, data);
}
PersonDetailView.prototype = Object.create(DetailsView.prototype);
PersonDetailView.prototype.constructor = PersonDetailView;
PersonDetailView.prototype.layout = function() {
	this.div.find('.banner').html('Contact');
	
	var txt1 = new HtmlTextGroup('Other Resp.');
	txt1.div.hide();
	var drp1 = new HtmlDropDownGroup('Responsibility');
	drp1.setSource(new Container().setList([
        'Crisis coordinator',
        'Operational service',
        'Civil protection authority',
        'Other'
    ]));
	var fun = function(drpbox, txt) {
		if( drpbox.value() == 'Other' )
			txt.div.css('display', '');
		else
			txt.div.hide();
	};
	drp1.setCallback('change', fun.bind(this, drp1, txt1));
	drp1.select(0);
	
	var drp3 = new HtmlDropDownGroup('Office');
	drp3.setToString( (function(o) {
		var inst = this.inventory.items.getByOid('_id', o.institute).item;
		return inst.acronym ? inst.acronym + ' - ' + o.name : o.name;
	}).bind(this));
	drp3.setSource( this.inventory.items.filter('type', 'office') );
	drp3.select(0);
		
	var chk = new HtmlCheckBox('24/7 operational service');
	chk.setCallback('change', (function() {
		var pos = $('body').scrollTop();
		this.edit_mode(true);
		$('body').scrollTop( pos );
	}).bind(this));
	
	this.fields = new Container().setList([
   	    {key: 'name', html: new HtmlTextGroup('Contact Name').validate('^.+$')},
   	    {key: 'office', html: drp3},
   	    {key: 'mail', html: new HtmlTextGroup('Mail')},
   	    {key: 'phone', html: new HtmlTextGroup('Phone')},
   	    {key: 'fax', html: new HtmlTextGroup('Fax')},   	    
   	    {key: 'kind1', html: drp1},
   	    {key: 'kind2', html: txt1},
   	    {key: '247', html: chk},
   	    {key: 'hours', html: new HtmlTextArea()},
   	    {key: 'explanation', html: new HtmlTextArea()},
   	]);
};

PersonDetailView.prototype.fill = function() {	
	DetailsView.prototype.fill.call(this);
	
	if( this.data['office'] )
		this.fields.findItem('key', 'office').html.selectByOid('_id', this.data['office']);
	
	this.div.find('.content').prepend($('<div>', {
		'class': 'info center',
		html: 'Provide contact details for the bodies that are responsible for issuing warnings and advice to civil protection authorities.'
	}));
};
	
PersonDetailView.prototype.edit_mode = function(yes) {
	
	DetailsView.prototype.edit_mode.call(this, yes);
	
	var drp = this.fields.findItem('key', 'kind1').html;
	if( this.data['kind'] ) {
		if( ! drp.source.findItem(null, this.data['kind']) ) {
			drp.selectByVal(null, 'Other');
			this.fields.findItem('key', 'kind2').html.value( this.data['kind'] );
		} else {
			drp.selectByVal(null, this.data['kind']);
		}
	}
	
	var drp3 = this.getField('office');
	if(yes) {
		var funs = [];
		for(var i = 0; i < drp3.source.length(); i++) {
			funs.push( this.auth3.bind(this, drp3.source.get(i)) );
		}
		new FunCascade().callback(
			(function(drp, reslst) {
				for(var i = 0; i < reslst.length; i++) {
					var ret = reslst[i];
					if( ! ret.res ) {
						console.log('Denied:', ret.item.name);
						drp.source.remove('name', ret.item.name);
						drp.source.notifyOn('change');
						drp.select(0);
					} else {
						this.div.find('.save').attr('disabled', false);
					}
				}
				/* All checks are performed, thus select the right office now. */
				if( this.data.office )
					drp3.selectByOid('_id', this.data.office);
			}).bind(this, drp3)
		).invoke(funs);
	} else {
		if( this.data.office )
			drp3.selectByOid('_id', this.data.office);
	}
	
	if( yes ) {
		/* Find dropdown box for office. */
		if( this.fields.findItem('key', 'office').html.size() == 0 ) {
			this.clear();
			this.div.find('.content').append(
				$('<div>', {'class': 'intro2', html: 'Create an office first.'}),
				$('<button>', {'class': 'btn btn-primary btn-new-office', html: 'New Office', click: (function() {
						this.inventory.load_details(
							new Office({}), true
						);
					}).bind(this)
				})
			);
			this.div.find('.footer .cancel, .footer .save').hide();
			return;
		}
	}
	
	this.div.find('.hazard-types').detach();
	this.div.find('.content').append( $('<div>', {'class': 'hazard-types'}) );
	
	/* Adapt 24/7 textarea. */
	var chk247 = this.fields.findItem('key', '247').html;
	this.div.find('.hazard-types').append( chk247.div );
	
	if( ! chk247.value() ) {
		this.div.find('.hazard-types').append(
			$('<h5>', {
				'class': 'comment-head',
				html: yes ? 'Please specify working hours if the institute doesn’t provide a 24/7 operational service.' : 'Working hours if not 24/7 operational service.'
			}),
			this.fields.findItem('key', 'hours').html.div
		);
	} else {
		this.fields.findItem('key', 'hours').html.div.remove();
	}
	
	/* Move explanantion textarea to the end. */
	this.div.find('.hazard-types').append(
		$('<h5>', {'class': 'comment-head', html: 'Additional explanation.'}),
		this.fields.findItem('key', 'explanation').html.div
	);
};

PersonDetailView.prototype.extract = function() {
	DetailsView.prototype.extract.call(this);
	
	this.data['office'] = this.fields.findItem('key', 'office').html.value()._id;
	
	var kind1 = this.fields.findItem('key', 'kind1').html.value();
	this.data['kind'] = kind1 == 'Other' ? this.fields.findItem('key', 'kind2').html.value() : kind1;
	
	if( this.fields.findItem('key', '247').html.value() ) {
		this.fields.findItem('key', 'hours').html.value('');
		this.data['hours'] = '';
	}
};

PersonDetailView.prototype.verify = function() {
	return this.fields.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};



function OfficeDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
OfficeDetailView.prototype = Object.create(DetailsView.prototype);
OfficeDetailView.prototype.constructor = OfficeDetailView;

OfficeDetailView.prototype.fill = function() {
	
	/* Create institute dropdown box. */
	var drp1 = new HtmlDropDownGroup('Institute');
	drp1.setToString( function(o) { return o.name; });
	drp1.setAsValue( function(o) { return o._id; });
	drp1.setSource( this.inventory.items.filter('type', 'institute') );
	drp1.select(0);
		
	/* Set field elements which are handled by the parent class. */
	this.fields = new Container([
   	    {key: 'name', html: new HtmlTextGroup('Office Name').validate('^.+$')},
   	    {key: 'institute', html: drp1},
   	    {key: 'address', html: new HtmlTextGroup('Address')},
   	    {key: 'address2', html: new HtmlTextGroup('Address 2')},
   	    {key: 'city', html: new HtmlTextGroup('City')},
   	    {key: 'zip', html: new HtmlTextGroup('ZIP Code')},
   	    {key: 'country', html: new HtmlTextGroup('Country')},
   	    {key: 'explanation', html: new HtmlTextArea()},
   	    {key: 'lawfully_mandated', html: new HtmlCheckBox('Advices/warnings are provided as <b>lawfully</b> mandated services')},
   	]);
	
	this.div.find('.banner').html('Office');
	
	/* Parent class handles field elements. */
	DetailsView.prototype.fill.call(this);
	
	/* Create  */
	this.boxes = new Container( SortFuns.prototype.byArray(
		["Severe Weather", "Flooding", "Droughts", "Forest Fires", "Earthquakes", "Volcanic Eruption"],
        'name'
    ));

	this.valid_types = ["High temperatures", "Low temperatures", "Wind gusts land", "Wind gusts coast", "Wind gusts sea",
     "Mean windspeed gusts land", "Mean windspeed gusts coast", "Mean windspeed gusts sea", "Visibility",
     "Lightning", "Gusts in thunderstorms/showers", "Hail", "Ice", "Heavy rain", "Road conditions (black ice)",
     "Snow(accumulation/load)", "Ice accretion on vessel structures", "Orographic winds", "Tornadoes",
     "Sand storm", "Dust storm", "Tephra/Ash", "Lava Flows", "Lahars", "Gas", "Pyroclastic Flows",
     "Landslides", "Coastal flooding/storm surge", "River flooding", "Flash flooding",
     "Earthquake (regional/local)", "Earthquake Focal Parameters", "Seismic Intensity", "Shake Maps",
     "Focal Mechanism", "Tsunami (basin wide/regional/local)", "Meteorological Drought",
     "Crown fires", "Surface fires", "Ground fires"];
	
	var groups = this.data.hazard_types;
	for(var attr in groups) {
		var container = new Container( SortFuns.prototype.byArray(this.valid_types, 'name'));
		for(var name in groups[attr]) {
			container.insert( {name: name, html: new HtmlCheckBox(name, groups[attr][name])} );
		}
		this.boxes.insert( {name: attr, data: container} );
	}
};

OfficeDetailView.prototype.edit_mode = function(yes) {
	DetailsView.prototype.edit_mode.call(this, yes);
	
	/* Remove all institutes for which the user has no 'edit' permission in edit mode. */
	var drp1 = this.getField('institute');
	if( yes ) {
		var funs = [];
		for(var i = 0; i < drp1.source.length(); i++) {
			funs.push( this.auth3.bind(this, drp1.source.get(i)) );
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
				if( this.data.institute )
					drp1.selectByOid('_id', this.data.institute);
			}).bind(this, drp1)
		).invoke(funs);
	} else {
		if( this.data.institute )
			drp1.selectByOid('_id', this.data.institute);
	}
	
	this.div.find('.hazard-types').detach();
	
	var blk1 = $('<div>', {'class': 'hazard-types'});
	blk1.append($('<div>', {
		'class': 'info',
		html: 'For the following hazardous phenomena please select the items for which warnings are issued and/or advice is supplied'
	}));
	for(var i = 0; i < this.boxes.length(); i++) {
		var sub = this.boxes.get(i);
		var container = sub.data;
		var attr = sub.name;
		blk1.append( $('<b>', {'class': 'head', html: attr}) );
		for(var j = 0; j < container.length(); j++) {
			var item = container.get(j);
			if( yes ) {
				blk1.append( item.html.div );
			} else if( item.html.value() == true ) {
				blk1.append(
					$('<span>', {'class': 'text', html: item.name}).append(
						$('<span>', {'class': 'dot', html: '&bull;'})
					)
				);
			}
		}
		if(yes) {
			var text = new HtmlTextGroup('Other:').setButton('plus');
			text.validate('^.+$');
			text.getButton().click( (function(html, attr) {
				if( ! html.valid() ) return;
				var pos = $('body').scrollTop();
				this.boxes.findItem('name', attr).data.replace('name', {name: html.value(), html: new HtmlCheckBox(html.value(), true)});
				this.edit_mode(true);
				$('body').scrollTop( pos );
			}).bind(this, text, attr));
			blk1.append( text.div );
		} else {
			var last = blk1.children().last();
			last.find('.dot').length ? last.find('.dot').remove() : last.remove();
		}
	}
	this.div.find('.content').append(blk1);

	/* Move explanantion textarea to the end. */
	this.div.find('.hazard-types').append(
		$('<h5>', {'class': 'comment-head', html: 'Additional explanation.'}),
		this.fields.findItem('key', 'explanation').html.div
	);
};

OfficeDetailView.prototype.extract = function() {
	/* Field elements are extracted by the parent class. */
	DetailsView.prototype.extract.call(this);
	/* Handle hazard type checkboxes at this point. */
	var hazards = {};
	for(var i = 0; i < this.boxes.length(); i++) {
		var sub = this.boxes.get(i);
		hazards[sub.name] = {};
		for(var j = 0; j < sub.data.length(); j++) {
			var item = sub.data.get(j);
			hazards[sub.name][item.name] = item.html.value();
			if( this.valid_types.indexOf(item.name) < 0 && ! item.html.value() )
				delete hazards[sub.name][item.name];
		}
	}
	this.data.hazard_types = hazards;
};

OfficeDetailView.prototype.verify = function() {
	return this.fields.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};



function InstDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
InstDetailView.prototype = Object.create(DetailsView.prototype);
InstDetailView.prototype.constructor = InstDetailView;
InstDetailView.prototype.layout = function() {
	this.div.find('.banner').html('Institute');
	this.fields = new Container().setList([
   	    {key: 'name', html: new HtmlTextGroup('Name').validate('^.+$')},
   	    {key: 'acronym', html: new HtmlTextGroup('Acronym')},
   	    {key: 'website', html: new HtmlTextGroup('Website')}
   	]);
	this.div.find('.footer .save').attr('disabled', false);
};

InstDetailView.prototype.verify = function() {
	return this.fields.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};



function DecisionDetailView(inventory, data) {
	DetailsView.call(this, inventory, data);
}
DecisionDetailView.prototype = Object.create(DetailsView.prototype);
DecisionDetailView.prototype.constructor = DecisionDetailView;
DecisionDetailView.prototype.layout = function() {
	this.div.find('.banner').html('Decision Making Process');
};

DecisionDetailView.prototype.create = function() {
	DetailsView.prototype.create.call(this);
};

DecisionDetailView.prototype.edit_mode = function(yes) {
		
	DetailsView.prototype.edit_mode.call(this, yes);
	
	var sub1 = new Container().setList([
        {key: 'i', title: 'Severity of the event', type: 'checkbox'},
        {key: 'ii', title: 'Impact of the event', type: 'checkbox'},
        {key: 'iv', title: 'Impending or imminent event', type: 'checkbox'},
        {key: 'iii', title: 'Is this the case for every hazard type? If not, please specify:', type: 'section',
        	content: new Container().setList([{key: 'a', title: 'Description', type: 'textarea'}]) 
        }
    ]);
	
	var sub2 = new Container().setList([
        {key: 'i', title: 'Description', type: 'textarea'},
    ]);
	
	var sub3 = new Container().setList([
        {key: 'i', title: 'Does your institute communicate with those entities? Please describe how.', type: 'section',
        	content: new Container().setList([{key: 'a', title: 'Description', type: 'textarea'}])
        },
        {key: 'ii', title: 'Is there a coordinated approach to communicate these multiple hazards/warnings? Please describe that approach.', type: 'section',
        	content: new Container().setList([
        	    {key: 'a', title: 'Description', type: 'textarea'},
        	])
        }
    ]);
        
	var source = this.inventory.items.filter('type', 'institute');
	
	/* TODO: Implement this with a funtion cascade. */
	if(yes) {
		for(var i = 0; i < source.length(); i++) {
			var item = source.get(i);
			this.auth2(item, (function(source, item, res) {			
				if( ! res ) {
					source.remove('name', item.name);
					source.notifyOn('change');
				} else  {
					this.div.find('.save').attr('disabled', false);
				}
			}).bind(this, source));
		}
	}
		
	this.titles = new Container().setList([
        {key: 'institute', title: 'Institute', type: 'dropdown', source: source},
        {key: 'name', title: 'Name of Process', type: 'text'},
		{key: 'a', title: 'Please select the criteria that trigger the issue of a warning.', type: 'section', content: sub1},
		{key: 'b', title: 'Are emergency responders/civil crisis managers involved within the decision process for issuing  warnings? Please describe how.', type: 'section', content: sub2},
		{key: 'c', title: 'Give details of what happens when events involve more than one hazard or when warnings are issued by more than one institute.', type: 'section', content: sub3},
		{key: 'explanation', title: 'Additional explanation.', type: 'section',
        	content: new Container().setList([
                {key: 'text', type: 'textarea'}
            ])
        },
	]);
	
	this.clear();
	this.div.find('.content').append(
		$('<div>', {'class': 'survey'})
	);
	if( yes ) {
		this.div.find('.content .survey').append(
			$('<div>', {
				'class': 'info',
				html: 'Give a brief description of the following with regard to your decision making process.'
			})
		);
	}
	this.list(this.div.find('.content .survey'), yes, this.titles, 0, this.data);
	
	this.titles.findItem('key', 'name').html.validate('^.+$');
	
	if( yes )
		return;
	
	this.disable(this.titles);
};

DecisionDetailView.prototype.list = function(div, edit_mode, list, tab, subdata) {
	for(var i = 0; i < list.length(); i++ ) {
		var item = list.get(i);
		if( item.type == 'section' ) {
			var subdiv = $('<div>', {'class': 'block'});
			div.append(
				$('<h5>', {html: item.title}),
				subdiv
			);
			if( ! subdata[item.key] )
				subdata[item.key] = {};
			this.list(subdiv, edit_mode, item.content, tab+1, subdata[item.key]);
		} else if( item.type == 'checkbox' ) {
			if( ! subdata[item.key] )
				subdata[item.key] = false;
			item.html = new HtmlCheckBox(item.title, subdata[item.key]);
			div.append(item.html.div);
		} else if( item.type == 'text' ) {
			if( ! subdata[item.key] )
				subdata[item.key] = '';
			item.html = new HtmlTextGroup(item.title);
			item.html.value( subdata[item.key] );
			div.append(item.html.div);
		} else if( item.type == 'dropdown' ) {
			item.html = new HtmlDropDownGroup(item.title);
			item.html.setToString( function(o) { return o.name; } );
			item.html.setSource(item.source);
			item.source.setCallback('change', (function(html, val) {
				val ? html.selectByOid('_id', val) : html.select(0);
			}).bind(this, item.html, subdata[item.key]));
			subdata[item.key] ? item.html.selectByOid('_id', subdata[item.key]) : item.html.select(0);
			div.append(item.html.div);
		} else if( item.type == 'boxes' ) {
			var subdiv = $('<div>', {'class': 'block'});
			this.add_boxes(edit_mode, subdiv, this.boxes[item.key]);
			if( subdiv.html() != '' ) {
				div.append(
					$('<h5>', {html: item.title}),
					subdiv
				);
			}
		} else if( item.type == 'textarea' ) {
			if( ! subdata[item.key] )
				subdata[item.key] = '';
			item.html = new HtmlTextArea();
			item.html.value( subdata[item.key] );
			div.append(item.html.div);
		}
	}
};

DecisionDetailView.prototype.disable = function(list) {
	for(var i = 0; i < list.length(); i++ ) {
		var item = list.get(i);
		if( item.type == 'section' ) {
			this.disable(item.content);
		} else if( item.type == 'checkbox' ) {
			item.html.readonly();
		} else if( item.type == 'text' ) {
			item.html.readonly();
		} else if( item.type == 'dropdown' ) {
			item.html.readonly();
		} else if( item.type == 'textarea' ) {
			item.html.readonly();
		}
	}
};
DecisionDetailView.prototype.store = function(list, subdata) {
	for(var i = 0; i < list.length(); i++ ) {
		var item = list.get(i);
		if( item.type == 'section' ) {
			if( ! subdata[item.key] ) subdata[item.key] = {};
			this.store(item.content, subdata[item.key]);
		} else if( item.type == 'checkbox' ) {
			subdata[item.key] = item.html.value();
		} else if( item.type == 'text' ) {
			subdata[item.key] = item.html.value();
		} else if( item.type == 'dropdown' ) {
			subdata[item.key] = item.html.value()._id;
		} else if( item.type == 'boxes' ) {
			if( ! subdata[item.key] ) subdata[item.key] = {};
			for(var j = 0; j < this.boxes[item.key].length(); j++) {
				var obj = this.boxes[item.key].get(j);
				subdata[item.key][obj.name] = obj.html.value();
			}
		} else if( item.type == 'textarea' ) {
			subdata[item.key] = item.html.value();
		}
	}
};

DecisionDetailView.prototype.extract = function() {
	DetailsView.prototype.extract.call(this);
	this.store(this.titles, this.data);
};

DecisionDetailView.prototype.verify = function() {
	return this.titles.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
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


function AdviceDetailView(inventory, data) {
	DecisionDetailView.call(this, inventory, data);
}
AdviceDetailView.prototype = Object.create(DecisionDetailView.prototype);
AdviceDetailView.prototype.constructor = AdviceDetailView;
AdviceDetailView.prototype.layout = function() {
	this.div.find('.banner').html('Type of Advice');	
};

AdviceDetailView.prototype.fill = function() {
	this.boxes = {};
	for(attr in Advice.prototype.items) {
		this.boxes[attr] = new Container().setSortFun(SortFuns.prototype.byArray(Advice.prototype.items[attr], 'name'));
		for(var name in this.data[attr]) {
			var val = this.data[attr][name];
			if( Advice.prototype.items[attr].indexOf(name) >= 0 || val )
				this.boxes[attr].insert( {name: name, html: new HtmlCheckBox(name, val)} );
		}
	}
	DecisionDetailView.prototype.fill.call(this);
};

AdviceDetailView.prototype.edit_mode = function(yes) {
	
	DetailsView.prototype.edit_mode.call(this, yes);
	    
	var source = this.inventory.items.filter('type', 'institute');
	
	if(yes) {
		for(var i = 0; i < source.length(); i++) {
			var item = source.get(i);
			this.auth2(item, (function(source, item, res) {			
				if( ! res ) {
					source.remove('name', item.name);
					source.notifyOn('change');
				} else  {
					this.div.find('.save').attr('disabled', false);
				}
			}).bind(this, source));
		}
	}
	
	this.titles = new Container().setList([
        {key: 'institute', title: 'Institute', type: 'dropdown', source: source},
        {key: 'name', title: 'Name of Advice', type: 'text'},
        {key: 'a', title: 'Communication channels', type: 'boxes'},
        {key: 'b', title: 'Content', type: 'boxes'},
        {key: 'c', title: 'Is this the case for every hazard type? If not, please describe how you provide advice for specific hazards.', type: 'section',
        	content: new Container().setList([
                {key: 'i', title: 'Description', type: 'textarea'}
            ])
        },
        {key: 'explanation', title: 'Additional explanation.', type: 'section',
        	content: new Container().setList([
                {key: 'text', type: 'textarea'}
            ])
        },
	]);
	
	this.clear();
	this.div.find('.content').append(
		$('<div>', {'class': 'survey'})
	);
	if( yes ) {
		this.div.find('.content .survey').append(
			$('<div>', {
				'class': 'info',
				html: 'Give a brief description of the following with regard to the type of information you provide.'
			})
		);
	}
	this.list(this.div.find('.content .survey'), yes, this.titles, 0, this.data);
	
	this.titles.findItem('key', 'name').html.validate('^.+$');
	
	if( yes )
		return;
	
	this.disable(this.titles);
};

AdviceDetailView.prototype.add_boxes = function(yes, div, container) {
	for(var i = 0; i < container.length(); i++) {
		var item = container.get(i);
		if(yes) {
			div.append(item.html.div);
		} else if( item.html.value() ) {
			div.append(
				$('<span>', {'class': 'text', html: item.name}),
				$('<span>', {'class': 'dot', html: '&bull;'})
			);
		}
	}
	if( yes ) {
		var text = new HtmlTextGroup('Other:').setButton('plus');
		text.validate('^.+$');
		text.getButton().click( (function(html, container) {
			if( ! html.valid() ) return;
			var pos = $('body').scrollTop();
			var chk = new HtmlCheckBox(html.value(), true);
			chk.setCallback('change', (function(html, container) {
				var pos = $('body').scrollTop();
				container.remove('name', html.label());
				this.edit_mode(true);
				$('body').scrollTop( pos );
			}).bind(this, chk, container));
			var item = container.findItem('name', html.value());
			if( item ) {
				item.html.value(true);
			} else {
				container.insert({name: html.value(), html: chk});
			}
			this.edit_mode(true);
			$('body').scrollTop( pos );
		}).bind(this, text, container));
		div.append(text.div);
	} else {
		div.children().last().remove();
	}
};

AdviceDetailView.prototype.extract = function() {
	/* Remove unchecked custom checkboxes. */
	for(attr in Advice.prototype.items) {
		var list = [];
		for(var i = 0; i < this.boxes[attr].length(); i++) {
			var item = this.boxes[attr].get(i);
			if( Advice.prototype.items[attr].indexOf(item.name) < 0 && ! item.html.value() )
				list.push(item.name);
		}
		for(var i = 0; i < list.length; i++) {
			this.boxes[attr].remove('name', list[i]);
			delete this.data[attr][list[i]];
		}
	}
	DecisionDetailView.prototype.extract.call(this);
};

AdviceDetailView.prototype.verify = function() {
	return this.titles.findItem('key', 'name').html.valid() ? null : 'Please provide a name.';
};



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
/* ********* */



function SaveDialog() {
	this.div = $('.modal');
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
