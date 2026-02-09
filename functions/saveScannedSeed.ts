import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      scannedBarcode, 
      extractedData, 
      matchResult, 
      packetImageUrl,
      addToStash = true
    } = await req.json();

    let varietyId;
    let plantTypeId;

    // Determine variety ID based on match result
    if (matchResult.action === 'link_barcode' && matchResult.match) {
      varietyId = matchResult.match.id;
      plantTypeId = matchResult.match.plant_type_id;
    } else if (matchResult.action === 'create_new') {
      // Create new variety with AI-enriched data
      const plantTypes = await base44.asServiceRole.entities.PlantType.filter({
        common_name: extractedData.plant_type_name
      });
      
      plantTypeId = plantTypes[0]?.id || matchResult.plant_type_id;

      if (!plantTypeId) {
        return Response.json({ 
          error: 'Plant type not found. Cannot create variety.' 
        }, { status: 400 });
      }

      const newVariety = await base44.asServiceRole.entities.Variety.create({
        plant_type_id: plantTypeId,
        plant_type_name: extractedData.plant_type_name,
        variety_name: extractedData.variety_name,
        description: extractedData.description,
        days_to_maturity: extractedData.days_to_maturity,
        days_to_maturity_min: extractedData.days_to_maturity_min,
        days_to_maturity_max: extractedData.days_to_maturity_max,
        spacing_recommended: extractedData.spacing_recommended,
        spacing_min: extractedData.spacing_min,
        spacing_max: extractedData.spacing_max,
        sun_requirement: extractedData.sun_requirement,
        water_requirement: extractedData.water_requirement,
        growth_habit: extractedData.growth_habit,
        plant_height_typical: extractedData.plant_height_typical,
        seed_line_type: extractedData.seed_line_type,
        is_organic: extractedData.is_organic,
        container_friendly: extractedData.container_friendly,
        trellis_required: extractedData.trellis_required,
        flavor_profile: extractedData.flavor_profile,
        uses: extractedData.uses,
        fruit_color: extractedData.fruit_color,
        fruit_shape: extractedData.fruit_shape,
        disease_resistance: extractedData.disease_resistance,
        scoville_min: extractedData.scoville_min,
        scoville_max: extractedData.scoville_max,
        source_attribution: 'AwesomeGardener community barcode scan',
        status: 'active'
      });

      varietyId = newVariety.id;
    } else {
      return Response.json({ error: 'Invalid match result' }, { status: 400 });
    }

    // Find or create vendor
    let vendorCode = null;
    const vendors = await base44.asServiceRole.entities.SeedVendor.filter({
      vendor_name: extractedData.vendor_name
    });
    
    if (vendors.length > 0) {
      vendorCode = vendors[0].vendor_code;
    }

    // Save barcode mapping (for all future users)
    const barcodeRecord = await base44.asServiceRole.entities.SeedVendorBarcode.create({
      barcode: scannedBarcode,
      barcode_format: 'UPC_A', // TODO: detect format
      variety_id: varietyId,
      plant_type_id: plantTypeId,
      plant_type_name: extractedData.plant_type_name,
      vendor_name: extractedData.vendor_name,
      vendor_code: vendorCode,
      product_name: extractedData.variety_name,
      packet_size: extractedData.packet_size,
      retail_price: extractedData.retail_price,
      packet_image_url: packetImageUrl,
      packet_image_raw_url: packetImageUrl,
      data_source: 'user_scan',
      verified: false,
      confidence_score: extractedData.confidence_score || 75,
      submitted_by_user_id: user.id,
      scan_count: 1,
      last_scanned_date: new Date().toISOString(),
      status: 'active'
    });

    // Add to user's seed stash if requested
    let seedLotId = null;
    if (addToStash) {
      // Find or create PlantProfile
      const existingProfiles = await base44.entities.PlantProfile.filter({
        variety_name: extractedData.variety_name,
        plant_type_id: plantTypeId
      });

      let profileId;
      if (existingProfiles.length > 0) {
        profileId = existingProfiles[0].id;
      } else {
        const newProfile = await base44.entities.PlantProfile.create({
          plant_type_id: plantTypeId,
          common_name: extractedData.plant_type_name,
          variety_name: extractedData.variety_name,
          days_to_maturity_seed: extractedData.days_to_maturity,
          spacing_in_min: extractedData.spacing_min || extractedData.spacing_recommended,
          spacing_in_max: extractedData.spacing_max || extractedData.spacing_recommended,
          source_type: 'user_private'
        });
        profileId = newProfile.id;
      }

      const seedLot = await base44.entities.SeedLot.create({
        plant_profile_id: profileId,
        custom_label: extractedData.variety_name,
        source_vendor_name: extractedData.vendor_name,
        barcode: scannedBarcode,
        packet_image_url: packetImageUrl,
        packet_size: extractedData.packet_size,
        price_paid: extractedData.retail_price,
        quantity: extractedData.packet_size ? parseInt(extractedData.packet_size) : null,
        year_acquired: new Date().getFullYear(),
        lot_notes: `Scanned via barcode ${scannedBarcode}`
      });

      seedLotId = seedLot.id;
    }

    // Update variety vendor count
    const barcodeCount = await base44.asServiceRole.entities.SeedVendorBarcode.filter({ 
      variety_id: varietyId 
    });
    
    await base44.asServiceRole.entities.Variety.update(varietyId, {
      vendor_barcodes_count: barcodeCount.length
    });

    return Response.json({
      success: true,
      variety_id: varietyId,
      barcode_record_id: barcodeRecord.id,
      seed_lot_id: seedLotId,
      was_new_variety: matchResult.action === 'create_new'
    });

  } catch (error) {
    console.error('[SaveScannedSeed] Error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});