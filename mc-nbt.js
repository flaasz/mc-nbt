// mc-nbt.js - Main library file
const { NBT, TAG_TYPES, TYPE_NAMES } = require('./nbt-core');
const { SNBTConverter } = require('./snbt-converter');
const { MCAFile } = require('./mca-handler');
const fs = require('fs').promises;
const path = require('path');

// Inventory Management Classes
class InventoryManager {
    constructor(playerData) {
        this.playerData = playerData;
        this.minecraftNBT = require('./mc-nbt'); // Avoid circular dependency
    }

    getInventory() {
        const inventory = this.getValue('Inventory');
        return inventory?.value?.value || [];
    }

    setInventory(newInventory) {
        const inventoryTag = {
            type: 'list',
            value: {
                type: 'compound',
                value: newInventory
            }
        };
        this.setValue('Inventory', inventoryTag);
    }

    getValue(path) {
        const parts = path.split('.');
        let current = this.playerData;
        
        for (const part of parts) {
            if (!current || typeof current !== 'object') return undefined;
            
            if (current.type === 'compound' && current.value && current.value[part]) {
                current = current.value[part];
            } else if (current.type === 'list' && current.value && !isNaN(part)) {
                const index = parseInt(part);
                if (index >= 0 && index < current.value.value.length) {
                    current = {
                        type: current.value.type,
                        value: current.value.value[index]
                    };
                } else {
                    return undefined;
                }
            } else {
                return undefined;
            }
        }
        
        return current;
    }

    setValue(path, newValue) {
        const parts = path.split('.');
        const lastPart = parts.pop();
        let current = this.playerData;
        
        for (const part of parts) {
            if (!current || typeof current !== 'object') {
                throw new Error(`Invalid path: ${path}`);
            }
            
            if (current.type === 'compound' && current.value && current.value[part]) {
                current = current.value[part];
            } else if (current.type === 'list' && current.value && !isNaN(part)) {
                const index = parseInt(part);
                if (index >= 0 && index < current.value.value.length) {
                    current = {
                        type: current.value.type,
                        value: current.value.value[index]
                    };
                } else {
                    throw new Error(`List index out of bounds: ${index}`);
                }
            } else {
                throw new Error(`Invalid path: ${path}`);
            }
        }
        
        if (current.type === 'compound' && current.value) {
            current.value[lastPart] = newValue;
        } else {
            throw new Error(`Cannot set value on ${current.type} type`);
        }
        
        return this.playerData;
    }

    removeBySlot(slot) {
        const inventory = this.getInventory();
        const initialCount = inventory.length;
        
        const newInventory = inventory.filter(item => {
            const itemSlot = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'Slot');
            return itemSlot?.value !== slot;
        });
        
        this.setInventory(newInventory);
        return initialCount - newInventory.length;
    }

    removeByItemId(itemId, count = -1) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const id = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'id');
            const itemCount = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'Count');
            
            if (id?.value === itemId && (count === -1 || removedCount < count)) {
                if (count === -1) {
                    removedCount += itemCount?.value || 1;
                } else {
                    const currentItemCount = itemCount?.value || 1;
                    const toRemove = Math.min(currentItemCount, count - removedCount);
                    removedCount += toRemove;
                    
                    if (currentItemCount > toRemove) {
                        const newCount = currentItemCount - toRemove;
                        this.setValue.call({ playerData: { type: 'compound', value: item } }, 'Count', { type: 'byte', value: newCount });
                        newInventory.push(item);
                    }
                }
            } else {
                newInventory.push(item);
            }
        }
        
        this.setInventory(newInventory);
        return removedCount;
    }

    removeByPartialName(partialName, count = -1) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const id = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'id');
            const itemCount = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'Count');
            
            if (id?.value && id.value.includes(partialName) && (count === -1 || removedCount < count)) {
                if (count === -1) {
                    removedCount += itemCount?.value || 1;
                } else {
                    const currentItemCount = itemCount?.value || 1;
                    const toRemove = Math.min(currentItemCount, count - removedCount);
                    removedCount += toRemove;
                    
                    if (currentItemCount > toRemove) {
                        const newCount = currentItemCount - toRemove;
                        this.setValue.call({ playerData: { type: 'compound', value: item } }, 'Count', { type: 'byte', value: newCount });
                        newInventory.push(item);
                    }
                }
            } else {
                newInventory.push(item);
            }
        }
        
        this.setInventory(newInventory);
        return removedCount;
    }

    removeBySlotRange(minSlot, maxSlot) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const slot = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'Slot');
            const slotValue = slot?.value;
            
            if (slotValue >= minSlot && slotValue <= maxSlot) {
                const itemCount = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'Count');
                removedCount += itemCount?.value || 1;
            } else {
                newInventory.push(item);
            }
        }
        
        this.setInventory(newInventory);
        return removedCount;
    }

    clearInventory() {
        const inventory = this.getInventory();
        const itemCount = inventory.length;
        this.setInventory([]);
        return itemCount;
    }

    listItems() {
        const inventory = this.getInventory();
        return inventory.map(item => {
            const id = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'id');
            const count = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'Count');
            const slot = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'Slot');
            const tag = this.getValue.call({ playerData: { type: 'compound', value: item } }, 'tag');
            
            return {
                id: id?.value,
                count: count?.value,
                slot: slot?.value,
                hasEnchantments: tag ? !!this.getValue.call({ playerData: { type: 'compound', value: tag } }, 'Enchantments') : false
            };
        });
    }
}

