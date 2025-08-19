// examples.js - Usage examples for the Minecraft NBT library
const minecraftNBT = require('./minecraft-nbt');

async function examples() {
    console.log('=== Minecraft NBT Library Examples ===\n');

    // Example 1: Reading and editing a level.dat file
    console.log('1. Reading and editing level.dat file:');
    try {
        // Read level.dat (compressed NBT)
        const levelData = await minecraftNBT.readDATFile('level.dat');
        console.log('Level data loaded:', minecraftNBT.inspect(levelData, 1));
        
        // Edit game time
        const currentTime = minecraftNBT.getValue(levelData, 'Data.Time');
        console.log('Current game time:', currentTime?.value);
        
        // Set new time (noon)
        minecraftNBT.setValue(levelData, 'Data.Time', { type: 'long', value: 6000n });
        
        // Enable cheats
        minecraftNBT.setValue(levelData, 'Data.allowCommands', { type: 'byte', value: 1 });
        
        // Save back to file
        await minecraftNBT.writeDATFile('level_modified.dat', levelData);
        console.log('✓ Level data modified and saved\n');
        
    } catch (error) {
        console.log('Note: level.dat not found or readable -', error.message, '\n');
    }

    // Example 2: Working with player data
    console.log('2. Creating and modifying player data:');
    
    // Create new player data structure
    const playerData = minecraftNBT.createCompound({
        playerGameType: 1, // Creative mode
        Score: 0,
        Health: 20.0,
        HurtTime: 0,
        DeathTime: 0,
        Pos: [0.0, 64.0, 0.0], // X, Y, Z coordinates
        Motion: [0.0, 0.0, 0.0],
        Rotation: [0.0, 0.0], // Yaw, Pitch
        Inventory: []
    });

    console.log('Created player data:', minecraftNBT.inspect(playerData, 2));

    // Add an item to inventory
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

    // Add item to inventory list
    const inventory = minecraftNBT.getValue(playerData, 'Inventory');
    inventory.value.value.push(diamondSword.value);

    console.log('✓ Added enchanted diamond sword to inventory\n');

    // Example 3: SNBT conversion
    console.log('3. SNBT (Stringified NBT) conversion:');
    
    const simpleData = minecraftNBT.createCompound({
        name: 'TestWorld',
        version: 1,
        settings: {
            difficulty: 2,
            gamemode: 0,
            hardcore: false
        },
        spawn: [0, 64, 0]
    });

    const snbtString = minecraftNBT.toSNBT(simpleData);
    console.log('SNBT format:');
    console.log(snbtString);
    
    const parsedBack = minecraftNBT.fromSNBT(snbtString);
    console.log('✓ Successfully converted to SNBT and back\n');

    // Example 4: JSON conversion
    console.log('4. JSON conversion:');
    
    const jsonData = minecraftNBT.toJSON(simpleData);
    console.log('JSON format:');
    console.log(JSON.stringify(jsonData, null, 2));
    
    const fromJson = minecraftNBT.fromJSON(jsonData);
    console.log('✓ Successfully converted to JSON and back\n');

    // Example 5: Working with MCA files (region files)
    console.log('5. Working with MCA region files:');
    try {
        // This would read an actual region file
        // const regionData = await minecraftNBT.readMCAFile('r.0.0.mca');
        
        // Create a sample MCA file programmatically
        const { MCAFile } = minecraftNBT;
        const mca = new MCAFile();
        
        // Create a simple chunk
        const chunkData = minecraftNBT.createCompound({
            Level: {
                xPos: 0,
                zPos: 0,
                Status: 'full',
                Biomes: new Array(1024).fill(1), // Plains biome
                Heightmaps: {
                    MOTION_BLOCKING: new Array(256).fill(64)
                }
            }
        });
        
        mca.setChunk(0, 0, chunkData);
        console.log('Created MCA with chunk count:', mca.getChunkCount());
        
        // Extract specific data from all chunks
        const positions = mca.extractData('Level.xPos');
        console.log('Chunk X positions:', positions);
        
        console.log('✓ MCA file operations completed\n');
        
    } catch (error) {
        console.log('MCA example error:', error.message, '\n');
    }

    // Example 6: Data validation
    console.log('6. Data validation:');
    
    const validData = minecraftNBT.createCompound({
        test: 'valid'
    });
    
    const invalidData = {
        type: 'invalid_type',
        value: 'test'
    };
    
    console.log('Valid data errors:', minecraftNBT.validate(validData));
    console.log('Invalid data errors:', minecraftNBT.validate(invalidData));
    console.log('✓ Validation completed\n');

    // Example 7: Creating complex structures
    console.log('7. Creating complex NBT structures:');
    
    const complexStructure = {
        type: 'compound',
        name: 'CustomStructure',
        value: {
            metadata: {
                type: 'compound',
                value: {
                    version: { type: 'int', value: 1 },
                    author: { type: 'string', value: 'Player' },
                    created: { type: 'long', value: BigInt(Date.now()) }
                }
            },
            blocks: {
                type: 'list',
                value: {
                    type: 'compound',
                    value: [
                        {
                            pos: { type: 'int_array', value: [0, 0, 0] },
                            state: { type: 'string', value: 'minecraft:stone' }
                        },
                        {
                            pos: { type: 'int_array', value: [1, 0, 0] },
                            state: { type: 'string', value: 'minecraft:dirt' }
                        }
                    ].map(block => minecraftNBT.createCompound(block).value)
                }
            },
            entities: {
                type: 'list',
                value: {
                    type: 'compound',
                    value: []
                }
            }
        }
    };
    
    console.log('Complex structure:', minecraftNBT.inspect(complexStructure, 2));
    console.log('✓ Complex structure created\n');

    // Example 8: File format detection and universal reading
    console.log('8. Universal file reading:');
    
    // The library can auto-detect file types based on extension and content
    const testFiles = [
        'level.dat',      // Compressed NBT
        'player.dat',     // Compressed NBT
        'structure.nbt',  // Uncompressed NBT
        'r.0.0.mca',     // Region file
        'data.snbt',     // SNBT text file
        'config.json'    // JSON file
    ];
    
    for (const filename of testFiles) {
        try {
            console.log(`Would read ${filename} with auto-detection`);
            // const data = await minecraftNBT.readFile(filename);
        } catch (error) {
            console.log(`${filename}: ${error.message}`);
        }
    }
    
    console.log('✓ File detection examples completed\n');

    console.log('=== All examples completed! ===');
}

