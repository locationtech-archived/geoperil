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

/* checks whether IP is 127.0.0.1 or starts with 139.17. */
function check_ip() {
	if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
		$ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
	} else {
		$ip = $_SERVER['REMOTE_ADDR'];
	}

	return ($ip == '127.0.0.1' || strpos($ip,'139.17.') === 0);
}

function server_name() {
	if (isset($_SERVER['HTTP_X_FORWARDED_SERVER'])) {
			return $_SERVER['HTTP_X_FORWARDED_SERVER'];
	} else {
			return $_SERVER['SERVER_NAME'];
	}
}

function ajax($url,$data) {
	$content = http_build_query($data);
	$opts = array(
		'http'=> array(
			'method' => "POST",
			'header' => "Content-type: application/x-www-form-urlencoded\r\n"
				. "Content-length: " . strlen($content) . "\r\n"
				. "Cookie: " . $_SERVER['HTTP_COOKIE'] . "\r\n",
			'content' => $content
		)
	);
	$context = stream_context_create($opts);
	$result = file_get_contents($url, false, $context);
	return json_decode($result, TRUE);
}

function post_url($url,$data,$content_type="text/plain") {
	$opts = array(
		'http'=> array(
			'method' => "POST",
			'header' => "Content-type: ".$content_type."\r\n"
				. "Content-length: " . strlen($data) . "\r\n"
				. "Cookie: " . $_SERVER['HTTP_COOKIE'] . "\r\n",
			'content' => $data
		)
	);
	$context = stream_context_create($opts);
	$result = file_get_contents($url, false, $context);
	return $result;
}

function get_url($url) {
	$opts = array(
		'http'=> array(
			'method' => "GET",
		)
	);
	$context = stream_context_create($opts);
	$result = file_get_contents($url, false, $context);
	return json_decode($result, TRUE);
}

function array_time_sort($a,$b) {
	if ( (! isset($a['time'])) || (! isset($b['time'])) || ($a['time'] == $b['time'])) {
		return 0;
	}
	return ($a['time'] < $b['time']) ? -1 : 1;
}

function do_post_request($url, $data)
{
	$params = array( 'http' => array(
		'method' => 'POST',
		'content' => http_build_query($data)
	));
	$ctx = stream_context_create($params);
	$fp = @fopen($url, 'rb', false, $ctx);
	if (!$fp) {
		throw new Exception("Problem with $url, $php_errormsg");
	}
	$response = @stream_get_contents($fp);
	if ($response === false) {
		throw new Exception("Problem reading data from $url, $php_errormsg");
	}
	return $response;
}

$ret = ajax('https://'. server_name() .'/srv/session', array() );

if( $ret['status'] != 'success' && ! $ret['nologin'] ) {
	$data = null;
	if( check_ip() === False ) {
		/* user needs to enter its credentials */
		$data = array();
	} else {
		/* auto-login with special user provided for cases outside the production environment */
		$data = array(
			'user' => 'nologin',
			'password' => '123456'
		);
	}
	/* redirect to login form - it is important to use the absolute url here,
	 * because the server will deliver PHP code otherwise !!! */
	echo do_post_request('https://' . server_name() . '/eqinfo/login.php', $data);
	die();
}

/* user was authorized successfully */
?>

