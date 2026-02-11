import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const results = { families: [], plantTypes: [], browseCategory: null };

    // Step 1: Get Indoor Plants group
    const groups = await base44.asServiceRole.entities.PlantGroup.filter({ name: 'Indoor & Houseplants' });
    if (!groups || groups.length === 0) {
      return Response.json({ error: 'Indoor & Houseplants group not found' }, { status: 404 });
    }
    const indoorGroupId = groups[0].id;

    // Step 2: Create missing PlantFamilies
    const familyData = [
      { scientific_name: "Droseraceae", common_name: "Sundew family", notes: "Carnivorous plants. Includes Venus Flytrap (Dionaea), Sundews (Drosera), Waterwheel Plant (Aldrovanda)." },
      { scientific_name: "Sarraceniaceae", common_name: "Pitcher plant family", notes: "Carnivorous plants. Includes American Pitcher Plants (Sarracenia), Cobra Lily (Darlingtonia), Sun Pitchers (Heliamphora)." },
      { scientific_name: "Nepenthaceae", common_name: "Tropical pitcher family", notes: "Carnivorous plants. Includes tropical pitcher plants (Nepenthes)." },
      { scientific_name: "Lentibulariaceae", common_name: "Bladderwort family", notes: "Carnivorous plants. Includes Butterworts (Pinguicula) and Bladderworts (Utricularia)." }
    ];

    const familyMap = {};
    
    for (const fam of familyData) {
      const existing = await base44.asServiceRole.entities.PlantFamily.filter({ scientific_name: fam.scientific_name });
      if (existing && existing.length > 0) {
        familyMap[fam.scientific_name] = existing[0].id;
        results.families.push({ action: 'exists', ...fam, id: existing[0].id });
      } else {
        const created = await base44.asServiceRole.entities.PlantFamily.create(fam);
        familyMap[fam.scientific_name] = created.id;
        results.families.push({ action: 'created', ...fam, id: created.id });
      }
    }

    // Step 3: Create 3 new PlantTypes
    const newPlantTypes = [
      {
        plant_type_code: "PT_BLADDERWORT",
        common_name: "Bladderwort",
        scientific_name: "Utricularia spp.",
        plant_family_id: familyMap["Lentibulariaceae"],
        plant_group_id: indoorGroupId,
        category: "carnivorous",
        typical_sun: "partial_sun",
        typical_water: "high",
        is_perennial: true,
        icon: "🪴",
        description: "The largest genus of carnivorous plants with 230+ species. Tiny bladder traps capture prey underground (terrestrial) or underwater (aquatic). Beautiful flowers belie their hidden carnivorous nature. Terrestrial species are easy beginner plants."
      },
      {
        plant_type_code: "PT_COBRA_LILY",
        common_name: "Cobra Lily",
        scientific_name: "Darlingtonia californica",
        plant_family_id: familyMap["Sarraceniaceae"],
        plant_group_id: indoorGroupId,
        category: "carnivorous",
        typical_sun: "full_sun",
        typical_water: "high",
        is_perennial: true,
        icon: "🪴",
        description: "The only species in its genus — a one-of-a-kind pitcher plant shaped like a rearing cobra. Native to cold mountain streams of Oregon and Northern California. EXPERT ONLY: requires constantly cool roots, which is the #1 challenge in cultivation."
      },
      {
        plant_type_code: "PT_WATERWHEEL",
        common_name: "Waterwheel Plant",
        scientific_name: "Aldrovanda vesiculosa",
        plant_family_id: familyMap["Droseraceae"],
        plant_group_id: indoorGroupId,
        category: "carnivorous",
        typical_sun: "partial_sun",
        typical_water: "high",
        is_perennial: true,
        icon: "🪴",
        description: "An aquatic Venus Flytrap — free-floating, rootless, and fully submerged. Snap-traps in miniature whorls catch daphnia and mosquito larvae. A living fossil dating back tens of millions of years. Endangered in the wild. Moderate to challenging to grow."
      }
    ];

    const createdPlantTypeIds = [];
    
    for (const pt of newPlantTypes) {
      const existing = await base44.asServiceRole.entities.PlantType.filter({ plant_type_code: pt.plant_type_code });
      if (existing && existing.length > 0) {
        createdPlantTypeIds.push(existing[0].id);
        results.plantTypes.push({ action: 'exists', ...pt, id: existing[0].id });
      } else {
        const created = await base44.asServiceRole.entities.PlantType.create(pt);
        createdPlantTypeIds.push(created.id);
        results.plantTypes.push({ action: 'created', ...pt, id: created.id });
      }
    }

    // Step 4: Update BrowseCategory BC_CARNIVOROUS
    const browseCategories = await base44.asServiceRole.entities.BrowseCategory.filter({ category_code: 'BC_CARNIVOROUS' });
    if (browseCategories && browseCategories.length > 0) {
      const bc = browseCategories[0];
      const currentIds = bc.plant_type_ids || [];
      const updatedIds = [...new Set([...currentIds, ...createdPlantTypeIds])];
      
      await base44.asServiceRole.entities.BrowseCategory.update(bc.id, {
        plant_type_ids: updatedIds
      });
      results.browseCategory = { action: 'updated', id: bc.id, plant_type_ids: updatedIds };
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('Error initializing carnivorous plants:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});