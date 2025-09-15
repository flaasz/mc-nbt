// mca-handler.js - MCA (Minecraft Chunk Archive) file handling
const fs = require('fs').promises;
const zlib = require('zlib');
const util = require('util');
const { NBT } = require('./nbt-core');

// Async compression methods
const gunzipAsync = util.promisify(zlib.gunzip);
const inflateAsync = util.promisify(zlib.inflate);
const deflateAsync = util.promisify(zlib.deflate);

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

    static async loadAsync(filepath, options = {}) {
        const buffer = await fs.readFile(filepath);
        const mca = new MCAFile();
        await mca.parseFileAsync(buffer, options);
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

    async parseFileAsync(buffer, options = {}) {
        const { lazy = false, maxConcurrency = 10 } = options;

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

        if (lazy) {
            // Store buffer reference for lazy loading
            this._buffer = buffer;
            return;
        }

        // Read chunk data with parallel processing
        const validChunks = [];
        for (let i = 0; i < 1024; i++) {
            const location = this.locations[i];
            if (location) {
                validChunks.push({ index: i, location });
            }
        }

        // Process chunks in batches to control concurrency
        for (let i = 0; i < validChunks.length; i += maxConcurrency) {
            const batch = validChunks.slice(i, i + maxConcurrency);

            const chunkPromises = batch.map(async ({ index, location }) => {
                const x = index % 32;
                const z = Math.floor(index / 32);

                try {
                    const chunkData = await this.readChunkAsync(buffer, location);
                    if (chunkData) {
                        return { x, z, chunkData };
                    }
                } catch (error) {
                    console.warn(`Failed to read chunk at ${x},${z}:`, error.message);
                }
                return null;
            });

            const results = await Promise.all(chunkPromises);

            // Store successful chunks
            for (const result of results) {
                if (result) {
                    this.chunks.set(`${result.x},${result.z}`, result.chunkData);
                }
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

    async readChunkAsync(buffer, location) {
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

        // Decompress based on compression type (async)
        let decompressedData;
        switch (compressionType) {
            case 1: // GZip
                decompressedData = await gunzipAsync(compressedData);
                break;
            case 2: // Zlib (deflate)
                decompressedData = await inflateAsync(compressedData);
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

    async getChunkAsync(x, z) {
        const regionX = x & 31; // x % 32
        const regionZ = z & 31; // z % 32
        const key = `${regionX},${regionZ}`;

        // Return cached chunk if available
        if (this.chunks.has(key)) {
            return this.chunks.get(key);
        }

        // Lazy load chunk if buffer is available
        if (this._buffer) {
            const index = regionZ * 32 + regionX;
            const location = this.locations[index];

            if (location) {
                try {
                    const chunkData = await this.readChunkAsync(this._buffer, location);
                    if (chunkData) {
                        this.chunks.set(key, chunkData);
                        return chunkData;
                    }
                } catch (error) {
                    console.warn(`Failed to lazy load chunk at ${regionX},${regionZ}:`, error.message);
                }
            }
        }

        return undefined;
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

    async saveAsync(filepath) {
        const buffer = await this.createMCABufferAsync();
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

    async createMCABufferAsync() {
        const chunks = Array.from(this.chunks.entries()).map(([key, data]) => {
            const [x, z] = key.split(',').map(Number);
            return { x, z, data };
        });

        // Calculate required sectors for each chunk (async compression)
        const chunkSectors = [];
        let currentSector = 2; // First two sectors are headers

        const compressionPromises = chunks.map(async (chunk) => {
            const nbtBuffer = NBT.stringify(chunk.data);
            const compressedData = await deflateAsync(nbtBuffer);
            const totalSize = compressedData.length + 5; // +5 for length and compression type
            const sectorsNeeded = Math.ceil(totalSize / SECTOR_SIZE);

            return {
                ...chunk,
                compressedData,
                sectorsNeeded
            };
        });

        const compressedChunks = await Promise.all(compressionPromises);

        // Assign sectors sequentially
        for (const compressedChunk of compressedChunks) {
            chunkSectors.push({
                ...compressedChunk,
                startSector: currentSector,
                sectorCount: compressedChunk.sectorsNeeded
            });
            currentSector += compressedChunk.sectorsNeeded;
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

    // Bulk operations for processing multiple MCA files
    static async loadMultipleAsync(filepaths, options = {}) {
        const { maxConcurrency = 5, lazy = false } = options;
        const mcaFiles = new Map();

        // Process files in batches to control concurrency
        for (let i = 0; i < filepaths.length; i += maxConcurrency) {
            const batch = filepaths.slice(i, i + maxConcurrency);

            const loadPromises = batch.map(async (filepath) => {
                try {
                    const mca = await MCAFile.loadAsync(filepath, { lazy });
                    return { filepath, mca, success: true };
                } catch (error) {
                    console.warn(`Failed to load MCA file ${filepath}:`, error.message);
                    return { filepath, error, success: false };
                }
            });

            const results = await Promise.all(loadPromises);

            // Store successful loads
            for (const result of results) {
                if (result.success) {
                    mcaFiles.set(result.filepath, result.mca);
                }
            }
        }

        return mcaFiles;
    }

    static async saveMultipleAsync(mcaFiles, options = {}) {
        const { maxConcurrency = 5 } = options;
        const entries = Array.from(mcaFiles.entries());
        const results = [];

        // Process saves in batches to control concurrency
        for (let i = 0; i < entries.length; i += maxConcurrency) {
            const batch = entries.slice(i, i + maxConcurrency);

            const savePromises = batch.map(async ([filepath, mca]) => {
                try {
                    await mca.saveAsync(filepath);
                    return { filepath, success: true };
                } catch (error) {
                    console.warn(`Failed to save MCA file ${filepath}:`, error.message);
                    return { filepath, error, success: false };
                }
            });

            const batchResults = await Promise.all(savePromises);
            results.push(...batchResults);
        }

        return results;
    }

    static async processDirectoryAsync(directoryPath, processFunction, options = {}) {
        const { maxConcurrency = 5, lazy = true, filter = (filename) => filename.endsWith('.mca') } = options;

        // Read directory and filter MCA files
        const files = await fs.readdir(directoryPath);
        const mcaFiles = files.filter(filter);
        const filepaths = mcaFiles.map(file => `${directoryPath}/${file}`);

        console.log(`Found ${mcaFiles.length} MCA files in ${directoryPath}`);

        // Load files with lazy loading for memory efficiency
        const loadedFiles = await MCAFile.loadMultipleAsync(filepaths, { maxConcurrency, lazy });

        // Process each file
        const processResults = [];
        for (const [filepath, mca] of loadedFiles) {
            try {
                const result = await processFunction(mca, filepath);
                processResults.push({ filepath, result, success: true });
            } catch (error) {
                console.warn(`Failed to process ${filepath}:`, error.message);
                processResults.push({ filepath, error, success: false });
            }
        }

        return {
            totalFiles: mcaFiles.length,
            loadedFiles: loadedFiles.size,
            processResults
        };
    }

    // Memory cleanup for lazy-loaded files
    clearBuffer() {
        this._buffer = null;
    }

    // Get memory usage estimate
    getMemoryUsage() {
        const chunkCount = this.chunks.size;
        const bufferSize = this._buffer ? this._buffer.length : 0;
        const estimatedChunkData = chunkCount * 50000; // Rough estimate

        return {
            chunkCount,
            bufferSize,
            estimatedChunkData,
            totalEstimate: bufferSize + estimatedChunkData
        };
    }
}

module.exports = { MCAFile };