<!DOCTYPE html>
<html>
<head>
<title>EQ-Info</title>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<link href="//stackpath.bootstrapcdn.com/bootstrap/3.0.3/css/bootstrap.min.css" rel="stylesheet">
<link href="../geohazard.css" rel="stylesheet">
<link rel="stylesheet" href="//openlayers.org/en/v3.4.0/css/ol.css" type="text/css">
<style>
	.headline-fixed {
		position: fixed;
		left: 0px;
		top: 0px;
		width: 100%;
		z-index: 1;
	}
	.headline-abs {
		position: absolute;
		left: 0px;
		width: 100%;
	}
	.headline {
		position: relative;
		width: calc(90% - 30px);
		margin-left: calc(5% + 15px);
		background-color: white;
		z-index: 1;
	}
	.eqinfo-logo {
		width: auto;
		height: 40px;
	}
	tr.head {
		background-color: #00589C;
		color: white;
	}
	tr.head th {
		text-align: right;
	}
	tr.head th.left {
		text-align: left;
	}
	tr.row-even {
		background-color: white;
	}
	tr.row-odd {
		background-color: #dddddd;
	}
	table {
		border-collapse: collapse;
	}
	.content {
		padding-top: 5em;
		width: 95%;
		max-width: 1500px;
		margin: auto;
	}
	.nav-cover {
		position: relative;
		width: 18%;
		height: 1px;
		float: left;
	}
	ul.nav {
		width: 100%;
		position: absolute;
		padding-top: 1.5em;
		top: 0px;
	}
	ul.nav.fixed {
		position: fixed;
		width: inherit;
	}
	ul.nav li {
		background-color: #00589C;
		padding: 5px;
		color: white;
		border-bottom: 1px solid #4CA8CD;
	}
	ul.nav li a {
		color: white;
		font-weight: bold;
		padding: 0px;
	}
	ul.nav li a:hover {
		color: #F60;
		background: transparent;
	}
	ul.nav li.back {
		margin-top: 0.5em;
		background-color: #4CA8CD;
	}
	.sections {
		width: 80%;
		float: right;
		padding: 2em;
		padding-top: 0px;
	}
	.sections > h3 {
		background-color: #00589C;
		color: white;
		padding: 0.5em;
		font-weight: bold;
		width: 100%;
	}
	.sections > h3 a {
		color: white;
		text-align: right;
		font-size: 14px;
		float: right;
	}
	.sec.geoperil img {
		margin-left: 50px;
		width: 90%;
	}
	.sec.geoperil pre {
		width: 90%;
		white-space: pre-wrap;
		margin-left: 50px;
		padding: 1em;
		background-color: #eeeeee;
	}
	.sec.geoperil dl {
		margin-left: 50px;
		margin-right: 50px;
		float: left;
	}
	.sec.geoperil dd {
		margin-left: 25px;
		padding-bottom: 10px;
	}
	.sec.geoperil .clear {
		clear: both;
	}
	.sec > b {
		margin-left: 25px;
	}
	.sec.hazards dl {
		margin-left: 50px;
		margin-right: 50px;
	}
	.sec.hazards dd {
		margin-left: 25px;
		padding-bottom: 10px;
	}
	.sec.hazards h3.provider img {
		height: 1.5em;
		padding-right: 0.8em;
	}
	#mapview, #olmap {
		height: 300px;
		width: 100%;
		margin: auto;
	}
</style>
<script src="//maps.googleapis.com/maps/api/js?key=AIzaSyCRRGvXI8yyuNgzb3nuQsNEcA8oIBd50WM&v=3.exp"></script>
<script src="//openlayers.org/en/v3.4.0/build/ol.js" type="text/javascript"></script>
<script type="text/javascript">
	window.onscroll = function () {
		var scrollPos = document.body.scrollTop;
		var headline = document.getElementById("headline-fixed");
		var gfz_head = document.getElementById("gfz-head");
		var nav = document.getElementById("nav");
		var nav_cover = document.getElementById("nav-cover");

		if( scrollPos > gfz_head.clientHeight ) {
			headline.className = "headline-fixed";
<?php if( isset( $_GET["id"] ) ) : ?>
			var top1 = nav_cover.getBoundingClientRect().top;
			var top2 = gfz_head.getBoundingClientRect().top;
			nav.style.top = (top1 - top2 - gfz_head.clientHeight) + "px";
			nav.style.width = nav_cover.clientWidth + "px";
			nav.className = "nav fixed";
<?php endif; ?>
		} else {
			headline.className = "headline-abs";
<?php if( isset( $_GET["id"] ) ) : ?>
			nav.className = "nav";
			nav.style.top = "";
<?php endif; ?>
		}
	};
</script>
</head>
<body>
	<div class="outside">
	<div class="wrapper">
	<div class="border">
	<div class="container fullsize">
		<div id="gfz-head" class="row gfz-head">
			<img class="gfz-logo pull-left" alt="GFZ Logo" src="../img/logo_gfz_en.gif">
			<img class="gfz-wordmark pull-right" alt="GFZ Wordmark" src="../img/wordmark_gfz_en.gif">
		</div>
		<hr>
		<div id="headline-fixed" class="headline-abs">
		<div class="headline">
			<ul class="head-blk head-right">
				<li><a href="http://geofon.gfz-potsdam.de/eqinfo/list.php?mode=mt" target="_blank">GEOFON</a></li>
				<li class="divider"><span>|</span></li>
				<?php if( check_ip() ): ?>
				<li><a href="http://eq.gfz-potsdam.de/" target="_blank">EQUATOR II</a></li>
				<li class="divider"><span>|</span></li>
				<?php endif; ?>
				<li><a href="http://localhost/" target="_blank">GeoPeril</a></li>
				<li class="divider"><span>|</span></li>
				<li><a href="http://kinherd.org" target="_blank">KINHERD</a></li>
			</ul>
			<ul class="clear"></ul>
			<hr>
		</div> <!-- end of headline -->
		</div> <!-- end of headline-fixed -->

		<div class="row content">

