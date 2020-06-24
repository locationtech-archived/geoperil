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

package FloodPrototype;

import java.util.ArrayList;

public final class Location {
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
        return    "id: " + id + " numbers: " + numbers + " X1: " + X1 + " Y1: "
        + Y1 + " X2: " + X2 + " Y2: " + Y2 + " X3: " + X3 + " Y3: " + Y3
        + " Hydros: " + hydros;
    }
}
