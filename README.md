# Minecraft NBT Library

A comprehensive Node.js library for reading, writing, and manipulating Minecraft NBT (Named Binary Tag), DAT, and MCA (Minecraft Chunk Archive) files. Supports conversion between binary formats, SNBT (Stringified NBT), and JSON with full round-trip compatibility and zero data corruption.

## Features

- **Complete NBT Support**: Read and write all NBT tag types (Byte, Short, Int, Long, Float, Double, String, ByteArray, IntArray, LongArray, List, Compound)
- **Multiple File Formats**: 
  - `.nbt` files (uncompressed NBT)
  - `.dat` files (gzip-compressed NBT, like level.dat, player data)
  - `.mca` files (Minecraft region files containing multiple chunks)
  - `.snbt` files (Stringified NBT text format)
  - `.json` files (with type preservation)
- **Format Conversion**: Convert between NBT, SNBT, and JSON formats
- **Data Integrity**: Preserves exact data types and values without corruption
- **Auto-detection**: Automatically detects file types based on extension and content
- **Chunk Manipulation**: Full support for reading and writing individual chunks in region files
- **Inventory Management**: Complete player inventory manipulation (add, remove, modify items)
- **Validation**: Built-in validation for NBT data structures
- **High Performance**: Optimized binary parsing with minimal memory overhead

## Installation

```bash
npm install minecraft-nbt
```

## Quick Start

```javascript
const minecraftNBT = require('minecraft-nbt');

// Read any Minecraft file (auto-detects format)
const data = await minecraftNBT.readFile('level.dat');

// Edit a value
minecraftNBT.setValue(data, 'Data.GameType', { type: 'int', value: 1 });

// Save back to file
await minecraftNBT.writeDATFile('level.dat', data);
```

## API Reference

### Core Methods

#### File Operations

```javascript
// Universal file reader (auto-detects format)
const data = await minecraftNBT.readFile(filepath);

// Specific format readers
const nbtData = await minecraftNBT.readNBTFile('structure.nbt');
const datData = await minecraftNBT.readDATFile('level.dat');
const mcaData = await minecraftNBT.readMCAFile('r.0.0.mca');
const snbtData = await minecraftNBT.readSNBTFile('data.snbt');
const jsonData = await minecraftNBT.readJSONFile('config.json');

// Specific format writers
await minecraftNBT.writeNBTFile('output.nbt', nbtData);
await minecraftNBT.writeDATFile('output.dat', datData);
await minecraftNBT.writeMCAFile('output.mca', mcaData);
await minecraftNBT.writeSNBTFile('output.snbt', snbtData);
await minecraftNBT.writeJSONFile('output.json', jsonData);
```

#### Format Conversion

```javascript
// Convert to SNBT (Stringified NBT)
const snbtString = minecraftNBT.toSNBT(nbtData, pretty = true);
const nbtFromSNBT = minecraftNBT.fromSNBT(snbtString);

// Convert to JSON
const jsonObject = minecraftNBT.toJSON(nbtData);
const nbtFromJSON = minecraftNBT.fromJSON(jsonObject, inferTypes = true);
```

#### Data Manipulation

```javascript
// Get nested values
const gameType = minecraftNBT.getValue(levelData, 'Data.GameType');
const playerHealth = minecraftNBT.getValue(playerData, 'Health');

// Set nested values
minecraftNBT.setValue(levelData, 'Data.Time', { type: 'long', value: 6000n });
minecraftNBT.setValue(playerData, 'Health', { type: 'float', value: 20.0 });

// Create new structures
const compound = minecraftNBT.createCompound({
    name: 'TestWorld',
    version: 1,
    settings: { difficulty: 2 }
});

const list = minecraftNBT.createList([1, 2, 3, 4], 'int');
```

#### Validation and Inspection

```javascript
// Validate NBT structure
const errors = minecraftNBT.validate(nbtData);
if (errors.length > 0) {
    console.log('Validation errors:', errors);
}

// Pretty-print structure
console.log(minecraftNBT.inspect(nbtData, maxDepth = 3));
```

### MCA (Region File) Operations

