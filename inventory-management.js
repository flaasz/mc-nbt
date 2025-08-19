// inventory-management.js - Remove items from inventory by slot or name
const minecraftNBT = require('./minecraft-nbt');

class InventoryManager {
    constructor(playerData) {
        this.playerData = playerData;
    }

    // Get the inventory list from player data
    getInventory() {
        const inventory = minecraftNBT.getValue(this.playerData, 'Inventory');
        return inventory?.value?.value || [];
    }

    // Update the inventory list in player data
    setInventory(newInventory) {
        const inventoryTag = {
            type: 'list',
            value: {
                type: 'compound',
                value: newInventory
            }
        };
        minecraftNBT.setValue(this.playerData, 'Inventory', inventoryTag);
    }

    // Remove item by slot number
    removeBySlot(slot) {
        const inventory = this.getInventory();
        const initialCount = inventory.length;
        
        // Filter out items in the specified slot
        const newInventory = inventory.filter(item => {
            const itemSlot = minecraftNBT.getValue({ type: 'compound', value: item }, 'Slot');
            return itemSlot?.value !== slot;
        });
        
        this.setInventory(newInventory);
        return initialCount - newInventory.length; // Return number of items removed
    }

    // Remove item by item name/id
    removeByItemId(itemId, count = -1) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const id = minecraftNBT.getValue({ type: 'compound', value: item }, 'id');
            const itemCount = minecraftNBT.getValue({ type: 'compound', value: item }, 'Count');
            
