package Misc;

public class BetterStringBuilder {
	
	private StringBuilder builder;
	
	public BetterStringBuilder() {
		builder = new StringBuilder();
	}
	
	public BetterStringBuilder append(boolean b) {
		builder.append(b);
		return this;
	}

	public BetterStringBuilder append(char c) {
		builder.append(c);
		return this;
	}

	public BetterStringBuilder append(char[] str, int offset, int len) {
		builder.append(str, offset, len);
		return this;
	}

	public BetterStringBuilder append(char[] str) {
		builder.append(str);
		return this;
	}

	public BetterStringBuilder append(CharSequence s, int start, int end) {
		builder.append(s, start, end);
		return this;
	}

	public BetterStringBuilder append(CharSequence s) {
		builder.append(s);
		return this;
	}

	public BetterStringBuilder append(double d) {
		builder.append(d);
		return this;
	}

	public BetterStringBuilder append(float f) {
		builder.append(f);
		return this;
	}

	public BetterStringBuilder append(int i) {
		builder.append(i);
		return this;
	}

	public BetterStringBuilder append(long lng) {
		builder.append(lng);
		return this;
	}

	public BetterStringBuilder append(Object obj) {
		builder.append(obj);
		return this;
	}

	public BetterStringBuilder append(String s) {
		builder.append(s);
		return this;
	}
	
	public BetterStringBuilder append(StringBuffer sb) {
		builder.append(sb);
		return this;
	}

	public BetterStringBuilder appendCodePoint(int codePoint) {
		builder.appendCodePoint(codePoint);
		return this;
	}

	public int capacity() {
		return builder.capacity();
	}

	public char charAt(int index) {
		return builder.charAt(index);
	}

	public int codePointAt(int index) {
		return builder.codePointAt(index);
	}

	public int codePointBefore(int index) {
		return builder.codePointBefore(index);
	}

	public int codePointCount(int beginIndex, int endIndex) {
		return builder.codePointCount(beginIndex, endIndex);
	}

	public BetterStringBuilder delete(int start, int end) {
		builder.delete(start, end);
		return this;
	}

	public BetterStringBuilder deleteCharAt(int index) {
		builder.deleteCharAt(index);
		return this;
	}

	public void ensureCapacity(int minimumCapacity) {
		builder.ensureCapacity(minimumCapacity);
	}

	public boolean equals(Object obj) {
		return builder.equals(obj);
	}

	public void getChars(int srcBegin, int srcEnd, char[] dst, int dstBegin) {
		builder.getChars(srcBegin, srcEnd, dst, dstBegin);
	}

	public int hashCode() {
		return builder.hashCode();
	}

	public int indexOf(String str, int fromIndex) {
		return builder.indexOf(str, fromIndex);
	}

	public int indexOf(String str) {
		return builder.indexOf(str);
	}

	public BetterStringBuilder insert(int offset, boolean b) {
		builder.insert(offset, b);
		return this;
	}

	public BetterStringBuilder insert(int offset, char c) {
		builder.insert(offset, c);
		return this;
	}

	public BetterStringBuilder insert(int index, char[] str, int offset, int len) {
		builder.insert(index, str, offset, len);
		return this;
	}

	public BetterStringBuilder insert(int offset, char[] str) {
		builder.insert(offset, str);
		return this;
	}

	public BetterStringBuilder insert(int dstOffset, CharSequence s, int start,
			int end) {
		builder.insert(dstOffset, s, start, end);
		return this;
	}

	public BetterStringBuilder insert(int dstOffset, CharSequence s) {
		builder.insert(dstOffset, s);
		return this;
	}

	public BetterStringBuilder insert(int offset, double d) {
		builder.insert(offset, d);
		return this;
	}

	public BetterStringBuilder insert(int offset, float f) {
		builder.insert(offset, f);
		return this;
	}

	public BetterStringBuilder insert(int offset, int i) {
		builder.insert(offset, i);
		return this;
	}

	public BetterStringBuilder insert(int offset, long l) {
		builder.insert(offset, l);
		return this;
	}

	public BetterStringBuilder insert(int offset, Object obj) {
		builder.insert(offset, obj);
		return this;
	}

	public BetterStringBuilder insert(int offset, String str) {
		builder.insert(offset, str);
		return this;
	}

	public int lastIndexOf(String str, int fromIndex) {
		return builder.lastIndexOf(str, fromIndex);
	}

	public int lastIndexOf(String str) {
		return builder.lastIndexOf(str);
	}

	public int length() {
		return builder.length();
	}

	public int offsetByCodePoints(int index, int codePointOffset) {
		return builder.offsetByCodePoints(index, codePointOffset);
	}

	public BetterStringBuilder replace(int start, int end, String str) {
		builder.replace(start, end, str);
		return this;
	}

	public BetterStringBuilder reverse() {
		builder.reverse();
		return this;
	}

	public void setCharAt(int index, char ch) {
		builder.setCharAt(index, ch);
	}

	public void setLength(int newLength) {
		builder.setLength(newLength);
	}

	public CharSequence subSequence(int start, int end) {
		return builder.subSequence(start, end);
	}

	public String substring(int start, int end) {
		return builder.substring(start, end);
	}

	public String substring(int start) {
		return builder.substring(start);
	}

	public String toString() {
		return builder.toString();
	}

	public void trimToSize() {
		builder.trimToSize();
	}
	
	/* Added */
	public BetterStringBuilder appendln(int i) {
		return this.append(i).newline();
	}
	
	public BetterStringBuilder appendln(String s) {
		return this.append(s).newline();
	}
	
	public BetterStringBuilder newline() {
		return this.append( System.getProperty("line.separator") );
	}
	
	public BetterStringBuilder appendMany(String...strings) {
		for(String s: strings)
			this.append(s);
		return this;
	}
	
	public BetterStringBuilder appendManyNl(String...strings) {
		return this.appendMany(strings).newline();
	}
}