class MinecraftNBT {
    constructor() {
        this.NBT = NBT;
        this.SNBTConverter = SNBTConverter;
        this.MCAFile = MCAFile;
        this.InventoryManager = InventoryManager;
        this.TAG_TYPES = TAG_TYPES;
        this.TYPE_NAMES = TYPE_NAMES;
    }

    // Universal file reader that auto-detects file type
    async readFile(filepath) {
        const ext = path.extname(filepath).toLowerCase();
        const basename = path.basename(filepath).toLowerCase();
        
        try {
            switch (ext) {
                case '.nbt':
                    return await this.readNBTFile(filepath);
                case '.dat':
                    return await this.readDATFile(filepath);
                case '.mca':
                    return await this.readMCAFile(filepath);
                case '.snbt':
                    return await this.readSNBTFile(filepath);
                case '.json':
                    return await this.readJSONFile(filepath);
                default:
                    // Try to detect by content or filename patterns
                    if (basename.includes('level.dat') || basename.includes('playerdata')) {
                        return await this.readDATFile(filepath);
                    }
                    if (basename.includes('region') || basename.match(/r\.-?\d+\.-?\d+\.mca/)) {
                        return await this.readMCAFile(filepath);
                    }
                    // Default to NBT
                    return await this.readNBTFile(filepath);
            }
        } catch (error) {
            throw new Error(`Failed to read ${filepath}: ${error.message}`);
        }
    }

    // NBT file operations
    async readNBTFile(filepath) {
        return await NBT.readFile(filepath);
    }

    async writeNBTFile(filepath, nbtData) {
        await NBT.writeFile(filepath, nbtData);
    }

    // DAT file operations (compressed NBT)
    async readDATFile(filepath) {
        return await NBT.readCompressedFile(filepath);
    }

    async writeDATFile(filepath, nbtData) {
        await NBT.writeCompressedFile(filepath, nbtData);
    }

    // MCA file operations
    async readMCAFile(filepath) {
        return await MCAFile.load(filepath);
    }

    async writeMCAFile(filepath, mcaData) {
        if (mcaData instanceof MCAFile) {
            await mcaData.save(filepath);
        } else {
            const mca = MCAFile.fromJSON(mcaData);
            await mca.save(filepath);
        }
    }

    // SNBT file operations
    async readSNBTFile(filepath) {
        const content = await fs.readFile(filepath, 'utf8');
        return SNBTConverter.fromSNBT(content);
    }

    async writeSNBTFile(filepath, nbtData) {
        const snbtContent = SNBTConverter.toSNBT(nbtData);
        await fs.writeFile(filepath, snbtContent, 'utf8');
    }

    // JSON file operations
    async readJSONFile(filepath) {
        const content = await fs.readFile(filepath, 'utf8');
        const jsonData = JSON.parse(content);
        return SNBTConverter.fromJSON(jsonData);
    }

    async writeJSONFile(filepath, nbtData) {
        const jsonData = SNBTConverter.toJSON(nbtData);
        const jsonString = JSON.stringify(jsonData, null, 2);
        await fs.writeFile(filepath, jsonString, 'utf8');
    }

    // Format conversion methods
    toSNBT(nbtData, pretty = true) {
        return SNBTConverter.toSNBT(nbtData, pretty ? 0 : -1);
    }

    fromSNBT(snbtString) {
        return SNBTConverter.fromSNBT(snbtString);
    }

    toJSON(nbtData) {
        return SNBTConverter.toJSON(nbtData);
    }

    fromJSON(jsonData, inferTypes = true) {
        return SNBTConverter.fromJSON(jsonData, inferTypes);
    }