            if (id?.value === itemId && (count === -1 || removedCount < count)) {
                if (count === -1) {
                    // Remove all of this item type
                    removedCount += itemCount?.value || 1;
                } else {
                    const currentItemCount = itemCount?.value || 1;
                    const toRemove = Math.min(currentItemCount, count - removedCount);
                    removedCount += toRemove;
                    
                    if (currentItemCount > toRemove) {
                        // Reduce count instead of removing entirely
                        const newCount = currentItemCount - toRemove;
                        minecraftNBT.setValue({ type: 'compound', value: item }, 'Count', { type: 'byte', value: newCount });
                        newInventory.push(item);
                    }
                    // If count becomes 0 or less, don't add to newInventory (effectively removes it)
                }
            } else {
                newInventory.push(item);
            }
        }
        
        this.setInventory(newInventory);
        return removedCount;
    }

    // Remove items by partial name match
    removeByPartialName(partialName, count = -1) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const id = minecraftNBT.getValue({ type: 'compound', value: item }, 'id');
            const itemCount = minecraftNBT.getValue({ type: 'compound', value: item }, 'Count');
            
            if (id?.value && id.value.includes(partialName) && (count === -1 || removedCount < count)) {
                if (count === -1) {
                    removedCount += itemCount?.value || 1;
                } else {
                    const currentItemCount = itemCount?.value || 1;
                    const toRemove = Math.min(currentItemCount, count - removedCount);
                    removedCount += toRemove;
                    
                    if (currentItemCount > toRemove) {
                        const newCount = currentItemCount - toRemove;
                        minecraftNBT.setValue({ type: 'compound', value: item }, 'Count', { type: 'byte', value: newCount });
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

    // Remove items with enchantments
    removeEnchantedItems(itemId = null) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const id = minecraftNBT.getValue({ type: 'compound', value: item }, 'id');
            const tag = minecraftNBT.getValue({ type: 'compound', value: item }, 'tag');
            const enchantments = tag ? minecraftNBT.getValue({ type: 'compound', value: tag }, 'Enchantments') : null;
            
            const hasEnchantments = enchantments && enchantments.value && enchantments.value.value.length > 0;
            const matchesId = !itemId || id?.value === itemId;
            
            if (hasEnchantments && matchesId) {
                const itemCount = minecraftNBT.getValue({ type: 'compound', value: item }, 'Count');
                removedCount += itemCount?.value || 1;
            } else {
                newInventory.push(item);
            }
        }
        
        this.setInventory(newInventory);
        return removedCount;
    }

    // Remove items in specific slot range (useful for armor, hotbar, etc.)
    removeBySlotRange(minSlot, maxSlot) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const slot = minecraftNBT.getValue({ type: 'compound', value: item }, 'Slot');
            const slotValue = slot?.value;
            
            if (slotValue >= minSlot && slotValue <= maxSlot) {
                const itemCount = minecraftNBT.getValue({ type: 'compound', value: item }, 'Count');
                removedCount += itemCount?.value || 1;
            } else {
                newInventory.push(item);
            }
        }
        
        this.setInventory(newInventory);
        return removedCount;
    }

    // Clear entire inventory
    clearInventory() {
        const inventory = this.getInventory();
        const itemCount = inventory.length;
        this.setInventory([]);
        return itemCount;
    }

    // List all items in inventory (for debugging)
    listItems() {
        const inventory = this.getInventory();
        return inventory.map(item => {
            const id = minecraftNBT.getValue({ type: 'compound', value: item }, 'id');
            const count = minecraftNBT.getValue({ type: 'compound', value: item }, 'Count');
            const slot = minecraftNBT.getValue({ type: 'compound', value: item }, 'Slot');
            const tag = minecraftNBT.getValue({ type: 'compound', value: item }, 'tag');
            
            return {
                id: id?.value,
                count: count?.value,
                slot: slot?.value,
                hasEnchantments: tag ? !!minecraftNBT.getValue({ type: 'compound', value: tag }, 'Enchantments') : false
            };
        });
    }

    // Find items by criteria
    findItems(criteria) {
        const inventory = this.getInventory();
        const results = [];
        
        for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i];
            const id = minecraftNBT.getValue({ type: 'compound', value: item }, 'id');
            const count = minecraftNBT.getValue({ type: 'compound', value: item }, 'Count');
            const slot = minecraftNBT.getValue({ type: 'compound', value: item }, 'Slot');
            const tag = minecraftNBT.getValue({ type: 'compound', value: item }, 'tag');
            
            const itemData = {
                index: i,
                id: id?.value,
                count: count?.value,
                slot: slot?.value,
                tag: tag?.value,
                hasEnchantments: tag ? !!minecraftNBT.getValue({ type: 'compound', value: tag }, 'Enchantments') : false
            };
            
            // Check if item matches criteria
            let matches = true;
            if (criteria.id && itemData.id !== criteria.id) matches = false;
            if (criteria.partialId && !itemData.id?.includes(criteria.partialId)) matches = false;
            if (criteria.slot !== undefined && itemData.slot !== criteria.slot) matches = false;
            if (criteria.minCount && itemData.count < criteria.minCount) matches = false;
            if (criteria.maxCount && itemData.count > criteria.maxCount) matches = false;
            if (criteria.hasEnchantments !== undefined && itemData.hasEnchantments !== criteria.hasEnchantments) matches = false;
            
            if (matches) {
                results.push(itemData);
            }
        }
        
        return results;
    }

    // Remove items by custom criteria
    removeByCriteria(criteria, maxRemove = -1) {
        const inventory = this.getInventory();
        let removedCount = 0;
        const newInventory = [];
        
        for (const item of inventory) {
            const id = minecraftNBT.getValue({ type: 'compound', value: item }, 'id');
            const count = minecraftNBT.getValue({ type: 'compound', value: item }, 'Count');
            const slot = minecraftNBT.getValue({ type: 'compound', value: item }, 'Slot');
            const tag = minecraftNBT.getValue({ type: 'compound', value: item }, 'tag');
            
            const itemData = {
                id: id?.value,
                count: count?.value,
                slot: slot?.value,
                hasEnchantments: tag ? !!minecraftNBT.getValue({ type: 'compound', value: tag }, 'Enchantments') : false
            };
            
            // Check if item matches removal criteria
            let shouldRemove = true;
            if (criteria.id && itemData.id !== criteria.id) shouldRemove = false;
            if (criteria.partialId && !itemData.id?.includes(criteria.partialId)) shouldRemove = false;
            if (criteria.slot !== undefined && itemData.slot !== criteria.slot) shouldRemove = false;
            if (criteria.minCount && itemData.count < criteria.minCount) shouldRemove = false;
            if (criteria.maxCount && itemData.count > criteria.maxCount) shouldRemove = false;
            if (criteria.hasEnchantments !== undefined && itemData.hasEnchantments !== criteria.hasEnchantments) shouldRemove = false;
            
            if (shouldRemove && (maxRemove === -1 || removedCount < maxRemove)) {
                removedCount += itemData.count;
            } else {
                newInventory.push(item);
            }
        }
        
        this.setInventory(newInventory);
        return removedCount;
    }
}

