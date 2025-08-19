// mca-handler.js - MCA (Minecraft Chunk Archive) file handling
const fs = require('fs').promises;
const zlib = require('zlib');
const { NBT } = require('./nbt-core');

const SECTOR_SIZE = 4096;
const HEADER_SIZE = 4096;

class MCAFile {
    constructor() {
        this.chunks = new Map(); // Map of "x,z" -> chunk data
        this.locations = new Array(1024).fill(null); // 32x32 chunks
        this.timestamps = new Array(1024).fill(0);
    }

    static async load(filepath) {
        const buffer = await fs.readFile(filepath);
        const mca = new MCAFile();
        mca.parseFile(buffer);
        return mca;
    }

    parseFile(buffer) {
        // Read location header (first 4096 bytes)
        for (let i = 0; i < 1024; i++) {
            const offset = i * 4;
            const locationData = buffer.readUInt32BE(offset);
            
            const sectorOffset = (locationData >> 8) & 0xFFFFFF;
            const sectorCount = locationData & 0xFF;
            
            if (sectorOffset !== 0 && sectorCount !== 0) {
                this.locations[i] = { offset: sectorOffset, count: sectorCount };
            }
        }

        // Read timestamp header (second 4096 bytes)
        for (let i = 0; i < 1024; i++) {
            const offset = HEADER_SIZE + (i * 4);
            this.timestamps[i] = buffer.readUInt32BE(offset);
        }

        // Read chunk data
        for (let i = 0; i < 1024; i++) {
            const location = this.locations[i];
            if (!location) continue;

            const x = i % 32;
            const z = Math.floor(i / 32);
            
            try {
                const chunkData = this.readChunk(buffer, location);
                if (chunkData) {
                    this.chunks.set(`${x},${z}`, chunkData);
                }
            } catch (error) {
                console.warn(`Failed to read chunk at ${x},${z}:`, error.message);
            }
        }
    }

    readChunk(buffer, location) {
        const byteOffset = location.offset * SECTOR_SIZE;
        
        if (byteOffset + 5 > buffer.length) {
            throw new Error('Chunk offset beyond file bounds');
        }

        // Read chunk header
        const length = buffer.readUInt32BE(byteOffset);
        const compressionType = buffer.readUInt8(byteOffset + 4);

        if (length === 0) {
            return null;
        }

        // Read chunk data
        const chunkDataStart = byteOffset + 5;
        const chunkDataEnd = chunkDataStart + length - 1;
        
        if (chunkDataEnd > buffer.length) {
            throw new Error('Chunk data extends beyond file bounds');
        }

        const compressedData = buffer.slice(chunkDataStart, chunkDataEnd);
        
        // Decompress based on compression type
        let decompressedData;
        switch (compressionType) {
            case 1: // GZip
                decompressedData = zlib.gunzipSync(compressedData);
                break;
            case 2: // Zlib (deflate)
                decompressedData = zlib.inflateSync(compressedData);
                break;
            case 3: // Uncompressed
                decompressedData = compressedData;
                break;
            default:
                throw new Error(`Unknown compression type: ${compressionType}`);
        }

        // Parse NBT data
        return NBT.parse(decompressedData);
    }

    getChunk(x, z) {
        const regionX = x & 31; // x % 32
        const regionZ = z & 31; // z % 32
        return this.chunks.get(`${regionX},${regionZ}`);
    }

    setChunk(x, z, chunkData) {
        const regionX = x & 31;
        const regionZ = z & 31;
        this.chunks.set(`${regionX},${regionZ}`, chunkData);
        
        // Update timestamp
        const index = regionZ * 32 + regionX;
        this.timestamps[index] = Math.floor(Date.now() / 1000);
    }

    removeChunk(x, z) {
        const regionX = x & 31;
        const regionZ = z & 31;
        const key = `${regionX},${regionZ}`;
        
        if (this.chunks.has(key)) {
            this.chunks.delete(key);
            const index = regionZ * 32 + regionX;
            this.locations[index] = null;
            this.timestamps[index] = 0;
            return true;
        }
        return false;
    }

    getAllChunks() {
        const chunks = [];
        for (const [key, data] of this.chunks.entries()) {
            const [x, z] = key.split(',').map(Number);
            chunks.push({ x, z, data });
        }
        return chunks;
    }

