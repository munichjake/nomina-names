/**
 * Test script for Species Configuration Feature
 * Copy this into the Foundry console to test the new species management
 */

(async function testSpeciesConfig() {
  console.log('🧪 Testing Species Configuration Feature...');

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

  console.log('✅ API found, running species tests...');

  try {
    // Test 1: Get all species codes (including disabled)
    console.log('\n📝 Test 1: All Species Codes');
    const allSpecies = api.getAllSpeciesCodes();
    console.log('All available species:', allSpecies);

    // Test 2: Get available species (respecting settings)
    console.log('\n📝 Test 2: Available Species (Filtered)');
    const availableSpecies = api.getAvailableSpecies();
    console.log('Available species (filtered by settings):', availableSpecies);

    // Test 3: Check current settings
    console.log('\n📝 Test 3: Current Species Settings');
    const currentSettings = game.settings.get('nomina-names', 'availableSpecies');
    console.log('Current species settings:', currentSettings);

    // Test 4: Generate name with available species
    console.log('\n📝 Test 4: Name Generation with Available Species');
    if (availableSpecies.length > 0) {
      const firstSpecies = availableSpecies[0].code;
      const name = await api.randomName(firstSpecies);
      console.log(`Generated name for ${firstSpecies}:`, name);
    } else {
      console.warn('No species available for name generation');
    }

    // Test 5: Test species configuration app
    console.log('\n📝 Test 5: Species Configuration App');
    console.log('To test the configuration UI:');
    console.log('1. Go to Foundry Settings');
    console.log('2. Find "Module Settings" > "Nomina Names"');
    console.log('3. Look for "Spezies konfigurieren" button');
    console.log('4. Click it to open the species management popup');

    console.log('\n✅ All species configuration tests completed!');

    // Usage examples
    console.log('\n🎯 Species Configuration Usage Examples:');
    console.log(`
    // GET ALL SPECIES CODES (including disabled):
    const allSpecies = api.getAllSpeciesCodes();  // ["human", "elf", "dwarf", ...]

    // GET AVAILABLE SPECIES (respecting user settings):
    const available = api.getAvailableSpecies();  // [{code: "human", name: "Menschen"}, ...]

    // PROGRAMMATICALLY UPDATE SPECIES SETTINGS:
    await game.settings.set('nomina-names', 'availableSpecies', {
      'human': true,    // enabled
      'elf': true,      // enabled
      'dwarf': false,   // disabled
      'orc': false      // disabled
    });

    // CHECK IF SPECIFIC SPECIES IS ENABLED:
    const settings = game.settings.get('nomina-names', 'availableSpecies');
    const isHumanEnabled = settings['human'] !== false; // default true if not set

    // GENERATE NAMES ONLY FROM ENABLED SPECIES:
    const enabledSpecies = api.getAvailableSpecies();
    if (enabledSpecies.length > 0) {
      const randomSpecies = enabledSpecies[Math.floor(Math.random() * enabledSpecies.length)];
      const name = await api.randomName(randomSpecies.code);
      console.log('Generated name:', name);
    }
    `);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();