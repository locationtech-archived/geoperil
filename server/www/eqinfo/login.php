<?php
/*
 * GeoPeril - A platform for the computation and web-mapping of hazard specific
 * geospatial data, as well as for serving functionality to handle, share, and
 * communicate threat specific information in a collaborative environment.
 * 
 * Copyright (C) 2013 GFZ German Research Centre for Geosciences
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *   http://apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the Licence is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the Licence for the specific language governing permissions and
 * limitations under the Licence.
 * 
 * Contributors:
 * Johannes Spazier (GFZ) - initial implementation
 * Sven Reissland (GFZ) - initial implementation
 * Martin Hammitzsch (GFZ) - initial implementation
 */

	$user = $_POST['user'];
	$password = $_POST['password'];
?>
<!DOCTYPE html>
<html>
<head>
	<title>GeoPeril</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="../css/bootstrap.css" rel="stylesheet">
	<link href="../geohazard.css" rel="stylesheet">
	<link href="//netdna.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet">
	<script src="https://code.jquery.com/jquery.js"></script>
    <script src="../jquery.cookie.js"></script>
    <script type="text/javascript">
 		function signin( user, password ) {
	    	$.ajax({
				type : 'POST',
				url : '../srv/signin',
				data : {
					username : user,
					password : password
				},
				dataType : 'json',
				success : function(result) {
					console.log( result );
					if( result.status == "success" || result.nologin )
						//history.go(-1);
						document.location.reload(false);
				}
	    	});
 		}

 		function submit() {
 			signin( $('#txt_user').val(), $('#txt_password').val() );
 		}

 		window.onload = function() {
 			/* accept enter key on splash screen to log in */
         		$('#txt_password, #txt_user').keypress(function(e) {
                 	if (e.which == 13)
                         	$('#btn_signin').click();
         		});
	 		var user = <?php echo "\"$user\""; ?>;
	 		var password = <?php echo "\"$password\""; ?>;
	 		if( user && password )
	 			signin( user, password );
	 		$('#btn_signin').click( submit );
 		};
    </script>
    <style type="text/css">
    	.outside, .wrapper, .border {
    		height: 100%;
    	}
    	.container {
     		height: 100%;
     		overflow-x: hidden;
     		overflow-y: auto;
    	}
    	.eqinfo-logo {
			width: auto;
			height: 40px;
		}
    	.login {
    		margin: auto;
    		width: 400px;
    		text-align: center;
    		margin-top: 5em;
    	}
    	.login .icon {
    		font-size: 4em;
    	}
    	.login button {
    		margin-top: 0.5em;
    		margin-bottom: 0.5em;
    		width: 100%;
    	}
    	.login .links a {
    		padding-right: 1em;
    	}
    	.login .links span {
    		padding-right: 1em;
    	}
    </style>
</head>
<body>
	<div class="outside">
	<div class="wrapper">
	<div class="border">
	<div class="container fullsize">

		<div class="row gfz-head">
  			<img class="gfz-logo pull-left" alt="GFZ Logo" src="../img/logo_gfz_en.gif">
  			<img class="gfz-wordmark pull-right" alt="GFZ Wordmark" src="../img/wordmark_gfz_en.gif">
  		</div>
  		<hr>
	  	<div class="headline">
	  		<ul class="head-blk head-right">
				<li><a href="http://geofon.gfz-potsdam.de/eqinfo/list.php?mode=mt" target="_blank">GEOFON</a></li>
				<li class="divider"><span>|</span></li>
				<li><a href="http://localhost/" target="_blank">GeoPeril</a></li>
				<li class="divider"><span>|</span></li>
				<li><a href="http://kinherd.org" target="_blank">KINHERD</a></li>
	  		</ul>
	  		<ul class="clear"></ul>
	  	</div> <!-- end of headline -->
		<hr>

		<div class="row content" id="content">
			<div class="login">
	  			<h3 class="form">Welcome to <b>EQ Info</b></h3>
	  			<h4 class="form">Sign in with your GeoPeril account</h4>
	  			<div class="icon form">
	  				<i class="fa fa-user"></i>
	  			</div>
	  			<p id="splashStatus" class="form-control-static form"></p>
		  		<input id="txt_user" type="text" class="form-control form" placeholder="E-Mail" required>
			  	<input id="txt_password" type="password" class="form-control form" placeholder="Password" required>
			  	<button id="btn_signin" type="button" class="btn btn-primary form">Sign In</button>
			  	<span class="links">
			  		<a href="mailto:localhost?subject=Get%20account%20for%20GeoPeril">Get Account</a>
			  	</span>
  			</div>

		</div>

	</div>
	</div>
	</div>
	</div>
</body>
</html>
