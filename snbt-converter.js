// snbt-converter.js - SNBT (Stringified NBT) conversion
const { TAG_TYPES, TYPE_NAMES } = require('./nbt-core');

class SNBTConverter {
    static toSNBT(nbtData, indent = 0) {
        const indentStr = '  '.repeat(indent);
        const nextIndentStr = '  '.repeat(indent + 1);

        if (!nbtData || typeof nbtData !== 'object') {
            return 'null';
        }

        const { type, value, name } = nbtData;

        switch (type?.toLowerCase()) {
            case 'byte':
                return `${value}b`;
            case 'short':
                return `${value}s`;
            case 'int':
                return `${value}`;
            case 'long':
                return `${value}L`;
            case 'float':
                return `${value}f`;
            case 'double':
                return `${value}d`;
            case 'string':
                return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            case 'byte_array':
                return `[B;${value.map(v => `${v}b`).join(',')}]`;
            case 'int_array':
                return `[I;${value.join(',')}]`;
            case 'long_array':
                return `[L;${value.map(v => `${v}L`).join(',')}]`;
            case 'list':
                if (value.value.length === 0) {
                    return '[]';
                }
                const listItems = value.value.map(item => {
                    return this.toSNBT({ type: value.type, value: item }, indent + 1);
                });
                if (listItems.every(item => item.length < 20)) {
                    return `[${listItems.join(',')}]`;
                }
                return `[\n${listItems.map(item => `${nextIndentStr}${item}`).join(',\n')}\n${indentStr}]`;
            case 'compound':
                const entries = Object.entries(value);
                if (entries.length === 0) {
                    return '{}';
                }
                const compoundItems = entries.map(([key, tag]) => {
                    const keyStr = /^[a-zA-Z_][a-zA-Z0-9_\-\.\+]*$/.test(key) ? key : `"${key}"`;
                    const valueStr = this.toSNBT(tag, indent + 1);
                    return `${keyStr}:${valueStr}`;
                });
                if (compoundItems.every(item => item.length < 30)) {
                    return `{${compoundItems.join(',')}}`;
                }
                return `{\n${compoundItems.map(item => `${nextIndentStr}${item}`).join(',\n')}\n${indentStr}}`;
            default:
                return 'null';
        }
    }

    static fromSNBT(snbtString) {
        const parser = new SNBTParser(snbtString);
        return parser.parse();
    }

    static toJSON(nbtData) {
        if (!nbtData || typeof nbtData !== 'object') {
            return null;
        }

        const convertValue = (tag) => {
            if (!tag || typeof tag !== 'object') return tag;

            const { type, value } = tag;

            switch (type?.toLowerCase()) {
                case 'byte':
                case 'short':
                case 'int':
                case 'float':
                case 'double':
                    return value;
                case 'long':
                    return value.toString(); // Convert BigInt to string
                case 'string':
                    return value;
                case 'byte_array':
                case 'int_array':
                    return value;
                case 'long_array':
                    return value.map(v => v.toString());
                case 'list':
                    return value.value.map(item => convertValue({ type: value.type, value: item }));
                case 'compound':
                    const result = {};
                    Object.entries(value).forEach(([key, tag]) => {
                        result[key] = convertValue(tag);
                    });
                    return result;
                default:
                    return value;
            }
        };

        return {
            name: nbtData.name,
            type: nbtData.type,
            value: convertValue(nbtData)
        };
    }

    static fromJSON(jsonData, inferTypes = true) {
        if (!jsonData || typeof jsonData !== 'object') {
            return null;
        }

        const convertValue = (value, expectedType = null) => {
            if (value === null || value === undefined) {
                return { type: 'byte', value: 0 };
            }

            if (expectedType) {
                return { type: expectedType, value: this.convertToType(value, expectedType) };
            }

            if (inferTypes) {
                if (typeof value === 'boolean') {
                    return { type: 'byte', value: value ? 1 : 0 };
                }
                if (typeof value === 'number') {
                    if (Number.isInteger(value)) {
                        if (value >= -128 && value <= 127) return { type: 'byte', value };
                        if (value >= -32768 && value <= 32767) return { type: 'short', value };
                        return { type: 'int', value };
                    }
                    return { type: 'double', value };
                }
                if (typeof value === 'string') {
                    return { type: 'string', value };
                }
                if (Array.isArray(value)) {
                    if (value.length === 0) {
                        return { type: 'list', value: { type: 'byte', value: [] } };
                    }
                    const firstType = convertValue(value[0]).type;
                    return {
                        type: 'list',
                        value: {
                            type: firstType,
                            value: value.map(item => convertValue(item, firstType).value)
                        }
                    };
                }
                if (typeof value === 'object') {
                    const compound = {};
                    Object.entries(value).forEach(([key, val]) => {
                        compound[key] = convertValue(val);
                    });
                    return { type: 'compound', value: compound };
                }
            }

            return { type: 'string', value: String(value) };
        };

        return {
            name: jsonData.name || '',
            type: jsonData.type || 'compound',
            value: convertValue(jsonData.value).value
        };
    }

    static convertToType(value, type) {
        switch (type.toLowerCase()) {
            case 'byte':
                return Math.max(-128, Math.min(127, Math.floor(Number(value))));
            case 'short':
                return Math.max(-32768, Math.min(32767, Math.floor(Number(value))));
            case 'int':
                return Math.max(-2147483648, Math.min(2147483647, Math.floor(Number(value))));
            case 'long':
                return BigInt(value);
            case 'float':
                return Number(value);
            case 'double':
                return Number(value);
            case 'string':
                return String(value);
            default:
                return value;
        }
    }
}