```javascript
const { MCAFile } = require('minecraft-nbt');

// Load region file
const mca = await MCAFile.load('r.0.0.mca');

// Get chunk data
const chunk = mca.getChunk(0, 0); // chunk coordinates within region

// Set chunk data
mca.setChunk(0, 0, chunkData);

// Remove chunk
mca.removeChunk(0, 0);

// Get all chunks
const allChunks = mca.getAllChunks();

// Extract specific data from all chunks
const biomes = mca.extractData('Level.Biomes');
const heightmaps = mca.extractData('Level.Heightmaps.MOTION_BLOCKING');

// Get region info
console.log('Chunk count:', mca.getChunkCount());
console.log('Region bounds:', mca.getRegionBounds());

// Save region file
await mca.save('modified_region.mca');
```

### Inventory Management

```javascript
const { InventoryManager } = require('minecraft-nbt');

// Load player data
const playerData = await minecraftNBT.readDATFile('playerdata/player.dat');
const inventory = new InventoryManager(playerData);

// Remove items by slot
inventory.removeBySlot(0); // Remove item in hotbar slot 0

// Remove items by ID
inventory.removeByItemId('minecraft:stone'); // Remove all stone
inventory.removeByItemId('minecraft:diamond', 5); // Remove up to 5 diamonds

// Remove items by partial name
inventory.removeByPartialName('diamond'); // Remove all diamond items

// Remove by slot range
inventory.removeBySlotRange(0, 8); // Clear hotbar (slots 0-8)
inventory.removeBySlotRange(36, 39); // Clear armor slots

// List current inventory
const items = inventory.listItems();
console.table(items);

// Clear entire inventory
inventory.clearInventory();

// Save changes
await minecraftNBT.writeDATFile('playerdata/player.dat', playerData);

// Quick utility functions
await minecraftNBT.removeInventorySlot('player.dat', 0);
await minecraftNBT.removeInventoryItem('player.dat', 'minecraft:stone');
await minecraftNBT.clearInventory('player.dat');
const items = await minecraftNBT.listInventory('player.dat');
```

## Data Types

The library supports all NBT tag types with proper JavaScript mappings:

| NBT Type | JavaScript Type | Example |
|----------|----------------|---------|
| Byte | Number (-128 to 127) | `{ type: 'byte', value: 42 }` |
| Short | Number (-32768 to 32767) | `{ type: 'short', value: 1000 }` |
| Int | Number (-2³¹ to 2³¹-1) | `{ type: 'int', value: 100000 }` |
| Long | BigInt | `{ type: 'long', value: 9223372036854775807n }` |
| Float | Number | `{ type: 'float', value: 3.14 }` |
| Double | Number | `{ type: 'double', value: 3.141592653589793 }` |
| String | String | `{ type: 'string', value: 'Hello World' }` |
| ByteArray | Array<Number> | `{ type: 'byte_array', value: [1, 2, 3] }` |
| IntArray | Array<Number> | `{ type: 'int_array', value: [100, 200, 300] }` |
| LongArray | Array<BigInt> | `{ type: 'long_array', value: [100n, 200n] }` |
| List | Object | `{ type: 'list', value: { type: 'string', value: ['a', 'b'] } }` |
| Compound | Object | `{ type: 'compound', value: { key: tag } }` |

## Inventory Management

### Inventory Structure

Minecraft inventory is stored as a `list` of `compound` tags where each item contains:
- **id**: Item identifier (e.g., `minecraft:diamond_sword`)
- **Count**: Stack size (1-64 for most items)
- **Slot**: Inventory slot number (0-40+)
- **tag**: Optional enchantments, durability, custom data

### Slot Reference

| Slot Range | Description |
|------------|-------------|
| 0-8 | Hotbar |
| 9-35 | Main inventory |
| 36-39 | Armor (boots, leggings, chestplate, helmet) |
| 40 | Offhand |
| 103-106 | Armor slots (alternative numbering) |

### InventoryManager Methods

