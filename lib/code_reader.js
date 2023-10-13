class CodeReader {
    constructor(code, endian) {
        this.endian = endian || 'B';
        this._reader = Buffer.from(code);
        this._pc = 0;
    }

    get pc() {
        return this._pc;
    }

    set pc(pos) {
        if (pos > this.length || pos < 0) {
            pos = this.length;
        }
        this._pc = pos;
    }

    get length() {
        return this._reader.length
    }

    get EOF() {
        return this._pc >= this._reader.length;
    }

    readByte() {
        try {
            let value = this._reader.readUInt8(this.pc, true);
            this.pc++;
            return value;
        } catch {
            debugger;
        }
    }
    
    readUShort() {
        try {
            let value = this._reader[`readUInt16${this.endian}E`](this.pc, true);
            this.pc += 2;
            return value;
        } catch {
            debugger;
        }
    }

    readShort() {
        try {
            let value = this._reader[`readInt16${this.endian}E`](this.pc, true);
            this.pc += 2;
            return value;
        } catch {
            debugger;
        }
    }

    readInt() {
        try {
            let value = this._reader[`readInt32${this.endian}E`](this.pc, true);
            this.pc += 4;
            return value;
        } catch {
            debugger;
        }
    }

    readUInt() {
        try {
            let value = this._reader[`readUInt32${this.endian}E`](this.pc, true);
            this.pc += 4;
            return value;
        } catch (ex) {
            debugger;
        }
    }
    
    readLong() {
        try {
            let high = this.readInt()
            let low = this.readInt()
            return {low, high};
        } catch {
            debugger;
        }
    }
    
    readULong() {
        try {
            let high = this.readUInt()
            let low = this.readUInt()
            return {low, high};
        } catch {
            debugger;
        }
    }

    readFloat() {
        try {
            let value = this._reader[`readFloat${this.endian}E`](this.pc, true);
            this.pc += 4;
            return value;
        } catch {
            debugger;
        }
    }
    
    readDouble() {
        try {
            let value = this._reader[`readDouble${this.endian}E`](this.pc, true);
            this.pc += 8;
            return value;
        } catch {
            debugger;
        }
    }
    
    readBytes(length) {
        try {
            let value = this._reader.slice(this.pc, this.pc + length);
            this.pc += length;
            return value;
        } catch {
            debugger;
        }
    }

    readString(length) {
        try {
            let value = this._reader.slice(this.pc, this.pc + length).toString('utf8');
            this.pc += length;
            return value;
        } catch {
            debugger;
        }
    }

    peekByte() {
        try {
            return this._reader.readUInt8(this.pc, true);
        } catch {
            debugger;
        }
    }
}

module.exports = CodeReader;