    // Utility methods for editing NBT data
    getValue(nbtData, path) {
        const parts = path.split('.');
        let current = nbtData;
        
        for (const part of parts) {
            if (!current || typeof current !== 'object') {
                return undefined;
            }
            
            if (current.type === 'compound' && current.value && current.value[part]) {
                current = current.value[part];
            } else if (current.type === 'list' && current.value && !isNaN(part)) {
                const index = parseInt(part);
                if (index >= 0 && index < current.value.value.length) {
                    current = {
                        type: current.value.type,
                        value: current.value.value[index]
                    };
                } else {
                    return undefined;
                }
            } else {
                return undefined;
            }
        }
        
        return current;
    }

    setValue(nbtData, path, newValue) {
        const parts = path.split('.');
        const lastPart = parts.pop();
        let current = nbtData;
        
        // Navigate to parent
        for (const part of parts) {
            if (!current || typeof current !== 'object') {
                throw new Error(`Invalid path: ${path}`);
            }
            
            if (current.type === 'compound' && current.value && current.value[part]) {
                current = current.value[part];
            } else if (current.type === 'list' && current.value && !isNaN(part)) {
                const index = parseInt(part);
                if (index >= 0 && index < current.value.value.length) {
                    current = {
                        type: current.value.type,
                        value: current.value.value[index]
                    };
                } else {
                    throw new Error(`List index out of bounds: ${index}`);
                }
            } else {
                throw new Error(`Invalid path: ${path}`);
            }
        }
        
        // Set the value
        if (current.type === 'compound' && current.value) {
            if (typeof newValue === 'object' && newValue.type && newValue.value !== undefined) {
                current.value[lastPart] = newValue;
            } else {
                // Auto-detect type if not specified
                current.value[lastPart] = this.autoDetectType(newValue);
            }
        } else if (current.type === 'list' && current.value && !isNaN(lastPart)) {
            const index = parseInt(lastPart);
            if (index >= 0 && index < current.value.value.length) {
                if (typeof newValue === 'object' && newValue.type && newValue.value !== undefined) {
                    current.value.value[index] = newValue.value;
                } else {
                    current.value.value[index] = newValue;
                }
            } else {
                throw new Error(`List index out of bounds: ${index}`);
            }
        } else {
            throw new Error(`Cannot set value on ${current.type} type`);
        }
        
        return nbtData;
    }

    autoDetectType(value) {
        if (typeof value === 'boolean') {
            return { type: 'byte', value: value ? 1 : 0 };
        }
        if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                if (value >= -128 && value <= 127) return { type: 'byte', value };
                if (value >= -32768 && value <= 32767) return { type: 'short', value };
                if (value >= -2147483648 && value <= 2147483647) return { type: 'int', value };
                return { type: 'long', value: BigInt(value) };
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
            const firstType = this.autoDetectType(value[0]).type;
            return {
                type: 'list',
                value: {
                    type: firstType,
                    value: value.map(item => this.autoDetectType(item).value)
                }
            };
        }
        if (typeof value === 'object' && value !== null) {
            const compound = {};
            Object.entries(value).forEach(([key, val]) => {
                compound[key] = this.autoDetectType(val);
            });
            return { type: 'compound', value: compound };
        }
        
