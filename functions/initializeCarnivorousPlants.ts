import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const log = [];
    log.push('Starting carnivorous plant initialization...');

    // STEP 1: Create PlantFamilies (if missing)
    const families = [
      { scientific_name: "Droseraceae", common_name: "Sundew family", notes: "Carnivorous plants. Includes Venus Flytrap (Dionaea), Sundews (Drosera), Waterwheel Plant (Aldrovanda)." },
      { scientific_name: "Sarraceniaceae", common_name: "Pitcher plant family", notes: "Carnivorous plants. Includes American Pitcher Plants (Sarracenia), Cobra Lily (Darlingtonia), Sun Pitchers (Heliamphora)." },
      { scientific_name: "Nepenthaceae", common_name: "Tropical pitcher family", notes: "Carnivorous plants. Includes tropical pitcher plants (Nepenthes)." },
      { scientific_name: "Lentibulariaceae", common_name: "Bladderwort family", notes: "Carnivorous plants. Includes Butterworts (Pinguicula) and Bladderworts (Utricularia)." }
    ];

    const familyIds = {};
    for (const family of families) {
      const existing = await base44.asServiceRole.entities.PlantFamily.filter({ scientific_name: family.scientific_name });
      if (existing.length > 0) {
        familyIds[family.scientific_name] = existing[0].id;
        log.push(`✓ Family ${family.scientific_name} already exists`);
      } else {
        const created = await base44.asServiceRole.entities.PlantFamily.create(family);
        familyIds[family.scientific_name] = created.id;
        log.push(`✓ Created family ${family.scientific_name}`);
      }
    }

    // STEP 2: Get Indoor Plants group
    const indoorGroups = await base44.asServiceRole.entities.PlantGroup.filter({ name: "Indoor & Houseplants" });
    if (indoorGroups.length === 0) {
      return Response.json({ error: 'Indoor Plants group not found', log }, { status: 400 });
    }
    const indoorGroupId = indoorGroups[0].id;
    log.push(`✓ Found Indoor Plants group: ${indoorGroupId}`);

    // STEP 3: Create or update PlantTypes
    const plantTypes = [
      {
        plant_type_code: "PT_BLADDERWORT",
        common_name: "Bladderwort",
        scientific_name: "Utricularia spp.",
        plant_family_id: familyIds["Lentibulariaceae"],
        plant_group_id: indoorGroupId,
        category: "carnivorous",
        typical_sun: "bright_indirect",
        typical_water: "high",
        is_perennial: true,
        icon: "🪴",
        description: "The largest genus of carnivorous plants with 230+ species. Tiny bladder traps capture prey underground (terrestrial) or underwater (aquatic). Beautiful flowers belie their hidden carnivorous nature. Terrestrial species are easy beginner plants."
      },
      {
        plant_type_code: "PT_COBRA_LILY",
        common_name: "Cobra Lily",
        scientific_name: "Darlingtonia californica",
        plant_family_id: familyIds["Sarraceniaceae"],
        plant_group_id: indoorGroupId,
        category: "carnivorous",
        typical_sun: "bright_direct",
        typical_water: "high",
        is_perennial: true,
        icon: "🪴",
        description: "The only species in its genus — a one-of-a-kind pitcher plant shaped like a rearing cobra. Native to cold mountain streams of Oregon and Northern California. EXPERT ONLY: requires constantly cool roots, which is the #1 challenge in cultivation."
      },
      {
        plant_type_code: "PT_WATERWHEEL",
        common_name: "Waterwheel Plant",
        scientific_name: "Aldrovanda vesiculosa",
        plant_family_id: familyIds["Droseraceae"],
        plant_group_id: indoorGroupId,
        category: "carnivorous",
        typical_sun: "bright_indirect",
        typical_water: "high",
        is_perennial: true,
        icon: "🪴",
        description: "An aquatic Venus Flytrap — free-floating, rootless, and fully submerged. Snap-traps in miniature whorls catch daphnia and mosquito larvae. A living fossil dating back tens of millions of years. Endangered in the wild. Moderate to challenging to grow."
      }
    ];

    const typeIds = {};
    for (const type of plantTypes) {
      const existing = await base44.asServiceRole.entities.PlantType.filter({ plant_type_code: type.plant_type_code });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.PlantType.update(existing[0].id, type);
        typeIds[type.plant_type_code] = existing[0].id;
        log.push(`✓ Updated PlantType ${type.common_name}`);
      } else {
        const created = await base44.asServiceRole.entities.PlantType.create(type);
        typeIds[type.plant_type_code] = created.id;
        log.push(`✓ Created PlantType ${type.common_name}`);
      }
    }

    // STEP 4: Update BrowseCategory for carnivorous plants
    const carnivCat = await base44.asServiceRole.entities.BrowseCategory.filter({ category_code: "BC_CARNIVOROUS" });
    if (carnivCat.length > 0) {
      const allCarnivorousTypes = await base44.asServiceRole.entities.PlantType.filter({ category: "carnivorous" });
      const allIds = allCarnivorousTypes.map(t => t.id);
      await base44.asServiceRole.entities.BrowseCategory.update(carnivCat[0].id, {
        plant_type_ids: allIds
      });
      log.push(`✓ Updated BrowseCategory with ${allIds.length} carnivorous types`);
    }

    return Response.json({ success: true, log });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});