class PycResult {
    result = [];
    indent = 0;
    doNotIndent = false;
    
    constructor(lines) {
        if (lines) {
            this.add(lines);
        }
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
        this.indent--;
        if (this.indent < 0) {
            this.indent = 0;
        }
    }
    
    clear() {
        this.indent = 0;
        this.result = [];
    }

    add(line) {
        let padding = "";
        let lines = [];

        for (let idx = 0; idx < this.indent; idx++)
        {
            padding += "    ";
        }

        if (line instanceof PycResult) {
            if (!line.doNotIndent) {
                padding += "    ";
            }
            lines = line.result;
        } else {
            lines.push(line)
        }

        for (line of lines) {
            this.result.push(padding + line);
        }
    }

    lastLineAppend(str) {
        if (this.result.length == 0) {
            this.result.push("");
        }
        this.result[this.result.length - 1] += str;
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