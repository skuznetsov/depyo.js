class PycResult {
    Result = [];
    Indent = 0;
    DoNotIndent = false;

    constructor(lines) {
        if (lines) {
            this.Add(lines);
        }
    }

    IncreaseIndent() {
        ++this.Indent;
    }

    DecreaseIndent() {
        this.Indent--;
        if (this.Indent < 0) {
            this.Indent = 0;
        }
    }

    Clear() {
        this.Indent = 0;
        this.Result = [];
    }

    Add(line) {
        let padding = "";
        let lines = [];

        for (let idx = 0; idx < this.Indent; idx++)
        {
            padding += "    ";
        }

        if (line instanceof PycResult) {
            if (!line.DoNotIndent) {
                padding += "    ";
            }
            lines = line.Result;
        } else {
            lines.push(line)
        }

        for (line of lines) {
            this.Result.push(padding + line);
        }
    }

    get HasResult() { 
        return this.Result.length > 0;
    }

    toString() {
        return this.Result.join("\n");
    }
}

module.exports = PycResult;