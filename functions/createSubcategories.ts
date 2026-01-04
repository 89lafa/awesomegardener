import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SUBCATEGORIES = [
  // Tomatoes
  { plantTypeName: 'Tomato', name: 'Beefsteak Tomato', icon: '🍅', sortOrder: 1 },
  { plantTypeName: 'Tomato', name: 'Cherry Tomato', icon: '🍒', sortOrder: 2 },
  { plantTypeName: 'Tomato', name: 'Grape Tomato', icon: '🍇', sortOrder: 3 },
  { plantTypeName: 'Tomato', name: 'Plum Tomato', icon: '🥫', sortOrder: 4 },
  { plantTypeName: 'Tomato', name: 'Paste Tomato', icon: '📦', sortOrder: 5 },
  { plantTypeName: 'Tomato', name: 'Oxheart Tomato', icon: '❤️', sortOrder: 6 },
  { plantTypeName: 'Tomato', name: 'Saladette Tomato', icon: '🥗', sortOrder: 7 },
  { plantTypeName: 'Tomato', name: 'Dwarf Tomato', icon: '🌱', sortOrder: 8 },
  { plantTypeName: 'Tomato', name: 'Micro-Dwarf Tomato', icon: '🪴', sortOrder: 9 },
  
  // Beans
  { plantTypeName: 'Bean', name: 'Bush Bean', icon: '🌿', sortOrder: 1 },
  { plantTypeName: 'Bean', name: 'Pole Bean', icon: '🎋', sortOrder: 2 },
  { plantTypeName: 'Bean', name: 'Lima Bean', icon: '🫘', sortOrder: 3 },
  { plantTypeName: 'Bean', name: 'Runner Bean', icon: '🏃', sortOrder: 4 },
  { plantTypeName: 'Bean', name: 'Dried Bean', icon: '🥜', sortOrder: 5 },
  
  // Peppers
  { plantTypeName: 'Pepper', name: 'Bell Pepper', icon: '🫑', sortOrder: 1 },
  { plantTypeName: 'Pepper', name: 'Sweet Pepper', icon: '🌶️', sortOrder: 2 },
  { plantTypeName: 'Pepper', name: 'Hot Pepper', icon: '🔥', sortOrder: 3 },
  { plantTypeName: 'Pepper', name: 'Jalapeño', icon: '🌶️', sortOrder: 4 },
  { plantTypeName: 'Pepper', name: 'Habanero', icon: '💥', sortOrder: 5 },
  { plantTypeName: 'Pepper', name: 'Cayenne', icon: '🔴', sortOrder: 6 },
  
  // Lettuce
  { plantTypeName: 'Lettuce', name: 'Leaf Lettuce', icon: '🥬', sortOrder: 1 },
  { plantTypeName: 'Lettuce', name: 'Head Lettuce', icon: '🥗', sortOrder: 2 },
  { plantTypeName: 'Lettuce', name: 'Romaine', icon: '🥒', sortOrder: 3 },
  { plantTypeName: 'Lettuce', name: 'Butterhead', icon: '💚', sortOrder: 4 },
  
  // Squash
  { plantTypeName: 'Squash', name: 'Summer Squash', icon: '☀️', sortOrder: 1 },
  { plantTypeName: 'Squash', name: 'Winter Squash', icon: '❄️', sortOrder: 2 },
  { plantTypeName: 'Squash', name: 'Zucchini', icon: '🥒', sortOrder: 3 },
  
  // Cucumber
  { plantTypeName: 'Cucumber', name: 'Slicing Cucumber', icon: '🥒', sortOrder: 1 },
  { plantTypeName: 'Cucumber', name: 'Pickling Cucumber', icon: '🥫', sortOrder: 2 },
  { plantTypeName: 'Cucumber', name: 'Specialty Cucumber', icon: '🌟', sortOrder: 3 },
  
  // Pea
  { plantTypeName: 'Pea', name: 'Snap Pea', icon: '🫛', sortOrder: 1 },
  { plantTypeName: 'Pea', name: 'Snow Pea', icon: '❄️', sortOrder: 2 },
  { plantTypeName: 'Pea', name: 'Shelling Pea', icon: '🥜', sortOrder: 3 },
  
  // Onion
  { plantTypeName: 'Onion', name: 'Long-Day Onion', icon: '☀️', sortOrder: 1 },
  { plantTypeName: 'Onion', name: 'Short-Day Onion', icon: '🌙', sortOrder: 2 },
  { plantTypeName: 'Onion', name: 'Intermediate Onion', icon: '⏱️', sortOrder: 3 },
  { plantTypeName: 'Onion', name: 'Bunching Onion', icon: '🌱', sortOrder: 4 },
  
  // Carrot
  { plantTypeName: 'Carrot', name: 'Nantes Carrot', icon: '🥕', sortOrder: 1 },
  { plantTypeName: 'Carrot', name: 'Imperator Carrot', icon: '📏', sortOrder: 2 },
  { plantTypeName: 'Carrot', name: 'Chantenay Carrot', icon: '🔶', sortOrder: 3 },
  { plantTypeName: 'Carrot', name: 'Danvers Carrot', icon: '🟠', sortOrder: 4 },
  
  // Brassicas
  { plantTypeName: 'Cabbage', name: 'Green Cabbage', icon: '🥬', sortOrder: 1 },
  { plantTypeName: 'Cabbage', name: 'Red Cabbage', icon: '🟣', sortOrder: 2 },
  { plantTypeName: 'Cabbage', name: 'Savoy Cabbage', icon: '💚', sortOrder: 3 },
  
  { plantTypeName: 'Broccoli', name: 'Heading Broccoli', icon: '🥦', sortOrder: 1 },
  { plantTypeName: 'Broccoli', name: 'Sprouting Broccoli', icon: '🌿', sortOrder: 2 },
  
  { plantTypeName: 'Cauliflower', name: 'White Cauliflower', icon: '⚪', sortOrder: 1 },
  { plantTypeName: 'Cauliflower', name: 'Colored Cauliflower', icon: '🌈', sortOrder: 2 },
  
  // Herbs
  { plantTypeName: 'Basil', name: 'Sweet Basil', icon: '🌿', sortOrder: 1 },
  { plantTypeName: 'Basil', name: 'Thai Basil', icon: '🇹🇭', sortOrder: 2 },
  { plantTypeName: 'Basil', name: 'Lemon Basil', icon: '🍋', sortOrder: 3 },
  
  // Melons
  { plantTypeName: 'Melon', name: 'Cantaloupe', icon: '🍈', sortOrder: 1 },
  { plantTypeName: 'Melon', name: 'Honeydew', icon: '🍈', sortOrder: 2 },
  { plantTypeName: 'Melon', name: 'Watermelon', icon: '🍉', sortOrder: 3 },
  
  // Radish
  { plantTypeName: 'Radish', name: 'Spring Radish', icon: '🔴', sortOrder: 1 },
  { plantTypeName: 'Radish', name: 'Daikon Radish', icon: '⚪', sortOrder: 2 },
  { plantTypeName: 'Radish', name: 'Winter Radish', icon: '❄️', sortOrder: 3 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Load all plant types
    const plantTypes = await base44.asServiceRole.entities.PlantType.list('common_name', 500);
    const plantTypeMap = {};
    plantTypes.forEach(pt => {
      plantTypeMap[pt.common_name] = pt.id;
    });

    // Load existing subcategories
    const existing = await base44.asServiceRole.entities.PlantSubCategory.list('subcat_code', 500);
    const existingCodes = new Set(existing.map(s => s.subcat_code));

    let created = 0;
    let skipped = 0;
    const results = [];

    for (const subcat of SUBCATEGORIES) {
      const plantTypeId = plantTypeMap[subcat.plantTypeName];
      if (!plantTypeId) {
        console.log(`[SUBCAT] PlantType not found: ${subcat.plantTypeName}, skipping ${subcat.name}`);
        skipped++;
        continue;
      }

      const code = `PSC_${subcat.plantTypeName.toUpperCase()}_${subcat.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

      if (existingCodes.has(code)) {
        console.log(`[SUBCAT] Already exists: ${code}`);
        skipped++;
        continue;
      }

      const newSubcat = await base44.asServiceRole.entities.PlantSubCategory.create({
        subcat_code: code,
        plant_type_id: plantTypeId,
        name: subcat.name,
        icon: subcat.icon,
        sort_order: subcat.sortOrder,
        is_active: true
      });

      results.push(newSubcat);
      created++;
      console.log(`[SUBCAT] Created: ${subcat.name}`);
    }

    return Response.json({
      success: true,
      created,
      skipped,
      total: SUBCATEGORIES.length,
      results
    });
  } catch (error) {
    console.error('[SUBCAT ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});