```javascript
const { InventoryManager } = minecraftNBT;
const inventory = new InventoryManager(playerData);

// Core removal methods
inventory.removeBySlot(slot)                    // Remove by slot number
inventory.removeByItemId(itemId, count = -1)    // Remove by item ID
inventory.removeByPartialName(partial, count)   // Remove by name containing text
inventory.removeBySlotRange(min, max)           // Remove from slot range
inventory.clearInventory()                      // Remove all items

// Information methods
inventory.listItems()                           // Get all items with details
inventory.getInventory()                        // Get raw inventory array
inventory.setInventory(newInventory)            // Set entire inventory

// Example item structure
const item = {
    id: "minecraft:diamond_sword",
    Count: 1,
    Slot: 0,
    tag: {
        Enchantments: [
            { id: "minecraft:sharpness", lvl: 5 },
            { id: "minecraft:unbreaking", lvl: 3 }
        ],
        Damage: 0
    }
};
```

## Examples

### Editing Level Data

```javascript
const minecraftNBT = require('minecraft-nbt');

async function editLevel() {
    // Load level.dat
    const levelData = await minecraftNBT.readDATFile('level.dat');
    
    // Change to creative mode
    minecraftNBT.setValue(levelData, 'Data.GameType', { type: 'int', value: 1 });
    
    // Set time to noon
    minecraftNBT.setValue(levelData, 'Data.Time', { type: 'long', value: 6000n });
    
    // Enable cheats
    minecraftNBT.setValue(levelData, 'Data.allowCommands', { type: 'byte', value: 1 });
    
    // Save changes
    await minecraftNBT.writeDATFile('level.dat', levelData);
    console.log('Level data updated successfully!');
}
```

### Creating Player Inventory

```javascript
async function createPlayerWithItems() {
    // Create player data
    const playerData = minecraftNBT.createCompound({
        Health: 20.0,
        foodLevel: 20,
        Pos: [0.0, 64.0, 0.0],
        Inventory: []
    });
    
    // Create enchanted diamond sword
    const diamondSword = minecraftNBT.createCompound({
        id: 'minecraft:diamond_sword',
        Count: 1,
        Slot: 0,
        tag: {
            Enchantments: [
                { id: 'minecraft:sharpness', lvl: 5 },
                { id: 'minecraft:unbreaking', lvl: 3 }
            ]
        }
    });
    
    // Add to inventory
    const inventory = minecraftNBT.getValue(playerData, 'Inventory');
    inventory.value.value.push(diamondSword.value);
    
    // Save player data
    await minecraftNBT.writeDATFile('player.dat', playerData);
}
```

### Working with Region Files

```javascript
async function processRegion() {
    const { MCAFile } = minecraftNBT;
    
    // Load region file
    const mca = await MCAFile.load('r.0.0.mca');
    
    // Process all chunks
    const chunks = mca.getAllChunks();
    for (const { x, z, data } of chunks) {
        // Get chunk status
        const status = minecraftNBT.getValue(data, 'Level.Status');
        console.log(`Chunk ${x},${z}: ${status?.value}`);
        
        // Modify biomes (make everything plains)
        const biomes = minecraftNBT.getValue(data, 'Level.Biomes');
        if (biomes && biomes.value) {
            biomes.value.fill(1); // Plains biome ID
        }
        
        // Update chunk
        mca.setChunk(x, z, data);
    }
    
    // Save modified region
    await mca.save('modified_region.mca');
}
```

### Complete Inventory Management

