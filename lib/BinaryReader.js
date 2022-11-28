class BinaryReader {
    constructor(code) {
        this._reader = Buffer.from(code);
        this._pc = 0;
    }

    get pc() {
        return this._pc;
    }

    set pc(pos) {
        this._pc = pos;
    }

    get EOF() {
        return this._pc >= this._reader.length;
    }

    readChar() {
        return String.fromCharCode([this.readByte()]);
    }

    readByte() {
        let value = this._reader.readUInt8(this.pc, true);
        this.pc++;
        return value;
    }
    
    readUInt16() {
        let value = this._reader.readUInt16LE(this.pc, true);
        this.pc += 2;
        return value;
    }

    readUInt16BE() {
        let value = this._reader.readUInt16BE(this.pc, true);
        this.pc += 2;
        return value;
    }

    readInt16() {
        let value = this._reader.readInt16LE(this.pc, true);
        this.pc += 2;
        return value;
    }

    readInt16BE() {
        let value = this._reader.readInt16BE(this.pc, true);
        this.pc += 2;
        return value;
    }

    readInt32() {
        let value = this._reader.readInt32LE(this.pc, true);
        this.pc += 4;
        return value;
    }

    readInt32BE() {
        let value = this._reader.readInt32BE(this.pc, true);
        this.pc += 4;
        return value;
    }

    readUInt32() {
        let value = this._reader.readUInt32LE(this.pc, true);
        this.pc += 4;
        return value;
    }

    readUInt32BE() {
        let value = this._reader.readUInt32BE(this.pc, true);
        this.pc += 4;
        return value;
    }

    readLong() {
        let high = this.readInt32()
        let low = this.readInt32()
        return {low, high};
    }

    readLongBE() {
        let high = this.readInt32BE()
        let low = this.readInt32BE()
        return {low, high};
    }

    readULong() {
        let high = this.readUInt()
        let low = this.readUInt()
        return {low, high};
    }

    readULongBE() {
        let high = this.readUIntBE()
        let low = this.readUIntBE()
        return {low, high};
    }

    readFloat() {
        let value = this._reader.readFloatLE(this.pc, true);
        this.pc += 4;
        return value;
    }

    readFloatBE() {
        let value = this._reader.readFloatBE(this.pc, true);
        this.pc += 4;
        return value;
    }
    
    readDouble() {
        let value = this._reader.readDoubleLE(this.pc, true);
        this.pc += 8;
        return value;
    }

    readDoubleBE() {
        let value = this._reader.readDoubleBE(this.pc, true);
        this.pc += 8;
        return value;
    }
    
    readBytes(length) {
        if (this.pc + length > this._reader.length) {
            throw Error("Requested more data than buffer holds");
        }
        let value = this._reader.slice(this.pc, this.pc + length);
        this.pc += length;
        return value;
    }

    readString(length) {
        let value = this.readBytes(length).toString('utf8');
        return value;
    }
}

module.exports = BinaryReader;