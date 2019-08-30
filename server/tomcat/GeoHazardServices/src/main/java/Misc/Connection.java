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

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;

public abstract class Connection {
    protected Process process;
    protected PrintStream out;
    protected BufferedReader in;
    protected byte[] buffer;
    protected String dir;

    private final int bufferSize = 512 * 1024;

    Connection(final String chdir) throws IOException {
        this.dir = chdir;
    }

    public final PrintStream out() {
        return out;
    }

    public final BufferedReader in() {
        return in;
    }

    /**
     * Connect method.
     * @throws IOException Can occur while reading stream
     */
    public void connect() throws IOException {
        out = new PrintStream(process.getOutputStream());
        in = new BufferedReader(
            new InputStreamReader(process.getInputStream())
        );
        buffer = new byte[bufferSize];

        System.out.println("cd " + dir);
        out.println("cd " + dir);
        out.println("echo '\004'");
        out.flush();
        complete();
    }

    public final int complete() {
        out.flush();
        try {
            String line;

            do {
                line = in.readLine();
            } while (line != null && !line.equals("\004"));
        } catch (IOException e) {
            return 1;
        }
        return 0;
    }

    public final void close() {
        out.println("exit");
        out.flush();
    }

    public final List<String> runCmds(final String... cmds) throws IOException {
        List<String> lines = new ArrayList<String>();
        for (String cmd: cmds) {
            lines.addAll(runCmd(cmd));
        }
        return lines;
    }

    public final List<String> runCmd(final String cmd) throws IOException {
        List<String> lines = new ArrayList<String>();
        String line;

        runLiveCmd(cmd);

        while ((line = nextLine()) != null) {
            lines.add(line);
        }

        if (lines.size() > 0) {
            /* Remove inserted newline from the result. */
            lines.remove(lines.size() - 1);
        }

        return lines;
    }

    public final void runLiveCmd(final String cmd) throws IOException {
        /* Run command. */
        out.println(cmd + "; __RET=$?");
        /* Force newline before \004! */
        out.println("echo '\n\004'");
        out.flush();
    }

    public final int returnValue() throws IOException {
        List<String> ret = this.runCmd("echo ${__RET}");

        if (ret.size() > 0) {
            return Integer.valueOf(ret.get(0)).intValue();
        }

        return -1;
    }

    public final String nextLine() throws IOException {
        String line = in.readLine();
        if (line == null || line.equals("\004")) {
            return null;
        }
        return line;
    }

    public final List<String> readFile(final String fname) throws IOException {
        return runCmd("cat " + fname);
    }

    public final void writeFile(final String content, final String fname) {
        out.println("echo '" + content + "' > " + fname);
        out.flush();
    }

    public final int copyFile(final String src, final String dst) {
        /* TODO: '\n' can be important if previous program does not issue a
         * final newline - check this for all cases */
        out.println("echo '\n\004'");
        complete();
        out.println("cat " + src);
        out.println("echo -n '\004'");
        out.flush();
        /* Use BufferedInputStream to read file in binary mode! */
        BufferedInputStream bin = new BufferedInputStream(
            process.getInputStream()
        );
        try {
            BufferedOutputStream writer = new BufferedOutputStream(
                new FileOutputStream(dst)
            );
            int ret = bin.read(buffer, 0, buffer.length);
            while (ret > 0) {
                if (buffer[ ret - 1 ] == '\004') {
                    ret -= 1;
                    writer.write(buffer, 0, ret);
                    break;
                }
                writer.write(buffer, 0, ret);
                ret = bin.read(buffer, 0, buffer.length);
            }
            writer.close();
        } catch (IOException e) {
            e.printStackTrace();
            return 1;
        }

        return 0;
    }
}
