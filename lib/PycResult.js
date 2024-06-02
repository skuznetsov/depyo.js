class PycResult {
    result = [];
    indent = 0;
    doNotIndent = false;
    
    constructor(lines, doNotIndent = false) {
        if (lines) {
            this.add(lines);
        }
        this.doNotIndent = doNotIndent;
    }
    
    get length() {
        return this.result.length;
    }

    get last() {
        return this.result[this.result.length - 1];
    }

    get hasResult() { 
        return this.result.length > 1 || (this.result.length == 1 && this.result[0].length > 0);
    }
    
    increaseIndent() {
        this.indent++;
    }
    
    decreaseIndent() {
        if (this.indent > 0) {
            this.indent--;
        }
    }
    
    clear() {
        this.indent = 0;
        this.result = [];
    }

    add(line) {
        let padding = " ".repeat(4 * this.indent);
        let lines = [];

        if (line instanceof PycResult) {
            if (!line.doNotIndent) {
                padding = " ".repeat(4 * (this.indent + 1));
            }
            lines = line.result;
        } else {
            lines.push(line)
        }

        for (line of lines) {
            this.result.push(padding + line);
        }
    }

    lastLineAppend(data, shouldTrim = true) {
        if (this.result.length == 0) {
            this.result.push("");
        }
        if (data.constructor.name == "String") {
            this.result[this.result.length - 1] += shouldTrim ? data.trim() : data;
        } else {
            let str = data?.result?.shift();
            this.result[this.result.length - 1] += shouldTrim? str.trim() : str;
            this.add(data);
        }
    }

    chop(suffix) {
        if (this.last.endsWith(suffix)) {
            this.result[this.result.length - 1] = this.last.substring(0,this.last.length - suffix.length);
        }
    }

    toString() {
        return this.result.join("\n");
    }
}

module.exports = PycResult;