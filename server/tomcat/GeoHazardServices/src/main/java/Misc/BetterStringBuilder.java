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

public final class BetterStringBuilder {
    private StringBuilder builder;

    public BetterStringBuilder() {
        builder = new StringBuilder();
    }

    public BetterStringBuilder append(final boolean b) {
        builder.append(b);
        return this;
    }

    public BetterStringBuilder append(final char c) {
        builder.append(c);
        return this;
    }

    public BetterStringBuilder append(
        final char[] str, final int offset, final int len
    ) {
        builder.append(str, offset, len);
        return this;
    }

    public BetterStringBuilder append(final char[] str) {
        builder.append(str);
        return this;
    }

    public BetterStringBuilder append(
        final CharSequence s, final int start, final int end
    ) {
        builder.append(s, start, end);
        return this;
    }

    public BetterStringBuilder append(final CharSequence s) {
        builder.append(s);
        return this;
    }

    public BetterStringBuilder append(final double d) {
        builder.append(d);
        return this;
    }

    public BetterStringBuilder append(final float f) {
        builder.append(f);
        return this;
    }

    public BetterStringBuilder append(final int i) {
        builder.append(i);
        return this;
    }

    public BetterStringBuilder append(final long lng) {
        builder.append(lng);
        return this;
    }

    public BetterStringBuilder append(final Object obj) {
        builder.append(obj);
        return this;
    }

    public BetterStringBuilder append(final String s) {
        builder.append(s);
        return this;
    }

    public BetterStringBuilder append(final StringBuffer sb) {
        builder.append(sb);
        return this;
    }

    public BetterStringBuilder appendCodePoint(final int codePoint) {
        builder.appendCodePoint(codePoint);
        return this;
    }

    public int capacity() {
        return builder.capacity();
    }

    public char charAt(final int index) {
        return builder.charAt(index);
    }

    public int codePointAt(final int index) {
        return builder.codePointAt(index);
    }

    public int codePointBefore(final int index) {
        return builder.codePointBefore(index);
    }

    public int codePointCount(final int beginIndex, final int endIndex) {
        return builder.codePointCount(beginIndex, endIndex);
    }

    public BetterStringBuilder delete(final int start, final int end) {
        builder.delete(start, end);
        return this;
    }

    public BetterStringBuilder deleteCharAt(final int index) {
        builder.deleteCharAt(index);
        return this;
    }

    public void ensureCapacity(final int minimumCapacity) {
        builder.ensureCapacity(minimumCapacity);
    }

    public boolean equals(final Object obj) {
        return builder.equals(obj);
    }

    public void getChars(
        final int srcBegin,
        final int srcEnd,
        final char[] dst,
        final int dstBegin
    ) {
        builder.getChars(srcBegin, srcEnd, dst, dstBegin);
    }

    public int hashCode() {
        return builder.hashCode();
    }

    public int indexOf(final String str, final int fromIndex) {
        return builder.indexOf(str, fromIndex);
    }

    public int indexOf(final String str) {
        return builder.indexOf(str);
    }

    public BetterStringBuilder insert(final int offset, final boolean b) {
        builder.insert(offset, b);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final char c) {
        builder.insert(offset, c);
        return this;
    }

    public BetterStringBuilder insert(
        final int index,
        final char[] str,
        final int offset,
        final int len
    ) {
        builder.insert(index, str, offset, len);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final char[] str) {
        builder.insert(offset, str);
        return this;
    }

    public BetterStringBuilder insert(
        final int dstOffset,
        final CharSequence s,
        final int start,
        final int end
    ) {
        builder.insert(dstOffset, s, start, end);
        return this;
    }

    public BetterStringBuilder insert(
        final int dstOffset, final CharSequence s
    ) {
        builder.insert(dstOffset, s);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final double d) {
        builder.insert(offset, d);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final float f) {
        builder.insert(offset, f);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final int i) {
        builder.insert(offset, i);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final long l) {
        builder.insert(offset, l);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final Object obj) {
        builder.insert(offset, obj);
        return this;
    }

    public BetterStringBuilder insert(final int offset, final String str) {
        builder.insert(offset, str);
        return this;
    }

    public int lastIndexOf(final String str, final int fromIndex) {
        return builder.lastIndexOf(str, fromIndex);
    }

    public int lastIndexOf(final String str) {
        return builder.lastIndexOf(str);
    }

    public int length() {
        return builder.length();
    }

    public int offsetByCodePoints(final int index, final int codePointOffset) {
        return builder.offsetByCodePoints(index, codePointOffset);
    }

    public BetterStringBuilder replace(
        final int start, final int end, final String str
    ) {
        builder.replace(start, end, str);
        return this;
    }

    public BetterStringBuilder reverse() {
        builder.reverse();
        return this;
    }

    public void setCharAt(final int index, final char ch) {
        builder.setCharAt(index, ch);
    }

    public void setLength(final int newLength) {
        builder.setLength(newLength);
    }

    public CharSequence subSequence(final int start, final int end) {
        return builder.subSequence(start, end);
    }

    public String substring(final int start, final int end) {
        return builder.substring(start, end);
    }

    public String substring(final int start) {
        return builder.substring(start);
    }

    public String toString() {
        return builder.toString();
    }

    public void trimToSize() {
        builder.trimToSize();
    }

    /* Added */
    public BetterStringBuilder appendln(final int i) {
        return this.append(i).newline();
    }

    public BetterStringBuilder appendln(final String s) {
        return this.append(s).newline();
    }

    public BetterStringBuilder newline() {
        return this.append(System.getProperty("line.separator"));
    }

    public BetterStringBuilder appendMany(final String...strings) {
        for (String s: strings) {
            this.append(s);
        }
        return this;
    }

    public BetterStringBuilder appendManyNl(final String...strings) {
        return this.appendMany(strings).newline();
    }
}
