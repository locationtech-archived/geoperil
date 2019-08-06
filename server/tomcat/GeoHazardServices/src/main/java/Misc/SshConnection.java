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

package Misc;

import java.io.File;
import java.io.IOException;

public final class SshConnection extends Connection {
    private String ssh;

    public SshConnection(
        final String user,
        final String host,
        final String dir
    ) throws IOException {
        super(dir);
        this.ssh = "ssh " + user + "@" + host;
        connect();
    }

    @Override
    public void connect() throws IOException {
        File tmp = File.createTempFile("worker", "log");
        System.out.println("sh " + tmp.getAbsolutePath());
        process = new ProcessBuilder(ssh.split(" ")).redirectError(tmp).start();
        super.connect();
    }
}
