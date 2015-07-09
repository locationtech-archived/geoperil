<!DOCTYPE html>
<html>
<head>
<title>GEOFON Event</title>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<base target="_blank"/>
<style>
	.sections {
		min-width: 500px;
		max-width: 600px;
		margin: auto;
		padding-top: 0px;
		text-align: center;
	}
	.sections > h3 {
		background-color: white;
		color: white;
 		padding: 0.5em;
                margin: 0px;
		font-weight: bold;
		width: calc(100%-1em);
	}
	.sections > h3 a {
		color: #428bca;
		text-align: right;
 		font-size: 14px;
		float: right;
	}
</style>
</head>
<body>

<div class="sections">
<?php
	$evtid = htmlspecialchars($_GET["id"]);
	$file = 'http://geofon.gfz-potsdam.de/eqinfo/event.php?id='. $evtid;
	$geofon = file_get_contents($file);
	$geofon = str_replace("='/data/", "='http://geofon.gfz-potsdam.de/data/", $geofon);
	$geofon = str_replace("=\"/eqinfo/", "=\"http://geofon.gfz-potsdam.de/eqinfo/", $geofon);
	$geofon = str_replace("<a href='list.php'>Back to the earthquake list</a><br />", "", $geofon);
	//$geofon = str_replace("<a href", "<a "
	preg_match('/<div id="GEcontent">(.*?)<\/div> <!-- GEcontent -->/s', $geofon, $div);
?>
<h3 id="geofon">GEOFON
	<?php if( ! empty( $div[1] ) ) : ?>
		<a href="<?php echo $file;?>">Go to source</a>
	<?php endif;?>
</h3>
<div class="sec">
<?php
	if( empty( $div[1] ) )
		echo "<b>No data available.</b>";
	echo $div[1];
?>
</div>
</div>

</body>
</html>
