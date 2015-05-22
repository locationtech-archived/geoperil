<?php 
	$user = $_POST['user'];	
	$password = $_POST['password'];
?>
<!DOCTYPE html>
<html>
<head>
	<title>TRIDEC Cloud</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="../css/bootstrap.css" rel="stylesheet">
	<link href="../geohazardcloud.css" rel="stylesheet">
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
	  		<ul class="head-blk head-left head-img">
	  			<li><img class="eqinfo-logo" alt="TRIDEC Cloud" src="../img/eqinfo-logo.png"></li>
	  		</ul>
	  		<ul class="head-blk head-right">
				<li><a href="http://trideccloud.gfz-potsdam.de/" target="_blank">TRIDEC Cloud</a></li>
				<li class="divider"><span>|</span></li>
				<li><a href="http://geofon.gfz-potsdam.de/eqinfo/list.php?mode=mt" target="_blank">GEOFON</a></li>
				<li class="divider"><span>|</span></li>
				<li><a href="http://www.gfz-potsdam.de/en/imprint" target="_blank">Imprint</a></li>
	  		</ul>
	  		<ul class="clear"></ul>
	  	</div> <!-- end of headline -->
		<hr>
		
		<div class="row content" id="content">
			
			<div class="login">
	  			<h3 class="form">Welcome to <b>EQ Info</b></h3>
	  			<h4 class="form">Sign in with your TRIDEC Cloud account</h4>
	  			<div class="icon form">
	  				<i class="fa fa-user"></i>
	  			</div>
	  			<p id="splashStatus" class="form-control-static form"></p>
		  		<input id="txt_user" type="text" class="form-control form" placeholder="E-Mail" required>
			  	<input id="txt_password" type="password" class="form-control form" placeholder="Password" required>
			  	<button id="btn_signin" type="button" class="btn btn-primary form">Sign In</button>
			  	<span class="links">
			  		<a href="mailto:tridec-cloud-support@gfz-potsdam.de?subject=Get%20account%20for%20TRIDEC%20Cloud&amp;body=Hello%20you%2C%0D%0A%0D%0AI%20am%20totally%20excited%20about%20EQ%20Info%20and%20would%20like%20to%20get%20an%20account%2E%0D%0A%0D%0ACheers">Get Account</a>
			  		<span>&#183;</span>
			  		<a href="mailto:tridec-cloud-subscribe@gfz-potsdam.de?subject=Subscribe%20request%20for%20TRIDEC%20Cloud%20mailing%20list&amp;body=Please%20subscribe%20me%20to%20tridec-cloud@gfz-potsdam.de%0D%0A%0D%0A">Join List</a>
			  		<span>&#183;</span>
			  		<a href="mailto:tridec-cloud-support@gfz-potsdam.de?subject=Need%20more%20information%20on%20TRIDEC%20Cloud&amp;body=Hello%20you%2C%0D%0A%0D%0AI%20am%20totally%20excited%20about%20EQ%20Info%20and%20would%20like%20to%20get%20more%20information%2E%0D%0A%0D%0ACheers">Mail Us</a>
			  	</span>
  			</div>
			
		</div>
		
	</div>
	</div>
	</div>
	</div>
</body>
</html>
