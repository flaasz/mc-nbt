// nbt-core.js - Core NBT parsing and serialization
const zlib = require('zlib');
const fs = require('fs').promises;

// NBT Tag Types
const TAG_TYPES = {
    END: 0,
    BYTE: 1,
    SHORT: 2,
    INT: 3,
    LONG: 4,
    FLOAT: 5,
    DOUBLE: 6,
    BYTE_ARRAY: 7,
    STRING: 8,
    LIST: 9,
    COMPOUND: 10,
    INT_ARRAY: 11,
    LONG_ARRAY: 12
};

const TYPE_NAMES = Object.fromEntries(
    Object.entries(TAG_TYPES).map(([k, v]) => [v, k.toLowerCase()])
);

class NBTReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    readByte() {
        const value = this.buffer.readInt8(this.offset);
        this.offset += 1;
        return value;
    }

    readUByte() {
        const value = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return value;
    }

    readShort() {
        const value = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return value;
    }

    readInt() {
        const value = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return value;
    }

    readLong() {
        // JavaScript doesn't handle 64-bit integers natively, use BigInt
        const value = this.buffer.readBigInt64BE(this.offset);
        this.offset += 8;
        return value;
    }

    readFloat() {
        const value = this.buffer.readFloatBE(this.offset);
        this.offset += 4;
        return value;
    }

    readDouble() {
        const value = this.buffer.readDoubleBE(this.offset);
        this.offset += 8;
        return value;
    }

    readString() {
        const length = this.readShort();
        if (length === 0) return '';
        const value = this.buffer.toString('utf8', this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    readByteArray() {
        const length = this.readInt();
        const array = [];
        for (let i = 0; i < length; i++) {
            array.push(this.readByte());
        }
        return array;
    }

    readIntArray() {
        const length = this.readInt();
        const array = [];
        for (let i = 0; i < length; i++) {
            array.push(this.readInt());
        }
        return array;
    }

    readLongArray() {
        const length = this.readInt();
        const array = [];
        for (let i = 0; i < length; i++) {
            array.push(this.readLong());
        }
        return array;
    }

    readTag(type = null, name = null) {
        if (type === null) {
            type = this.readUByte();
        }

        if (type === TAG_TYPES.END) {
            return { type: 'end', value: null };
        }

        if (name === null) {
            name = this.readString();
        }

        const value = this.readTagValue(type);
        return { type: TYPE_NAMES[type], name, value };
    }

    readTagValue(type) {
        switch (type) {
            case TAG_TYPES.BYTE:
                return this.readByte();
            case TAG_TYPES.SHORT:
                return this.readShort();
            case TAG_TYPES.INT:
                return this.readInt();
            case TAG_TYPES.LONG:
                return this.readLong();
            case TAG_TYPES.FLOAT:
                return this.readFloat();
            case TAG_TYPES.DOUBLE:
                return this.readDouble();
            case TAG_TYPES.BYTE_ARRAY:
                return this.readByteArray();
            case TAG_TYPES.STRING:
                return this.readString();
            case TAG_TYPES.LIST:
                return this.readList();
            case TAG_TYPES.COMPOUND:
                return this.readCompound();
            case TAG_TYPES.INT_ARRAY:
                return this.readIntArray();
            case TAG_TYPES.LONG_ARRAY:
                return this.readLongArray();
            default:
                throw new Error(`Unknown tag type: ${type}`);
        }
    }

    readList() {
        const listType = this.readUByte();
        const length = this.readInt();
        const list = [];

        for (let i = 0; i < length; i++) {
            list.push(this.readTagValue(listType));
        }

        return {
            type: TYPE_NAMES[listType],
            value: list
        };
    }

    readCompound() {
        const compound = {};
        
        while (true) {
            const tag = this.readTag();
            if (tag.type === 'end') break;
            compound[tag.name] = {
                type: tag.type,
                value: tag.value
            };
        }

        return compound;
    }
}

class NBTWriter {
    constructor() {
        this.buffers = [];
    }

    writeByte(value) {
        const buffer = Buffer.allocUnsafe(1);
        buffer.writeInt8(value, 0);
        this.buffers.push(buffer);
    }

    writeUByte(value) {
        const buffer = Buffer.allocUnsafe(1);
        buffer.writeUInt8(value, 0);
        this.buffers.push(buffer);
    }

    writeShort(value) {
        const buffer = Buffer.allocUnsafe(2);
        buffer.writeInt16BE(value, 0);
        this.buffers.push(buffer);
    }

    writeInt(value) {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeInt32BE(value, 0);
        this.buffers.push(buffer);
    }

    writeLong(value) {
        const buffer = Buffer.allocUnsafe(8);
        buffer.writeBigInt64BE(BigInt(value), 0);
        this.buffers.push(buffer);
    }

    writeFloat(value) {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeFloatBE(value, 0);
        this.buffers.push(buffer);
    }

    writeDouble(value) {
        const buffer = Buffer.allocUnsafe(8);
        buffer.writeDoubleBE(value, 0);
        this.buffers.push(buffer);
    }

    writeString(value) {
        const strBuffer = Buffer.from(value, 'utf8');
        this.writeShort(strBuffer.length);
        this.buffers.push(strBuffer);
    }

    writeByteArray(array) {
        this.writeInt(array.length);
        array.forEach(byte => this.writeByte(byte));
    }

    writeIntArray(array) {
        this.writeInt(array.length);
        array.forEach(int => this.writeInt(int));
    }

    writeLongArray(array) {
        this.writeInt(array.length);
        array.forEach(long => this.writeLong(long));
    }

    writeTag(tag, name = '') {
        const type = TAG_TYPES[tag.type.toUpperCase()];
        this.writeUByte(type);
        this.writeString(name);
        this.writeTagValue(tag.type, tag.value);
    }

    writeTagValue(type, value) {
        switch (type.toLowerCase()) {
            case 'byte':
                this.writeByte(value);
                break;
            case 'short':
                this.writeShort(value);
                break;
            case 'int':
                this.writeInt(value);
                break;
            case 'long':
                this.writeLong(value);
                break;
            case 'float':
                this.writeFloat(value);
                break;
            case 'double':
                this.writeDouble(value);
                break;
            case 'byte_array':
                this.writeByteArray(value);
                break;
            case 'string':
                this.writeString(value);
                break;
            case 'list':
                this.writeList(value);
                break;
            case 'compound':
                this.writeCompound(value);
                break;
            case 'int_array':
                this.writeIntArray(value);
                break;
            case 'long_array':
                this.writeLongArray(value);
                break;
            default:
                throw new Error(`Unknown tag type: ${type}`);
        }
    }

    writeList(list) {
        if (list.value.length === 0) {
            this.writeUByte(TAG_TYPES.END);
            this.writeInt(0);
            return;
        }

        const listType = TAG_TYPES[list.type.toUpperCase()];
        this.writeUByte(listType);
        this.writeInt(list.value.length);

        list.value.forEach(item => {
            this.writeTagValue(list.type, item);
        });
    }

    writeCompound(compound) {
        Object.entries(compound).forEach(([name, tag]) => {
            const type = TAG_TYPES[tag.type.toUpperCase()];
            this.writeUByte(type);
            this.writeString(name);
            this.writeTagValue(tag.type, tag.value);
        });
        this.writeUByte(TAG_TYPES.END);
    }

    getBuffer() {
        return Buffer.concat(this.buffers);
    }
}

class NBT {
    static parse(buffer) {
        const reader = new NBTReader(buffer);
        return reader.readTag();
    }

    static stringify(nbtData) {
        const writer = new NBTWriter();
        writer.writeTag(nbtData, nbtData.name || '');
        return writer.getBuffer();
    }

    static async readFile(filepath) {
        const buffer = await fs.readFile(filepath);
        return this.parse(buffer);
    }

    static async writeFile(filepath, nbtData) {
        const buffer = this.stringify(nbtData);
        await fs.writeFile(filepath, buffer);
    }

    static async readCompressedFile(filepath) {
        const buffer = await fs.readFile(filepath);
        const decompressed = zlib.gunzipSync(buffer);
        return this.parse(decompressed);
    }

    static async writeCompressedFile(filepath, nbtData) {
        const buffer = this.stringify(nbtData);
        const compressed = zlib.gzipSync(buffer);
        await fs.writeFile(filepath, compressed);
    }
}

module.exports = { NBT, NBTReader, NBTWriter, TAG_TYPES, TYPE_NAMES };