<?php
if( ! isset( $_GET["id"] ) ) :
?>
<table cellpadding="5" width="100%">
<tr class="head">
	<th class="left"><strong>Origin Time</strong><br />UTC </th>
	<th><strong>Mag</strong></th>
	<th><strong>Latitude</strong><br />degrees</th>
	<th><strong>Longitude</strong><br />degrees</th>
	<th><strong>Depth</strong><br />km</th>
	<th>&nbsp;</th>
	<th class="left"><strong>Flinn-Engdahl Region Name</strong></th>
</tr>
<?php
	$ret = ajax(
		'https://'. server_name() .'/webguisrv/get_events',
		array( 'limit' => 50, "inst" => "gfz" )
	);
	$row = "row-even";
	foreach( $ret['events'] as $event ) {
		$prop = $event['prop'];
		echo "<tr class=\"$row\">\n";
		echo "  <td align='left'><a href=\"?id=". $event['id'] ."\">" . mb_strimwidth($prop['date'], 0, 19) . "</a></td>\n";
		echo "  <td align='right'>" . $prop['magnitude'] . "</td>\n";
		echo "  <td align='right'>" . $prop['latitude'] . "</td>\n";
		echo "  <td align='right'>" . $prop['longitude'] . "</td>\n";
		echo "  <td align='right'>" . $prop['depth'] . "</td>\n";
		echo "  <td>" . "</td>\n";
		echo "  <td align='left'>" . $prop['region'] . "</td>\n";
		echo "</tr>\n";
		$row = $row == "row-even" ? "row-odd" : "row-even";
	}
?>
</table>
<?php else : ?>

<?php
	$evtid = htmlspecialchars( $_GET["id"] );
	$url = 'https://'. server_name() .'/webguisrv/get_event_info';
	$data = array(
		'apikey' => "6fc1358f8d505c34bce1eaa466e1d179",
		'evid' => $evtid
	);
	$ret = ajax($url,$data);
	$eq = $ret['eq'];
	$msg = $ret['msg'];
?>

<div>
<div id="nav-cover" class="nav-cover">
<ul id="nav" class="nav">
	<li><a href="#geofon">GEOFON</a></li>
	<?php if( check_ip() ): ?>
		<li><a href="#equator2">Equator II</a></li>
	<?php endif; ?>
	<li><a href="#geoperil">GeoPeril</a></li>
	<li><a href="#kinherd">KINHERD</a></li>
	<li><a href="#hazards">Other Sources</a></li>
	<?php if( check_ip() ): ?>
		<li><a href="#eq-context">EQ in Context</a></li>
	<?php endif; ?>
	<li class="back"><a href=".">&#10094; &nbsp; Back to list</a></li>