```javascript
async function managePlayerInventory() {
    const { InventoryManager } = minecraftNBT;
    
    // Load player data
    const playerData = await minecraftNBT.readDATFile('playerdata/player.dat');
    const inventory = new InventoryManager(playerData);
    
    // List current inventory
    console.log('Current inventory:');
    console.table(inventory.listItems());
    
    // Remove specific items
    inventory.removeBySlot(0); // Remove hotbar slot 0
    inventory.removeByItemId('minecraft:stone', 32); // Remove up to 32 stone
    inventory.removeByPartialName('diamond'); // Remove all diamond items
    
    // Clear equipment slots
    inventory.removeBySlotRange(36, 39); // Clear armor
    inventory.removeBySlotRange(0, 8); // Clear hotbar
    
    // Add new items
    const newSword = minecraftNBT.createCompound({
        id: 'minecraft:netherite_sword',
        Count: 1,
        Slot: 0,
        tag: {
            Enchantments: [
                { id: 'minecraft:sharpness', lvl: 5 },
                { id: 'minecraft:looting', lvl: 3 },
                { id: 'minecraft:unbreaking', lvl: 3 }
            ]
        }
    });
    
    // Add to inventory manually
    const currentInventory = inventory.getInventory();
    currentInventory.push(newSword.value);
    inventory.setInventory(currentInventory);
    
    // Save changes
    await minecraftNBT.writeDATFile('playerdata/player.dat', playerData);
    console.log('Inventory updated successfully!');
}

// Quick inventory operations
async function quickInventoryOps() {
    // One-liner operations
    await minecraftNBT.removeInventorySlot('player.dat', 0);
    await minecraftNBT.removeInventoryItem('player.dat', 'minecraft:stone');
    await minecraftNBT.clearInventory('player.dat');
    
    // List inventory
    const items = await minecraftNBT.listInventory('player.dat');
    console.table(items);
}

// Remove specific item types
async function removeItemTypes() {
    const playerData = await minecraftNBT.readDATFile('playerdata/player.dat');
    const inventory = new InventoryManager(playerData);
    
    // Remove all weapons
    inventory.removeByPartialName('sword');
    inventory.removeByPartialName('axe');
    inventory.removeByPartialName('bow');
    
    // Remove all food
    const foodItems = ['bread', 'apple', 'beef', 'pork', 'chicken', 'fish'];
    foodItems.forEach(food => inventory.removeByPartialName(food));
    
    // Remove damaged items (custom logic)
    const items = inventory.listItems();
    items.forEach(item => {
        if (item.id && item.id.includes('_pickaxe')) {
            inventory.removeBySlot(item.slot);
        }
    });
    
    await minecraftNBT.writeDATFile('playerdata/player.dat', playerData);
}
```
```

### SNBT and JSON Conversion

```javascript
// Convert NBT to human-readable SNBT
const nbtData = minecraftNBT.createCompound({
    name: 'TestItem',
    durability: 100,
    enchantments: ['sharpness', 'unbreaking']
});

const snbt = minecraftNBT.toSNBT(nbtData);
console.log('SNBT:', snbt);
// Output: {name:"TestItem",durability:100,enchantments:["sharpness","unbreaking"]}

// Convert to JSON for easy manipulation
const json = minecraftNBT.toJSON(nbtData);
console.log('JSON:', JSON.stringify(json, null, 2));

// Convert back to NBT
const backToNBT = minecraftNBT.fromJSON(json);
```

## Error Handling

The library provides comprehensive error handling:

```javascript
try {
    const data = await minecraftNBT.readFile('nonexistent.dat');
} catch (error) {
    if (error.message.includes('ENOENT')) {
        console.log('File not found');
    } else {
        console.log('Parse error:', error.message);
    }
}

// Validate data before saving
const errors = minecraftNBT.validate(nbtData);
if (errors.length > 0) {
    console.error('Invalid NBT data:', errors);
    return;
}
```

## Performance

The library is optimized for performance:

- **Streaming**: Large files are processed efficiently without loading everything into memory
- **Binary Parsing**: Direct buffer operations for maximum speed
- **Minimal Allocations**: Reuses buffers where possible
- **Compression**: Built-in gzip/zlib support for DAT files

Typical performance (on modern hardware):
- Parse 1MB NBT file: ~50ms
- Convert to SNBT: ~10ms
- Load MCA region file: ~100-200ms

## Requirements

- Node.js 12.0.0 or higher
- No external dependencies (uses only Node.js built-in modules)

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests for any improvements.

## Changelog

### 1.0.0
- Initial release
- Full NBT, DAT, and MCA file support
- SNBT and JSON conversion
- Complete inventory management system
- Player inventory manipulation (add, remove, modify items by slot or ID)
- Slot-based and name-based item removal
- Comprehensive validation and error handling
- Complete test suite and documentation