class SNBTParser {
    constructor(snbtString) {
        this.input = snbtString.trim();
        this.pos = 0;
    }

    parse() {
        this.skipWhitespace();
        return this.parseValue();
    }

    parseValue() {
        this.skipWhitespace();
        const char = this.peek();

        if (char === '{') {
            return this.parseCompound();
        }
        if (char === '[') {
            return this.parseArray();
        }
        if (char === '"' || char === "'") {
            return { type: 'string', value: this.parseString() };
        }
        
        return this.parseNumber();
    }

    parseCompound() {
        this.consume('{');
        const compound = {};
        
        this.skipWhitespace();
        if (this.peek() === '}') {
            this.consume('}');
            return { type: 'compound', value: compound };
        }

        while (true) {
            this.skipWhitespace();
            const key = this.parseKey();
            this.skipWhitespace();
            this.consume(':');
            this.skipWhitespace();
            const value = this.parseValue();
            
            compound[key] = value;
            
            this.skipWhitespace();
            if (this.peek() === '}') {
                this.consume('}');
                break;
            }
            this.consume(',');
        }

        return { type: 'compound', value: compound };
    }

    parseArray() {
        this.consume('[');
        this.skipWhitespace();

        // Check for typed arrays
        if (this.peek() === 'B' || this.peek() === 'I' || this.peek() === 'L') {
            const type = this.consume();
            this.consume(';');
            const array = this.parseTypedArray(type);
            this.consume(']');
            
            switch (type) {
                case 'B': return { type: 'byte_array', value: array };
                case 'I': return { type: 'int_array', value: array };
                case 'L': return { type: 'long_array', value: array };
            }
        }

        // Regular list
        const items = [];
        let listType = null;

        this.skipWhitespace();
        if (this.peek() === ']') {
            this.consume(']');
            return { type: 'list', value: { type: 'byte', value: [] } };
        }

        while (true) {
            this.skipWhitespace();
            const item = this.parseValue();
            
            if (listType === null) {
                listType = item.type;
            }
            
            items.push(item.value);
            
            this.skipWhitespace();
            if (this.peek() === ']') {
                this.consume(']');
                break;
            }
            this.consume(',');
        }

        return { type: 'list', value: { type: listType, value: items } };
    }

    parseTypedArray(type) {
        const items = [];
        
        this.skipWhitespace();
        while (this.peek() !== ']') {
            this.skipWhitespace();
            const value = this.parseNumber();
            items.push(value.value);
            
            this.skipWhitespace();
            if (this.peek() === ']') break;
            this.consume(',');
        }

        return items;
    }

    parseKey() {
        this.skipWhitespace();
        if (this.peek() === '"' || this.peek() === "'") {
            return this.parseString();
        }
        
        let key = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_\-\.\+]/.test(this.peek())) {
            key += this.consume();
        }
        return key;
    }

    parseString() {
        const quote = this.consume();
        let value = '';
        
        while (this.pos < this.input.length && this.peek() !== quote) {
            if (this.peek() === '\\') {
                this.consume();
                const escaped = this.consume();
                switch (escaped) {
                    case 'n': value += '\n'; break;
                    case 't': value += '\t'; break;
                    case 'r': value += '\r'; break;
                    case '\\': value += '\\'; break;
                    case '"': value += '"'; break;
                    case "'": value += "'"; break;
                    default: value += escaped; break;
                }
            } else {
                value += this.consume();
            }
        }
        
        this.consume(quote);
        return value;
    }

    parseNumber() {
        let value = '';
        let type = 'int';
        
        // Handle negative numbers
        if (this.peek() === '-') {
            value += this.consume();
        }
        
        // Parse digits
        while (this.pos < this.input.length && /[0-9.]/.test(this.peek())) {
            const char = this.consume();
            value += char;
            if (char === '.') {
                type = 'double';
            }
        }
        
        // Check for type suffix
        if (this.pos < this.input.length && /[bslfdBSLFD]/.test(this.peek())) {
            const suffix = this.consume().toLowerCase();
            switch (suffix) {
                case 'b': type = 'byte'; break;
                case 's': type = 'short'; break;
                case 'l': type = 'long'; break;
                case 'f': type = 'float'; break;
                case 'd': type = 'double'; break;
            }
        }
        
        let numValue;
        switch (type) {
            case 'byte':
                numValue = parseInt(value);
                break;
            case 'short':
                numValue = parseInt(value);
                break;
            case 'int':
                numValue = parseInt(value);
                break;
            case 'long':
                numValue = BigInt(value);
                break;
            case 'float':
                numValue = parseFloat(value);
                break;
            case 'double':
                numValue = parseFloat(value);
                break;
            default:
                numValue = parseFloat(value);
                break;
        }
        
        return { type, value: numValue };
    }

    peek() {
        return this.input[this.pos];
    }

    consume(expected = null) {
        if (this.pos >= this.input.length) {
            throw new Error('Unexpected end of input');
        }
        
        const char = this.input[this.pos++];
        
        if (expected && char !== expected) {
            throw new Error(`Expected '${expected}' but got '${char}'`);
        }
        
        return char;
    }

    skipWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.peek())) {
            this.pos++;
        }
    }
}

module.exports = { SNBTConverter };