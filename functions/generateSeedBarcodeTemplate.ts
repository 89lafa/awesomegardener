import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // SeedVendorBarcode template with all fields
    const headers = [
      'barcode',
      'barcode_format',
      'variety_id',
      'plant_type_id',
      'plant_type_name',
      'vendor_name',
      'vendor_code',
      'vendor_url',
      'vendor_product_url',
      'vendor_sku',
      'product_name',
      'packet_size',
      'retail_price',
      'year_released',
      'packet_image_url',
      'data_source',
      'verified',
      'status'
    ];

    const exampleRow = [
      '012345678901',
      'UPC_A',
      '6959abc123def456789',
      '6959def456abc123789',
      'Tomato',
      'Burpee',
      'BURPEE',
      'https://www.burpee.com',
      'https://www.burpee.com/product/cherokee-purple',
      'SKU12345',
      'Cherokee Purple Tomato Seeds',
      '50 seeds',
      '4.99',
      '2023',
      '',
      'admin_import',
      'true',
      'active'
    ];

    const csvContent = [
      headers.join(','),
      exampleRow.join(','),
      // Empty row for user to fill
      headers.map(() => '').join(',')
    ].join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="seed_barcode_template.csv"'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});