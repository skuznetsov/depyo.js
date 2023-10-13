const Reader = require('./code_reader');
const fs = require('fs');
const zlib = require('zlib');

class ZipReader {
    constructor(filename) {
        this.filename = filename;
        this.reader = null;
        this._entries = null;
    }

    get position() {
        if (this.reader) {
            return this.reader.pc;
        }
        return 0;
    }

    set position (pos) {
        if (this.reader) {
            this.reader.pc = pos;
        }
    }

    readLocalEntry() {
        if (!this.reader) {
            return null;
        }

        let fnameLen = 0, extraLen = 0;
        let header = {
            header: this.reader.readUInt(),
            version: this.reader.readUShort(),
            flags: this.reader.readUShort(),
            method: this.reader.readUShort(),
            modificationTime: this.reader.readUShort(),
            modificationDate: this.reader.readUShort(),
            crc32: this.reader.readUInt(),
            compressedSize: this.reader.readUInt(),
            uncompressedSize: this.reader.readUInt(),
            fileNameLength: (fnameLen = this.reader.readUShort()),
            extraFieldLength: (extraLen = this.reader.readUShort()),
            fileName: this.reader.readString(fnameLen),
            extraField: this.reader.readString(extraLen),
            offset: this.reader.pc
        };
        return header;
    }

    readCDEntry() {
        if (!this.reader) {
            return null;
        }

        let fnameLen = 0, extraLen = 0, commentLen = 0;
        let header = {
            header: this.reader.readUInt(),
            versionMade: this.reader.readUShort(),
            minVersion: this.reader.readUShort(),
            flags: this.reader.readUShort(),
            method: this.reader.readUShort(),
            modificationTime: this.reader.readUShort(),
            modificationDate: this.reader.readUShort(),
            crc32: this.reader.readUInt(),
            compressedSize: this.reader.readUInt(),
            uncompressedSize: this.reader.readUInt(),
            fileNameLength: (fnameLen = this.reader.readUShort()),
            extraFieldLength: (extraLen = this.reader.readUShort()),
            commentLength: (commentLen = this.reader.readUShort()),
            diskNum: this.reader.readUShort(),
            internalFileAttributes: this.reader.readUShort(),
            externalFileAttributes: this.reader.readUInt(),
            localHeaderOffseet: this.reader.readUInt(),
            fileName: this.reader.readString(fnameLen),
            extraField: this.reader.readString(extraLen),
            comment: this.reader.readString(commentLen)
        };
        return header;
    }

    readEOCD() {
        if (!this.reader) {
            return null;
        }

        let header = {
            header: this.reader.readUInt(),
            diskNum: this.reader.readUShort(),
            cdDisk: this.reader.readUShort(),
            cdRecordsCurrent: this.reader.readUShort(),
            cdRecordsTotal: this.reader.readUShort(),
            cdSize: this.reader.readUInt(),
            cdOffset: this.reader.readUInt()
        };
        return header;
    }

    readEntry(entry) {
        if (!entry) {
            return null;
        }
        if (entry.compressedSize > 0) {
            if (entry.method == 8) {
                let data = zlib.inflateRawSync(entry.data);
                return data;
            } else if (entry.method == 0) {
                return entry.data;
            } else {
                console.log(`Unsupported method ${entry.method}`);
            }
        }
        return null;
    }

    open() {
        if (!this.reader) {
            try {
                let data = fs.readFileSync(this.filename)
                this.reader = new Reader(data, 'L');
            } catch (ex) {
                console.error(ex);
                return;
            }
        }
    }

    readSignature() {
        let value = this.reader.readUInt();
        this.reader.pc -= 4;
        return value;
    }

    isZipFile() {
        if (!this.reader) {
            this.open();
        }
        let oldPc = this.reader.pc;
        this.reader.pc = 0;
        let signature = this.readSignature();
        this.reader.pc = oldPc;
        if (signature != 0x04034b50) {
            return false;
        }
        return true;
    }

    findEOCD() {
        if (!this.reader) {
            this.open();
        }
        this.reader.pc = this.reader.length - 22;
        while(this.reader.pc >= 0 && this.readSignature() != 0x06054b50) {
            this.reader.pc--;
        }
        if (this.reader.pc < 0) {
            return false;
        }
        return true;
    }

    *entries() {
        this.open();

        let eocdEntry;
        if (this.findEOCD()) {
            eocdEntry = this.readEOCD();
            this.reader.pc = eocdEntry.cdOffset;
        } else {
            return null;
        }

        let records = eocdEntry.cdRecordsCurrent;
        this._entries = this._entries || [];

        while(records--) {
            let cdEntry = this.readCDEntry();
            let nextCDPos = this.reader.pc;
            if (cdEntry.header != 0x02014b50) {
                break;
            }
            this.reader.pc = cdEntry.localHeaderOffseet;
            let localEntry = this.readLocalEntry();
            if (cdEntry.compressedSize > 0){
                cdEntry.data = this.reader.readBytes(cdEntry.compressedSize);
            }
            this.reader.pc = nextCDPos;
            // TODO: Validate CRC32

            yield cdEntry;
        }
        delete this.reader;                
    }

    findEntry(filename) {
        if (!this._entries) {
            return null;
        }
        let entry = this._entries.find(entry => entry.fileName == filename);
        return entry;
    }
}

module.exports = ZipReader;