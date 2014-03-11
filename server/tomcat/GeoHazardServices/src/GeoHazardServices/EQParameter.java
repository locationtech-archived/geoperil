package GeoHazardServices;

import java.io.StringWriter;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.w3c.dom.Document;
import org.w3c.dom.Element;


public class EQParameter {

	public double lon;
	public double lat;
	public double mw;
	public double depth;
	public double dip;
	public double strike;
	public double rake;
	
	private String xml;
	
	public EQParameter() {
		
		fill( 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0 );
	}
	
	public EQParameter( double lon, double lat, double mw, double depth,
						double dip, double strike, double rake) {
		
		fill( lon, lat, mw, depth, dip, strike, rake );
	}
	
	public void fill( double lon, double lat, double mw, double depth,
					  double dip, double strike, double rake ) {
		
		this.lon = lon;
		this.lat = lat;
		this.mw = mw;
		this.depth = depth;
		this.dip = dip;
		this.strike = strike;
		this.rake = rake;
		
		this.xml = createXML();
	}
	
	@Override
	public String toString() {
		
		return new String( "Longitude: " + lon + " Latitude: " + lat + " Magnitude (mw): " + mw +
						   " Depth: " + depth + " Dip: " + dip + " Strike: " + strike + " Rake: " + rake);
	}
		
	public String getXML() {
		return xml;
	}
	
	private String createXML() {
		
		String output = null;
		
		try {
			
			DocumentBuilderFactory docFactory = DocumentBuilderFactory.newInstance();
			DocumentBuilder docBuilder = docFactory.newDocumentBuilder();
			
			Document doc = docBuilder.newDocument();
			Element rootElement = doc.createElement("EQParameter");
			doc.appendChild(rootElement);
			
			addXmlEntry( doc, "Longitude", this.lon);
			addXmlEntry( doc, "Latitude", this.lat);
			addXmlEntry( doc, "Magnitude", this.mw);
			addXmlEntry( doc, "Depth", this.depth);
			addXmlEntry( doc, "Dip", this.dip);
			addXmlEntry( doc, "Strike", this.strike);
			addXmlEntry( doc, "Rake", this.rake);
			
			TransformerFactory transformerFactory = TransformerFactory.newInstance();
			Transformer transformer = transformerFactory.newTransformer();
			transformer.setOutputProperty(OutputKeys.INDENT, "yes");
			transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "4");
			
			StringWriter writer = new StringWriter();
			transformer.transform(new DOMSource(doc), new StreamResult(writer));
			
			output = new String( writer.getBuffer().toString() );
									
		} catch (ParserConfigurationException pce) {
			pce.printStackTrace();
		} catch (TransformerException tfe) {
			tfe.printStackTrace();
		}
		
		return output;
	}
	
	private void addXmlEntry( Document doc, String strElem, double val ) {
	
		Element root = doc.getDocumentElement();
		Element elem = doc.createElement( strElem );
		elem.appendChild( doc.createTextNode( Double.toString(val) ) );
		root.appendChild(elem);
	}
}
