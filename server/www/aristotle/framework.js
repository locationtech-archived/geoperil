function IUtils() {
	this.toNull = function(expr) {
		return expr ? expr : null;
	};
	
	/* Removes attributes with a null value in place! */
	this.removeNulls = function(obj) {
		for(var key in obj)
			if( obj[key] === null || obj[key] === undefined )
				delete obj[key];
		return obj;
	};
}

ICallbacks.prototype = new IUtils();
function ICallbacks() {
	
	IUtils.call(this);

	this.callbacks = {};
	this.uid = ICallbacks.next_uid++;

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
	
	/* TODO: fix! */
	this.setUniqueCallback = function(action, func, uid) {
		if( ! (action in this.callbacks) )
			this.callbacks[action] = {cnt: 0};
		/* TODO: requires combination of function and uid */
		for( var i = 0; i < this.callbacks[action].cnt; i++) {
			if( this.callbacks[action].uid == uid )
				return;
		}
		/* get next id that identifies this callback - can be used to deregister later */
		var cnt = this.callbacks[action].cnt++;
		this.callbacks[action][cnt] = func;
		return cnt;
	};
	
	this.delCallback = function(action,cid) {
		if( cid !== undefined )
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
				/* TODO: Check this part on production system. */
//				if( vargs.length == 0 ) {
//					setTimeout( this.callbacks[action][i].bind(this), 0);
//				} else if ( vargs.length == 1 )
//					setTimeout( this.callbacks[action][i].bind(this, vargs[0]), 0 );
//				else if ( vargs.length == 2 )
//					setTimeout( this.callbacks[action][i].bind(this, vargs[0], vargs[1]), 0 );
				
				ICallbacks.total++;
				if( ICallbacks.total % 20 == 0 )
					console.log('Total notfifications: ' + ICallbacks.total);
				this.callbacks[action][i].apply(this, vargs);
			}
	};
}
ICallbacks.next_uid = 1;
ICallbacks.total = 0;

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

	this.findItem = function(key, val) {
		return this.getByKey(key, val).item;
	};
	
	this.findIdx = function(key, val) {
		return this.getByKey(key, val).idx;
	};
	
	this.getByOid = function(key, oid) {
		for (var i = 0; i < this.list.length; i++) {
			var item = this.list[i][key];			
			if( item['$oid'] && item['$oid'] == oid['$oid'] )
				return {idx: i, item: this.list[i]};
		}
		return {idx: -1, item: null};
	};
	
	this.getByFun = function(fun) {
		for (var i = 0; i < this.list.length; i++) {
			if( fun(this.list[i]) )
				return {idx: i, item: this.list[i]};
		}
		return {idx: -1, item: null};
	};
	
	this.getByKey = function(key, val) {

		for (var i = 0; i < this.list.length; i++) {

			var mkey = key ? this.list[i][key] : this.list[i];
			if(mkey == val)
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

	this.replaceByFun = function(fun, item) {
		for (var i = 0; i < this.list.length; i++) {
			if( fun(this.list[i], item) ) {
				this.list[i] = item;
				console.log(this.list[i], item);
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
			f = function(o){return o[attr] == val;};
			
		for (var i = 0; i < this.list.length; i++) {
			if( f(this.list[i]) )
				ret.push(this.list[i]);
		}
		return new Container().setList(ret);
	};

	this.clear = function() {
		this.list.length = 0;
	};

	this.sort = function() {
		if( this.sortFun )
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
	
	this.setList = function(list) {
		this.list = list;
		this.sort();
		return this;
	};
	
	this.swap = function(i, j) {
		var tmp = this.list[i];
		this.list[i] = this.list[j];
		this.list[j] = tmp;
	};
}

HtmlCheckBox.prototype = new ICallbacks();
function HtmlCheckBox(label, checked) {

	ICallbacks.call(this);
	
	this.init = function(label, checked) {
		this.div = this.templ();
		this.div.find('> .html-label').html(label);
		this.check = this.div.find('> .html-check');
		this.check.change(this.onChange.bind(this));
		
		if( arguments.length > 1 )
			this.value( checked );
	};
	
	this.templ = function() {
		return (
			$('<div>', {'class': 'html-checkbox'}).append(
				$('<input>', {'class': 'html-check', 'type': 'checkbox'}),
				$('<span>', {'class': 'html-label'})
			)
		);
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
	
	/* Input: ActionFlag field */
	this.bindTo = function(field) {
		this.setCallback('change', field.set.bind(field));
		field.setCallback('change', this.value.bind(this));
		this.value(field.get());
	};
	
	this.readonly = function(no) {
		this.check.attr('disabled', arguments.length == 0 || no);
		return this;
	};
	
	this.init(label, checked);
}

HtmlDropDown.prototype = new ICallbacks();
function HtmlDropDown() {
	
	ICallbacks.call(this);
	
	this.init = function() {
		this.div = this.templ();
		this.content = this.div.find('> ul');
		this.button = this.div.find('> button');
		this.toString = function(o){return o;};
	};
	
	this.templ = function() {
		return (
			$('<div>', {'class': 'html-dropdown dropdown'}).append(
				$('<button>', {'class': 'btn btn-default dropdown-toggle form-control', 'type': 'button', 'data-toggle': 'dropdown'}).append(
					$('<span>', {'class': 'html-text'}),
					$('<span>', {'class': 'caret'})
				),
				$('<ul>', {'class': 'dropdown-menu'})
			)
		);
	};
	
	this.setSource = function(source) {
		this.idx = -1;
		this.source = source;
		this.source.setCallback('change',this.display.bind(this));
		this.display();
		return this;
	};
	
	this.setToString = function(func) {
		this.toString = func;
	};
	
	this.setAsValue = function(func) {
		this.asValue = func;
	};
	
	this.display = function() {
		this.content.empty();
		for( var i = 0; i < this.source.length(); i++ ) {
			var obj = this.source.get(i);
			var item = $('<li><a href="#">' + this.toString(obj) + '</a></li>');
			item.find('a').click(this.onChange.bind(this));
			this.content.append(item);
		}
	};

	this.onChange = function(e) {
		var item = $(e.delegateTarget);
		this.select(item.closest('li').index());
		/* TODO: Workaround to avoid jumping to the top of the site when selecting an item. */
		this.div.find('.dropdown').removeClass('open');
		return false;
	};

	this.select = function(idx) {
		if (arguments.length > 0) {
			var items = this.content.find('> li');
			if (idx < items.length) {
				var item = $(items[idx]);
				this.button.find('> .html-text').html(
						item.find('a').html());
				this.idx = idx;
				this.notifyOn('change', this.idx);
			}
		}
		return this.idx;
	};
	
	this.selectByVal = function(key, val) {
		var item = this.source.getByKey(key, val);
		var idx = item.idx >= 0 ? item.idx : 0;
		this.select( idx ); 
	};
	
	this.selectByFun = function(fun) {
		var item = this.source.getByFun(fun);
		var idx = item.idx >= 0 ? item.idx : 0;
		this.select( idx ); 
	};
	
	/* Just a wrapper to provide a common interface. */
	this.value = function() {
		var val = this.selectedItem();
		if( val && this.asValue )
			val = this.asValue(val);
		return val;
	};
	
	this.selectedItem = function() {
		return (this.idx > -1 ? this.source.get(this.idx) : null);
	};
	
	this.size = function() {
		if( ! this.source )
			return 0;
		return this.source.length();
	};
	
	this.enable = function() {
		this.div.find('button').prop('disabled', false);
	};
	
	this.disable = function() {
		this.div.find('button').prop('disabled', true);
	};
	
	this.readonly = function(no) {
		this.div.attr('readonly', arguments.length == 0 || no);
		return this;
	};

	this.init();
};

HtmlTextField.prototype = new ICallbacks();
function HtmlTextField(field, defaultText) {
	ICallbacks.call(this);
	
	this.init = function(field, defaultText) {
		this.regex = null;
		this.min = null;
		this.max = null;
		this.div = field;
		if( defaultText )
			this.div.attr('placeholder', defaultText);
		this.div.on('change', this.onChange.bind(this));
	};
	
	this.value = function(newValue) {
		if(newValue !== undefined) {
			this.div.val(newValue);
			this.div.change();
		}
		return this.div.val();
	};

	this.validate_numeric = function(min, max) {
		this.min = min;
		this.max = max;
	};

	this.validate = function(regex) {
		this.regex = new RegExp(regex);
	};
	
	this.valid_numeric = function() {
		if( this.min == null || this.max == null )
			return true;
		var val = this.value();
		/* Check if numeric. */
		if( ! new RegExp('^-?[0-9]+(\\.[0-9]*)?$').test(val) )
			return false;
		return (val >= this.min && val <= this.max);
	};
	
	this.valid_regex = function() {
		if( ! this.regex )
			return true;
		return this.regex.test(this.value());
	};
	
	this.valid = function() {
		return this.valid_numeric() && this.valid_regex();
	};

	this.onChange = function() {
		if( ! this.valid() ) {
			this.div.css('color', 'red');
		} else {
			this.div.css('color', '');
		}
		this.notifyOn('change', this.value());
	};
	
	this.init.apply(this, arguments);
}

HtmlTextGroup.prototype = new ICallbacks();
function HtmlTextGroup(label, icon, readonly) {
	
	ICallbacks.call(this);
	
	this.regex = null;

	this.init = function(label, icon, readOnly) {
		this.div = this.templ();
		this.text = new HtmlTextField(this.div.find('> .html-text'));
		this.btn = this.div.find('> .html-btn > button');
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
		if( readOnly ) this.readonly();
		this.div.find('> .html-btn').hide();
		/* Forward change event of embedded text field. */
		this.text.setCallback('change', this.notifyOn.bind(this, 'change'));
	};
	
	this.templ = function() {
		return (
			$('<div>', {'class': 'html-textgroup input-group input-group-sm prop-label'}).append(
				$('<spin>', {'class': 'html-label input-group-addon'}),
				$('<input>', {'class': 'html-text form-control', 'type': 'text'}),
				$('<spin>', {'class': 'html-icon input-group-addon'}).append(
					$('<span>', {'class': 'glyphicon'})
				),
				$('<span>', {'class': 'html-btn input-group-btn'}).append(
					$('<button>', {'class': 'btn btn-default'}).append(
						$('<span>', {'class': 'glyphicon'})
					)
				)
			)
		);
	};
	
	this.setRLabel = function(text) {
		this.div.find('> .html-icon > span').html(text);
		this.div.find('> .html-icon').css('display', '');
		return this;
	};
	
	this.setButton = function(iconOrText, isHtml) {
		var span = this.btn.find('> span');
		isHtml ? span.html(iconOrText) : span.addClass('glyphicon-' + iconOrText);
		this.div.find('> .html-btn').css('display', '');
		this.div.find('> .html-icon').hide();
		return this;
	};
	
	this.getButton = function() {
		return this.div.find('> .html-btn button');
	};

	this.value = function(newValue) {
		return this.text.value(newValue);
	};

	this.validate = function(regex) {
		return this.text.validate(regex);
	};
	
	this.validate_numeric = function(min, max) {
		return this.text.validate_numeric(min, max);
	};
	
	this.valid = function() {
		return this.text.valid();
	};
	
	this.readonly = function(no) {
		this.text.div.attr('readonly', arguments.length == 0 || no);
		return this;
	};
	
	this.hasValue = function() {
		return this.value() != '';
	};
	
	this.init.apply(this, arguments);
}

HtmlInputGroup.prototype = new ICallbacks();
function HtmlInputGroup(label, icon, box) {

	ICallbacks.call(this);
	
	this.init = function(label, icon, box) {
		this.div = this.templ();
		this.div.find('> .html-label').html(label);

		if( icon ) {
			this.div.find('> .html-icon > span').addClass('glyphicon-' + icon);
		} else {
			this.div.find('> .html-icon').hide();
		}

		this.input = this.div.find('> .html-input');
		
		if( box ) {
			console.log(box.find('> .content').children());
			this.input.replaceWith( box.find('> .content').children() );
			box.html(this.div);
		}
	};
	
	this.templ = function() {
		return (
			$('<div>', {'class': 'html-inputgroup input-group input-group-sm prop-label'}).append(
				$('<span>', {'class': 'html-label input-group-addon'}),
				$('<span>', {'class': 'html-input'}),
				$('<span>', {'class': 'html-icon input-group-addon prop-right'}).append(
					$('<span>', {'class': 'glyphicon'})
				)
			)
		);
	};

	this.init(label, icon, box);
}

HtmlDropDownGroup.prototype = new HtmlDropDown();
function HtmlDropDownGroup(label, icon) {
	
	HtmlDropDown.call(this);
	
	this.init = function(label, icon) {		
		this.group = new HtmlInputGroup(label, icon);
		this.group.input.append(this.div);
		this.div = this.group.div;
	};
	
	this.readonly = function(no) {
		this.div.find('button').attr('disabled', arguments.length == 0 || no);
		return this;
	};
	
	this.init(label, icon);
}

HtmlTextArea.prototype = new ICallbacks();
function HtmlTextArea() {
	ICallbacks.call(this);
	
	this.templ = function() {
		return (
			$('<div>', {'class': 'html-textarea prop-label'}).append(
				$('<textarea>', {'class': 'form-control', rows: '4', spellcheck: 'false'})
			)
		);
	};
	
	this.init = function() {
		this.div = this.templ();
		this.area = this.div.find('textarea');
		this.div.on('change', this.onChange.bind(this));
	};
	
	this.value = function(newValue) {
		if(newValue !== undefined) {
			this.area.val(newValue);
			this.area.change();
		}
		return this.area.val();
	};

	this.onChange = function() {
		this.notifyOn('change', this.value());
	};
	
	this.readonly = function(no) {
		this.area.attr('readonly', arguments.length == 0 || no);
		return this;
	};
	
	this.init.apply(this, arguments);
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
