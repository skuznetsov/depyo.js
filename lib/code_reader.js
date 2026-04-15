class CodeReaderError extends Error {
    constructor(message, pc, length) {
        super(`${message} (pc=${pc}, length=${length})`);
        this.name = 'CodeReaderError';
        this.pc = pc;
        this.length = length;
    }
}

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

    _read(label, size, fn) {
        if (this._pc + size > this._reader.length) {
            throw new CodeReaderError(`${label}: read past end of buffer`, this._pc, this._reader.length);
        }
        try {
            const value = fn();
            this._pc += size;
            return value;
        } catch (ex) {
            if (ex instanceof CodeReaderError) throw ex;
            throw new CodeReaderError(`${label}: ${ex.message}`, this._pc, this._reader.length);
        }
    }

    readByte() {
        return this._read('readByte', 1, () => this._reader.readUInt8(this._pc, true));
    }

    readUShort() {
        return this._read('readUShort', 2, () => this._reader[`readUInt16${this.endian}E`](this._pc, true));
    }

    readShort() {
        return this._read('readShort', 2, () => this._reader[`readInt16${this.endian}E`](this._pc, true));
    }

    readInt() {
        return this._read('readInt', 4, () => this._reader[`readInt32${this.endian}E`](this._pc, true));
    }

    readUInt() {
        return this._read('readUInt', 4, () => this._reader[`readUInt32${this.endian}E`](this._pc, true));
    }

    readLong() {
        const high = this.readInt();
        const low = this.readInt();
        return {low, high};
    }

    readULong() {
        const high = this.readUInt();
        const low = this.readUInt();
        return {low, high};
    }

    readFloat() {
        return this._read('readFloat', 4, () => this._reader[`readFloat${this.endian}E`](this._pc, true));
    }

    readDouble() {
        return this._read('readDouble', 8, () => this._reader[`readDouble${this.endian}E`](this._pc, true));
    }

    readBytes(length) {
        return this._read(`readBytes(${length})`, length, () => this._reader.slice(this._pc, this._pc + length));
    }

    readString(length) {
        return this._read(`readString(${length})`, length, () => this._reader.slice(this._pc, this._pc + length).toString('utf8'));
    }

    peekByte() {
        if (this._pc >= this._reader.length) {
            throw new CodeReaderError('peekByte: read past end of buffer', this._pc, this._reader.length);
        }
        return this._reader.readUInt8(this._pc, true);
    }
}

module.exports = CodeReader;
module.exports.CodeReaderError = CodeReaderError;