// Usage examples
async function inventoryExamples() {
    console.log('=== Inventory Management Examples ===\n');

    let playerData;
    try {
        playerData = await minecraftNBT.readDATFile('playerdata/player.dat');
    } catch (error) {
        // Create sample player data with inventory
        playerData = minecraftNBT.createCompound({
            Health: 20.0,
            Inventory: [
                {
                    id: 'minecraft:diamond_sword',
                    Count: 1,
                    Slot: 0,
                    tag: {
                        Enchantments: [
                            { id: 'minecraft:sharpness', lvl: 5 }
                        ]
                    }
                },
                {
                    id: 'minecraft:stone',
                    Count: 64,
                    Slot: 1
                },
                {
                    id: 'minecraft:diamond',
                    Count: 32,
                    Slot: 2
                },
                {
                    id: 'minecraft:diamond_pickaxe',
                    Count: 1,
                    Slot: 3,
                    tag: {
                        Enchantments: [
                            { id: 'minecraft:efficiency', lvl: 4 },
                            { id: 'minecraft:unbreaking', lvl: 3 }
                        ]
                    }
                },
                {
                    id: 'minecraft:bread',
                    Count: 16,
                    Slot: 4
                }
            ]
        });
        console.log('Created sample player data with inventory');
    }

    const inventory = new InventoryManager(playerData);

    // List current inventory
    console.log('1. Current inventory:');
    console.table(inventory.listItems());
    console.log();

    // Example 1: Remove by slot
    console.log('2. Remove item in slot 1:');
    const removedBySlot = inventory.removeBySlot(1);
    console.log(`✓ Removed ${removedBySlot} item(s) from slot 1`);
    console.table(inventory.listItems());
    console.log();

    // Example 2: Remove by item ID
    console.log('3. Remove all diamonds:');
    const removedDiamonds = inventory.removeByItemId('minecraft:diamond');
    console.log(`✓ Removed ${removedDiamonds} diamond(s)`);
    console.table(inventory.listItems());
    console.log();

    // Example 3: Remove by partial name
    console.log('4. Remove all items containing "diamond":');
    const removedDiamondItems = inventory.removeByPartialName('diamond');
    console.log(`✓ Removed ${removedDiamondItems} diamond item(s)`);
    console.table(inventory.listItems());
    console.log();

    // Example 4: Remove enchanted items
    console.log('5. Remove all enchanted items:');
    const removedEnchanted = inventory.removeEnchantedItems();
    console.log(`✓ Removed ${removedEnchanted} enchanted item(s)`);
    console.table(inventory.listItems());
    console.log();

    // Example 5: Remove by slot range (hotbar is slots 0-8)
    console.log('6. Remove items from hotbar (slots 0-8):');
    const removedFromHotbar = inventory.removeBySlotRange(0, 8);
    console.log(`✓ Removed ${removedFromHotbar} item(s) from hotbar`);
    console.table(inventory.listItems());
    console.log();

    // Re-populate for more examples
    inventory.setInventory([
        minecraftNBT.createCompound({
            id: 'minecraft:stone',
            Count: 64,
            Slot: 0
        }).value,
        minecraftNBT.createCompound({
            id: 'minecraft:cobblestone',
            Count: 32,
            Slot: 1
        }).value,
        minecraftNBT.createCompound({
            id: 'minecraft:stone_bricks',
            Count: 16,
            Slot: 2
        }).value
    ]);

    console.log('7. Re-populated inventory:');
    console.table(inventory.listItems());
    console.log();

    // Example 6: Remove by criteria
    console.log('8. Remove items with "stone" in name and count > 30:');
    const removedByCriteria = inventory.removeByCriteria({
        partialId: 'stone',
        minCount: 30
    });
    console.log(`✓ Removed ${removedByCriteria} item(s) matching criteria`);
    console.table(inventory.listItems());
    console.log();

    // Example 7: Find items before removing
    console.log('9. Find and remove specific items:');
    const foundItems = inventory.findItems({ partialId: 'stone' });
    console.log('Found items:', foundItems);
    
    for (const item of foundItems) {
        inventory.removeBySlot(item.slot);
        console.log(`✓ Removed ${item.id} from slot ${item.slot}`);
    }
    console.table(inventory.listItems());
    console.log();

    // Save modified player data
    try {
        await minecraftNBT.writeDATFile('modified_player_inventory.dat', playerData);
        console.log('✓ Saved modified player data with updated inventory');
    } catch (error) {
        console.log('! Could not save player data:', error.message);
    }

    console.log('\n=== Inventory Management Examples Complete ===');
}

// Convenience functions for quick use
const InventoryUtils = {
    // Quick remove by slot
    async removeSlot(playerFile, slot) {
        const data = await minecraftNBT.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        const removed = inventory.removeBySlot(slot);
        await minecraftNBT.writeDATFile(playerFile, data);
        return removed;
    },

    // Quick remove by item ID
    async removeItem(playerFile, itemId, count = -1) {
        const data = await minecraftNBT.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        const removed = inventory.removeByItemId(itemId, count);
        await minecraftNBT.writeDATFile(playerFile, data);
        return removed;
    },

    // Quick clear inventory
    async clearInventory(playerFile) {
        const data = await minecraftNBT.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        const removed = inventory.clearInventory();
        await minecraftNBT.writeDATFile(playerFile, data);
        return removed;
    },

    // Quick list inventory
    async listInventory(playerFile) {
        const data = await minecraftNBT.readDATFile(playerFile);
        const inventory = new InventoryManager(data);
        return inventory.listItems();
    }
};

module.exports = {
    InventoryManager,
    InventoryUtils,
    inventoryExamples
};

// Run examples if executed directly
if (require.main === module) {
    inventoryExamples().catch(console.error);
}