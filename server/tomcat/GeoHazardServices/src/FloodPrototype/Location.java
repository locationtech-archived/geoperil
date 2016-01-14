package FloodPrototype;

import java.util.ArrayList;

public class Location {
	private int id;
	private int numbers;
	private int X1;
	private int Y1;
	private int X2;
	private int Y2;
	private int X3;
	private int Y3;
	private ArrayList<Double> hydros;
	
	public int getId() {
		return id;
	}
	
	public int getNumbers() {
		return numbers;
	}
	
	public int getX1() {
		return X1;
	}
	
	public int getY1() {
		return Y1;
	}
	
	public int getX2() {
		return X2;
	}
	
	public int getY2() {
		return Y2;
	}
	
	public int getX3() {
		return X3;
	}
	
	public int getY3() {
		return Y3;
	}
	
	public ArrayList<Double> getHydros() {
		return hydros;
	}
	
	@Override
	public String toString() {
		return	"id: " + id + " numbers: " + numbers + " X1: " + X1 + " Y1: " + Y1 + " X2: " + X2 + " Y2: " + Y2 + " X3: " + X3 + " Y3: " + Y3 + " Hydros: " + hydros;
	}
}