</ul>
</div>
</div>
<div class="sections">
	<?php
		$file = 'http://geofon.gfz-potsdam.de/eqinfo/event.php?id='. $eq['geofonid'];
		$geofon = file_get_contents($file);
		$geofon = str_replace("='/data/", "='http://geofon.gfz-potsdam.de/data/", $geofon);
		$geofon = str_replace("=\"/eqinfo/", "=\"http://geofon.gfz-potsdam.de/eqinfo/", $geofon);
		$geofon = str_replace("<a href='list.php'>Back to the earthquake list</a><br />", "", $geofon);
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

	<?php if( check_ip() ): ?>
	<h3 id="equator2">Equator II
		<?php if( ! empty( $div[1] ) ) : ?>
			<a href="http://eq.gfz-potsdam.de/#/events/<?php echo $eq['geofonid'];?>/">Go to source</a>
		<?php endif;?>
	</h3>
	<div class="sec">
		<?php if( true ): ?>
		<?php
		$url = "http://eq.gfz-potsdam.de/events/".$eq['geofonid'];
		if (! file_get_contents($url)) {
			post_url($url,'{"eid":"'.$eq['geofonid'].'"}',"application/json");
			echo "<b>Computation startet. Please reload in 60 seconds.</b>";
		} else {
		?>
		<h3>Epicenter and source mechanism</h3>
		<img src="http://eq.gfz-potsdam.de/events/<?php echo $eq['geofonid'];?>/maps/location.png">
		<h4>Description</h4>
		<p>
		<?php
			$ret = get_url("http://eq.gfz-potsdam.de/comments/".$eq['geofonid']."/location");
			usort($ret, "array_time_sort");
			$ret = array_pop($ret);
			echo $ret ? $ret['text'] : "No data available.";
		?>
		</p>
		<h3>Seismotectonics</h3>
		<img src="http://eq.gfz-potsdam.de/events/<?php echo $eq['geofonid'];?>/maps/region.png">
		<h4>Plate boundaries, faults, geology</h4>
		<p>
		<?php
			$ret = get_url("http://eq.gfz-potsdam.de/comments/".$eq['geofonid']."/region_geology");
			usort($ret, "array_time_sort");
			$ret = array_pop($ret);
			echo $ret ? $ret['text'] : "No data available.";
		?>
		</p>
		<h4>Regional seismicity and zones</h4>
		<p>
		<?php
			$ret = get_url("http://eq.gfz-potsdam.de/comments/".$eq['geofonid']."/region_seismicity");
			usort($ret, "array_time_sort");
			$ret = array_pop($ret);
			echo $ret ? $ret['text'] : "No data available.";
		?>
		</p>
		<h4>Historical earthquakes</h4>
		<p>
		<?php
			$ret = get_url("http://eq.gfz-potsdam.de/comments/".$eq['geofonid']."/region_historical");
			usort($ret, "array_time_sort");
			$ret = array_pop($ret);
			echo $ret ? $ret['text'] : "No data available.";
		?>
		</p>
		<h3>Hazard</h3>
		<img src="http://eq.gfz-potsdam.de/events/<?php echo $eq['geofonid'];?>/maps/gshap.png">
		<h4>GSHAP map description</h4>
		<p>
		<?php
			$ret = get_url("http://eq.gfz-potsdam.de/comments/".$eq['geofonid']."/hazard_description");
			usort($ret, "array_time_sort");
			$ret = array_pop($ret);
			echo $ret ? $ret['text'] : "No data available.";
		?>
		</p>
		<h4>Statistical hazard</h4>
		<p>
		<?php
			$ret = get_url("http://eq.gfz-potsdam.de/comments/".$eq['geofonid']."/hazard_statistics");
			usort($ret, "array_time_sort");
			$ret = array_pop($ret);
			echo $ret ? $ret['text'] : "No data available.";
		?>
		</p>
		<h4>Damage</h4>
		<p>
		<?php
			$ret = get_url("http://eq.gfz-potsdam.de/comments/".$eq['geofonid']."/hazard_damage");
			usort($ret, "array_time_sort");
			$ret = array_pop($ret);
			echo $ret ? $ret['text'] : "No data available.";
		?>
		</p>
		<?php
		}
		?>
		<?php endif; ?>
	</div>
	<?php endif; ?>

	<h3 id="geoperil">GeoPeril
		<?php if( ! empty($eq['simulation']) ) : ?>
			<a href="<?php echo $eq['simulation']['shared_link'];?>">Go to source</a>
		<?php endif; ?>
	</h3>
	<div class="sec geoperil">
		<?php if( ! empty($eq['geofonid']) ) : ?>
		<h3><?php echo $eq['prop']['region']; ?></h3>
		<dl>
			<dt>Event ID</dt>
			<dd><?php echo $eq['evid']; ?></dd>
			<dt>Date</dt>
			<dd><?php echo $eq['prop']['date']; ?></dd>
			<dt>Magnitude</dt>
			<dd><?php echo $eq['prop']['magnitude']; ?></dd>
			<dt>Coordinates</dt>
			<dd>
			<?php echo 'Lat: '. $eq['prop']['latitude'];?>&deg;,
			<?php echo 'Lon: '. $eq['prop']['longitude'];?>&deg;
			</dd>
			<dt>Depth</dt>
			<dd><?php echo $eq['prop']['depth']; ?> km</dd>
			<dt>Fault</dt>
			<?php if( ! empty($eq['simulation']) ) : ?>
			<dd>Dip: <?php echo $eq['prop']['dip']; ?> &deg;</dd>
			<dd>Strike: <?php echo $eq['prop']['strike']; ?> &deg;</dd>
			<dd>Rake: <?php echo $eq['prop']['rake']; ?> &deg;</dd>
			<?php else:?>
			<dd>-</dd>
			<?php endif;?>
		</dl>
		<?php
			$sim = ! empty($eq['simulation']);
			$simTime = $sim ? $eq['simulation']['simTime'] .' min' : 'No simulation available.';
			$resources = $sim ? $eq['simulation']['resources'] : '-';
			$calcTime = $sim ? $eq['simulation']['calcTime'] / 1000 .' sec' : '-';
		?>
		<dl>
			<dt>Simulation</dt>
			<dd><?php echo $simTime; ?></dd>
			<dt>Resource</dt>
			<dd><?php echo $resources; ?></dd>
			<dt>Computation time</dt>
			<dd><?php echo $calcTime; ?></dd>
			<dt>Bounding box</dt>
			<?php if( ! empty($eq['simulation']) ) : ?>
			<dd>LatMin: <?php echo $eq['simulation']['grid_dim']['latMin']; ?> &deg;</dd>
			<dd>LatMax: <?php echo $eq['simulation']['grid_dim']['latMax']; ?> &deg;</dd>
			<dd>LonMin: <?php echo $eq['simulation']['grid_dim']['lonMin']; ?> &deg;</dd>
			<dd>LonMax: <?php echo $eq['simulation']['grid_dim']['lonMax']; ?> &deg;</dd>
			<?php else:?>
			<dd>-</dd>
			<?php endif;?>
		</dl>
		<div class="clear"></div>
		<?php endif;?>
		<?php if( ! empty($eq['simulation']) ) : ?>
		<h3>Map</h3>
		<img src="<?php echo $eq['simulation']['image_url']; ?>" alt="tsunami-jets" />
		<h3>Message text</h3>
		<pre><?php echo $msg; ?></pre>
		<?php else:?>
		<h3>Map</h3>
		<b>No simulation available.</b>
		<h3>Message text</h3>
		<b>No simulation available.</b>
		<?php endif;?>
	</div>
	<?php
		$file = 'http://kinherd.org/events/'. $eq['geofonid'] .'/report.html';
		$kinherd = file_get_contents($file);
		$kinherd = str_replace("=\"work/", "=\"http://kinherd.org/events/". $eq['geofonid'] ."/work/", $kinherd);
		preg_match('/<body[^>]*>(.*?)<\/body>/s', $kinherd, $body);
	?>
	<h3 id="kinherd">KINHERD
		<?php if( ! empty( $body[1] ) ) : ?>
			<a href="<?php echo $file;?>">Go to source</a>
		<?php endif;?>
	</h3>
	<div class="sec">
	<?php
		if( empty( $body[1] ) )
			echo "<b>No data available.</b>";
		echo $body[1];
	?>
	</div>
	<h3 id="hazards">Other Sources</h3>
	<div class="sec hazards">
	<?php
		$url = 'https://'. server_name() .'/webguisrv/gethazardevents';
		$data = array(
			'eventtype' => 'EQ',
			'y' => $eq['prop']['latitude'],
			'x' => $eq['prop']['longitude'],
			'mag' => $eq['prop']['magnitude'],
			'time' => strtotime($eq['prop']['date'] . 'UTC')
		);
		$ret = ajax($url,$data);
	?>
	<script type="text/javascript">
		function initialize() {
	<?php if( empty( $ret['hazard_events'] ) ): ?>
		document.getElementById('mapview').style.display = "none";
	<?php endif; ?>

			var mapOptions = {
				zoom: 8,
				center: new google.maps.LatLng(0,0)
			};
			var map = new google.maps.Map(document.getElementById('mapview'), mapOptions);
			var marker;
			var infowindow;
	<?php
		foreach( $ret['hazard_events'] as $item ) {
	?>
			marker = new google.maps.Marker({
				position: new google.maps.LatLng( <?php echo $item['y'] .",". $item['x']; ?> ),
				map: map,
				title: <?php echo "\"". $item['providername'] . "\""; ?>
			});
			map.setCenter( marker.getPosition() );

			var content =
			<?php
				echo "\"<b>". $item['providername'] ."</b><br>";
				echo "<span>Region: ". $item['region'] ."</span><br>";
				echo "<span>Latitude: ". $item['y'] ." &deg;</span><br>";
				echo "<span>Longitude: ". $item['x'] . " &deg;</span><br>";
				echo "<span>Magnitude: ". $item['mag'] ." ". $item['magtype'] ."</span><br>";
				echo "<span>Depth: ". $item['depth'] ." km</span><br>\"";
			?>;

			infowindow = new google.maps.InfoWindow({
				content: content
			});
			google.maps.event.addListener(marker, 'click', (function(infowindow,marker) {
				infowindow.open(map,marker);
			}).bind(this,infowindow,marker));
	<?php
		}
	?>
		}
		google.maps.event.addDomListener(window, 'load', initialize);
	</script>
	<?php
		echo "<div id=\"mapview\"></div>";
		if( empty( $ret['hazard_events'] ) )
			echo "<b>No data available.</b>";
		else {
			foreach( $ret['hazard_events'] as $item ) {
				echo "<h3 class=\"provider\"><img src=\"logos/". $item['provider'] .".png\" alt=\"logo-". $item['provider'] ."\" />". $item['providername'] ."</h3>";
				echo "<dl>";
				echo "\t<dt>Region</dt>";
				echo "\t<dd>". $item['region'] ."</dd>";
				echo "\t<dt>Event type</dt>";
				echo "\t<dd>". $item['eventtype'] ."</dd>";
				echo "\t<dt>Coordinates</dt>";
				echo "\t<dd>Lat: ". $item['y'] ."&deg;, Lon: ". $item['x'] . "&deg;" ."</dd>";
				echo "\t<dt>Magnitude</dt>";
				echo "\t<dd>". $item['mag'] ." ". $item['magtype'] ."</dd>";
				echo "\t<dt>Depth</dt>";
				echo "\t<dd>". $item['depth'] ." km</dd>";
				if( isset( $item['url'] ) ) {
					echo "\t<dt><a href=\"". $item['url'] ."\">Go to source</a></dt>";
					echo "\t<dd></dd>";
				}
				echo "</dl>";
			}
		}
	?>
	</div>
	<?php if( check_ip() ): ?>
	<h3 id="eq-context">
		EQ in Context <a href="http://eqsrv.gfz-potsdam.de/">Go to source</a>
	</h3>
	<div class="sec eq-context">
		<div id="olmap"></div>
	</div>
	<script type="text/javascript">
		function load_eq_context() {
			var lat = <?php echo $eq['prop']['latitude'];?>;
			var lon = <?php echo $eq['prop']['longitude'];?>;
			var map = new ol.Map({
				target:'olmap',
				renderer:'canvas',
				layers : [
					new ol.layer.Tile({
						source:	new ol.source.TileWMS({
							url: 'http://rz-vm65.gfz-potsdam.de:8080/geoserver/wms',
							params: {
								'LAYERS': 'Quakes:etopo3857',
								'VERSION': '1.1.1'
							}
						})
					})
				],
				view: new ol.View({
					center: ol.proj.transform([lon,lat], 'EPSG:4326', 'EPSG:3857'),
					zoom:3
				})
			});

			map.addLayer(
				new ol.layer.Tile({
					source: new ol.source.TileWMS({
						preload: Infinity,
						url: 'http://rz-vm65.gfz-potsdam.de:8080/geoserver/wms',
						serverType:'geoserver',
						params:{
							'LAYERS':"Quakes:plattengrenzen",
							'TILED':true
						}
					})
				})
			);

			map.addLayer(
				new ol.layer.Tile({
					source: new ol.source.TileWMS({
						preload: Infinity,
						url: 'http://rz-vm65.gfz-potsdam.de:8080/geoserver/wms',
						serverType:'geoserver',
						params:{
							'LAYERS':"Quakes:geofon3857",
							'TILED':true
						}
					}),
					opacity: 0.75
				})
			);

			map.addLayer(
				new ol.layer.Vector({
					source: new ol.source.Vector({
						features: [new ol.Feature({
							geometry: new ol.geom.Point(ol.proj.transform([lon, lat], 'EPSG:4326','EPSG:3857')),
							name: 'quake'
						})]
					}),
					style: new ol.style.Style({
						image: new ol.style.Circle({
							radius: 10,
							stroke:new ol.style.Stroke({
								color:'#FFFFFF',
								width:3
							}),
							fill: new ol.style.Fill({color: '#1E00FF'})
						})
					})
				})
			);
		}
		google.maps.event.addDomListener(window, 'load', load_eq_context);
	</script>
	<?php endif; ?>
</div>
<div style="clear: both;"></div>
</div>
<?php endif; ?>

</div>

</div>
</div>
</div>
</div>
</body>
</html>