// Utility function for testing specific operations
async function testOperation(name, operation) {
    console.log(`Testing ${name}...`);
    try {
        await operation();
        console.log(`✓ ${name} succeeded`);
    } catch (error) {
        console.log(`✗ ${name} failed:`, error.message);
    }
}

// Performance testing function
function performanceTest() {
    console.log('\n=== Performance Tests ===');
    
    const iterations = 1000;
    
    // Test NBT parsing performance
    const testData = minecraftNBT.createCompound({
        test: 'performance',
        numbers: new Array(100).fill(0).map((_, i) => i),
        nested: {
            level1: {
                level2: {
                    level3: 'deep value'
                }
            }
        }
    });
    
    console.time('NBT stringify');
    for (let i = 0; i < iterations; i++) {
        minecraftNBT.NBT.stringify(testData);
    }
    console.timeEnd('NBT stringify');
    
    const buffer = minecraftNBT.NBT.stringify(testData);
    
    console.time('NBT parse');
    for (let i = 0; i < iterations; i++) {
        minecraftNBT.NBT.parse(buffer);
    }
    console.timeEnd('NBT parse');
    
    console.time('SNBT conversion');
    for (let i = 0; i < iterations; i++) {
        minecraftNBT.toSNBT(testData);
    }
    console.timeEnd('SNBT conversion');
    
    console.time('JSON conversion');
    for (let i = 0; i < iterations; i++) {
        minecraftNBT.toJSON(testData);
    }
    console.timeEnd('JSON conversion');
    
    console.log('✓ Performance tests completed');
}

// Export functions for use in other files
module.exports = {
    examples,
    testOperation,
    performanceTest
};

// Run examples if this file is executed directly
if (require.main === module) {
    examples()
        .then(() => performanceTest())
        .catch(console.error);
}