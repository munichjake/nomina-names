/**
 * Test script for Nomina Names API
 * Copy this into the Foundry console to test the integrated API
 */

(async function testNominaNamesAPI() {
  console.log('🧪 Testing Nomina Names API...');

  // Check if module is available
  if (!game.modules.get('nomina-names')?.active) {
    console.error('❌ Nomina Names module is not active');
    return;
  }

  const api = game.modules.get('nomina-names').api;

  if (!api) {
    console.error('❌ Nomina Names API not available');
    return;
  }

  console.log('✅ API found, running tests...');

  try {
    // Test 1: New convenience functions
    console.log('\n📝 Test 1: Convenience Functions');
    const basicName = await api.randomName();
    const elfName = await api.randomName('elf');
    const dwarfFemale = await api.randomName('dwarf', 'female');
    console.log('Basic name:', basicName);
    console.log('Elf name:', elfName);
    console.log('Dwarf female:', dwarfFemale);

    // Test 2: Component functions
    console.log('\n📝 Test 2: Component Functions');
    const firstName = await api.firstName('elf', 'female');
    const surname = await api.surname('dwarf');
    console.log('Elf female first name:', firstName);
    console.log('Dwarf surname:', surname);

    // Test 3: Content generation
    console.log('\n📝 Test 3: Content Generation');
    const settlement = await api.settlement();
    const tavern = await api.tavern();
    const shop = await api.shop();
    const book = await api.book();
    console.log('Settlement:', settlement);
    console.log('Tavern:', tavern);
    console.log('Shop:', shop);
    console.log('Book:', book);

    // Test 4: Advanced functions
    console.log('\n📝 Test 4: Advanced Functions');
    const multipleNames = await api.multipleNames(3, 'human', 'mixed');
    const npc = await api.quickNPC('halfling', 'female');
    console.log('Multiple names:', multipleNames);
    console.log('NPC:', npc);

    // Test 5: Original API still works
    console.log('\n📝 Test 5: Original API Compatibility');
    const originalName = await api.generateName({
      language: 'de',
      species: 'elf',
      gender: 'male',
      category: 'names',
      components: ['firstname', 'surname'],
      format: '{firstname} {surname}'
    });
    console.log('Original API name:', originalName);

    // Test 6: Error handling
    console.log('\n📝 Test 6: Error Handling');
    const fallbackName = await api.randomName('invalid-species');
    console.log('Fallback for invalid species:', fallbackName);

    console.log('\n✅ All tests completed successfully!');

    // Usage examples
    console.log('\n🎯 Updated API Usage Examples:');
    console.log(`
    // SIMPLIFIED API - New convenience functions:
    const api = game.modules.get('nomina-names').api;

    // Quick generation
    const name = await api.randomName();                    // "${basicName}"
    const elfName = await api.randomName('elf');            // "${elfName}"
    const femaleHuman = await api.randomName('human', 'female'); // "${dwarfFemale}"

    // Content types
    const tavernName = await api.tavern();                  // "${tavern}"
    const settlementName = await api.settlement();          // "${settlement}"
    const shopName = await api.shop();                      // "${shop}"
    const bookTitle = await api.book();                     // "${book}"

    // Components
    const firstName = await api.firstName('elf', 'female'); // "${firstName}"
    const surname = await api.surname('dwarf');             // "${surname}"

    // Advanced
    const npc = await api.quickNPC('halfling', 'female');   // ${JSON.stringify(npc)}
    const party = await api.multipleNames(4, 'human', 'mixed');

    // ORIGINAL API - Still available for complex cases:
    const advancedName = await api.generateName({
      language: 'de',
      species: 'elf',
      gender: 'female',
      category: 'names',
      components: ['firstname', 'surname'],
      format: '{firstname} {surname}'
    });
    `);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();