    async save(filepath) {
        const buffer = this.createMCABuffer();
        await fs.writeFile(filepath, buffer);
    }

    createMCABuffer() {
        const chunks = Array.from(this.chunks.entries()).map(([key, data]) => {
            const [x, z] = key.split(',').map(Number);
            return { x, z, data };
        });

        // Calculate required sectors for each chunk
        const chunkSectors = [];
        let currentSector = 2; // First two sectors are headers

        for (const chunk of chunks) {
            const nbtBuffer = NBT.stringify(chunk.data);
            const compressedData = zlib.deflateSync(nbtBuffer);
            const totalSize = compressedData.length + 5; // +5 for length and compression type
            const sectorsNeeded = Math.ceil(totalSize / SECTOR_SIZE);
            
            chunkSectors.push({
                ...chunk,
                compressedData,
                startSector: currentSector,
                sectorCount: sectorsNeeded
            });
            
            currentSector += sectorsNeeded;
        }

        // Calculate total file size
        const totalSectors = currentSector;
        const totalSize = totalSectors * SECTOR_SIZE;
        const buffer = Buffer.alloc(totalSize);

        // Write location header
        for (const chunkInfo of chunkSectors) {
            const index = chunkInfo.z * 32 + chunkInfo.x;
            const locationData = (chunkInfo.startSector << 8) | chunkInfo.sectorCount;
            buffer.writeUInt32BE(locationData, index * 4);
        }

        // Write timestamp header
        for (const chunkInfo of chunkSectors) {
            const index = chunkInfo.z * 32 + chunkInfo.x;
            const timestamp = this.timestamps[index] || Math.floor(Date.now() / 1000);
            buffer.writeUInt32BE(timestamp, HEADER_SIZE + (index * 4));
        }

        // Write chunk data
        for (const chunkInfo of chunkSectors) {
            const offset = chunkInfo.startSector * SECTOR_SIZE;
            
            // Write chunk length and compression type
            buffer.writeUInt32BE(chunkInfo.compressedData.length + 1, offset);
            buffer.writeUInt8(2, offset + 4); // Zlib compression
            
            // Write compressed data
            chunkInfo.compressedData.copy(buffer, offset + 5);
        }

        return buffer;
    }

    toJSON() {
        const result = {
            chunks: {},
            timestamps: {}
        };

        for (const [key, data] of this.chunks.entries()) {
            const [x, z] = key.split(',').map(Number);
            const index = z * 32 + x;
            
            result.chunks[`${x},${z}`] = data;
            result.timestamps[`${x},${z}`] = this.timestamps[index];
        }

        return result;
    }

    static fromJSON(jsonData) {
        const mca = new MCAFile();
        
        if (jsonData.chunks) {
            for (const [key, data] of Object.entries(jsonData.chunks)) {
                const [x, z] = key.split(',').map(Number);
                mca.setChunk(x, z, data);
            }
        }

        if (jsonData.timestamps) {
            for (const [key, timestamp] of Object.entries(jsonData.timestamps)) {
                const [x, z] = key.split(',').map(Number);
                const index = z * 32 + x;
                mca.timestamps[index] = timestamp;
            }
        }

        return mca;
    }

    getChunkCount() {
        return this.chunks.size;
    }

    getRegionBounds() {
        if (this.chunks.size === 0) {
            return null;
        }

        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const key of this.chunks.keys()) {
            const [x, z] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }

        return { minX, maxX, minZ, maxZ };
    }

    // Utility method to extract specific data from chunks
    extractData(path) {
        const results = {};
        
        for (const [key, chunk] of this.chunks.entries()) {
            try {
                const value = this.getNestedValue(chunk, path);
                if (value !== undefined) {
                    results[key] = value;
                }
            } catch (error) {
                // Ignore chunks that don't have the requested path
            }
        }
        
        return results;
    }

    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && current.value) {
                if (current.type === 'compound' && current.value[part]) {
                    current = current.value[part];
                } else if (current.type === 'list' && !isNaN(part)) {
                    current = current.value.value[parseInt(part)];
                } else {
                    return undefined;
                }
            } else {
                return undefined;
            }
        }
        
        return current;
    }
}

module.exports = { MCAFile };