        return { type: 'string', value: String(value) };
    }

    // Create new NBT structures
    createCompound(data = {}) {
        const compound = {};
        Object.entries(data).forEach(([key, value]) => {
            compound[key] = this.autoDetectType(value);
        });
        return { type: 'compound', value: compound };
    }

    createList(items = [], type = null) {
        if (items.length === 0) {
            return { type: 'list', value: { type: type || 'byte', value: [] } };
        }
        
        const detectedType = type || this.autoDetectType(items[0]).type;
        return {
            type: 'list',
            value: {
                type: detectedType,
                value: items.map(item => {
                    const detected = this.autoDetectType(item);
                    return detected.type === detectedType ? detected.value : item;
                })
            }
        };
    }

    // Validation methods
    validate(nbtData) {
        const errors = [];
        this._validateTag(nbtData, '', errors);
        return errors;
    }

    _validateTag(tag, path, errors) {
        if (!tag || typeof tag !== 'object') {
            errors.push(`Invalid tag at ${path}: not an object`);
            return;
        }

        if (!tag.type || !tag.hasOwnProperty('value')) {
            errors.push(`Invalid tag at ${path}: missing type or value`);
            return;
        }

        if (!TYPE_NAMES[TAG_TYPES[tag.type.toUpperCase()]]) {
            errors.push(`Invalid tag type at ${path}: ${tag.type}`);
            return;
        }

        // Type-specific validation
        switch (tag.type.toLowerCase()) {
            case 'compound':
                if (typeof tag.value !== 'object' || Array.isArray(tag.value)) {
                    errors.push(`Invalid compound at ${path}: value must be object`);
                } else {
                    Object.entries(tag.value).forEach(([key, childTag]) => {
                        this._validateTag(childTag, `${path}.${key}`, errors);
                    });
                }
                break;
            case 'list':
                if (!tag.value || !tag.value.type || !Array.isArray(tag.value.value)) {
                    errors.push(`Invalid list at ${path}: malformed structure`);
                } else {
                    tag.value.value.forEach((item, index) => {
                        this._validateTag(
                            { type: tag.value.type, value: item },
                            `${path}[${index}]`,
                            errors
                        );
                    });
                }
                break;
            case 'byte':
                if (!Number.isInteger(tag.value) || tag.value < -128 || tag.value > 127) {
                    errors.push(`Invalid byte at ${path}: ${tag.value}`);
                }
                break;
            case 'short':
                if (!Number.isInteger(tag.value) || tag.value < -32768 || tag.value > 32767) {
                    errors.push(`Invalid short at ${path}: ${tag.value}`);
                }
                break;
            case 'int':
                if (!Number.isInteger(tag.value) || tag.value < -2147483648 || tag.value > 2147483647) {
                    errors.push(`Invalid int at ${path}: ${tag.value}`);
                }
                break;
            case 'long':
                if (typeof tag.value !== 'bigint') {
                    errors.push(`Invalid long at ${path}: must be BigInt`);
                }
                break;
        }
    }

    // Utility method to pretty print NBT structure
    inspect(nbtData, maxDepth = 3) {
        return this._inspectTag(nbtData, 0, maxDepth);
    }

    _inspectTag(tag, depth, maxDepth) {
        if (depth > maxDepth) {
            return '...';
        }

        if (!tag || typeof tag !== 'object') {
            return String(tag);
        }

        const indent = '  '.repeat(depth);
        const type = tag.type || 'unknown';
        
        switch (type.toLowerCase()) {
            case 'compound':
                const entries = Object.entries(tag.value || {});
                if (entries.length === 0) return `${type}{}`;
                
                const compoundLines = entries.map(([key, childTag]) => {
                    const childStr = this._inspectTag(childTag, depth + 1, maxDepth);
                    return `${indent}  ${key}: ${childStr}`;
                });
                
                return `${type}{\n${compoundLines.join('\n')}\n${indent}}`;
                
            case 'list':
                const items = tag.value?.value || [];
                if (items.length === 0) return `${type}[${tag.value?.type || 'empty'}]()`;
                
                const listLines = items.slice(0, 5).map((item, index) => {
                    const itemStr = this._inspectTag(
                        { type: tag.value.type, value: item },
                        depth + 1,
                        maxDepth
                    );
                    return `${indent}  [${index}]: ${itemStr}`;
                });
                
                if (items.length > 5) {
                    listLines.push(`${indent}  ... and ${items.length - 5} more`);
                }
                
                return `${type}[${tag.value.type}](\n${listLines.join('\n')}\n${indent})`;
                
            default:
                return `${type}(${tag.value})`;
        }
    }

    // Inventory management methods
    createInventoryManager(playerData) {
        return new InventoryManager(playerData);
    }

    // Quick inventory operations
    async removeInventorySlot(playerFile, slot) {
        const data = await this.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        const removed = inventory.removeBySlot(slot);
        await this.writeDATFile(playerFile, data);
        return removed;
    }

    async removeInventoryItem(playerFile, itemId, count = -1) {
        const data = await this.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        const removed = inventory.removeByItemId(itemId, count);
        await this.writeDATFile(playerFile, data);
        return removed;
    }

    async clearInventory(playerFile) {
        const data = await this.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        const removed = inventory.clearInventory();
        await this.writeDATFile(playerFile, data);
        return removed;
    }

    async listInventory(playerFile) {
        const data = await this.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        return inventory.listItems();
    }
}

// Create and export the main instance
const minecraftNBT = new MinecraftNBT();

module.exports = minecraftNBT;
module.exports.MinecraftNBT = MinecraftNBT;
module.exports.InventoryManager = InventoryManager;
module.exports.NBT = NBT;
module.exports.SNBTConverter = SNBTConverter;
module.exports.MCAFile = MCAFile;
module.exports.TAG_TYPES = TAG_TYPES;
module.exports.TYPE_NAMES = TYPE_NAMES;