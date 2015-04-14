function wait() {

  var ret = page.evaluate(function () {
     for( var key in entries.map ) {
        var eq = entries.get(key);
        if( eq.isLoaded() )
           return true;
     }
     return false;
  });

  if( ! ret ) {
    window.setTimeout( wait, 1000 );
  } else {
    window.setTimeout( render, 2000 );
  }
}

function render() {

    var clipRect = page.evaluate(function (s) {
       var cr = document.querySelector(s).getBoundingClientRect();
       return cr;
    }, selector);

    page.clipRect = {
       top:    clipRect.top,
       left:   clipRect.left,
       width:  clipRect.width,
       height: clipRect.height
    };

    console.log("Rendering to file...");
    page.render(output);
    phantom.exit();
}

var page = require('webpage').create(),
    system = require('system'),
    address, output, size;

if (system.args.length < 4 || system.args.length > 6) {
    phantom.exit(1);
} else {
    address = system.args[1];
    output = system.args[2];
    selector = system.args[3];
    page.viewportSize = { width: 1920, height: 1080 };
    console.log("Loading page...");
    page.open(address, function (status) {
        if (status !== 'success') {
            console.log('Unable to load the address!');
        } else {
            wait();
        }
    });
}

