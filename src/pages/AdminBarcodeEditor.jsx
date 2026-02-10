import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Plus, Trash2, Loader2, Save, Search, Barcode as BarcodeIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Combobox } from '@/components/ui/combobox';

export default function AdminBarcodeEditor() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedPlantType, setSelectedPlantType] = useState('');
  const [selectedVariety, setSelectedVariety] = useState('');
  const [barcodes, setBarcodes] = useState([]);
  const [loadingBarcodes, setLoadingBarcodes] = useState(false);
  const [newBarcode, setNewBarcode] = useState({
    barcode: '',
    barcode_format: 'UPC_A',
    vendor_code: '',
    vendor_product_url: '',
    product_name: '',
    packet_size: '',
    retail_price: ''
  });

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (selectedPlantType) {
      loadVarieties();
    }
  }, [selectedPlantType]);

  useEffect(() => {
    if (selectedVariety) {
      loadBarcodes();
    }
  }, [selectedVariety]);

  const checkAccess = async () => {
    try {
      const userData = await base44.auth.me();
      if (!userData || userData.role !== 'admin') {
        navigate(createPageUrl('AdminHub'));
        return;
      }
      setUser(userData);
      await loadInitialData();
    } catch (error) {
      console.error('Access check failed:', error);
      navigate(createPageUrl('Dashboard'));
    }
  };

  const loadInitialData = async () => {
    try {
      const [typesData, vendorsData] = await Promise.all([
        base44.entities.PlantType.list('common_name', 500),
        base44.entities.SeedVendor.filter({ is_active: true }, 'vendor_name')
      ]);
      setPlantTypes(typesData);
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadVarieties = async () => {
    try {
      const varietiesData = await base44.entities.Variety.filter(
        { plant_type_id: selectedPlantType, status: 'active' },
        'variety_name'
      );
      setVarieties(varietiesData);
      setSelectedVariety('');
      setBarcodes([]);
    } catch (error) {
      console.error('Error loading varieties:', error);
      toast.error('Failed to load varieties');
    }
  };

  const loadBarcodes = async () => {
    setLoadingBarcodes(true);
    try {
      const barcodesData = await base44.entities.SeedVendorBarcode.filter({
        variety_id: selectedVariety
      });
      setBarcodes(barcodesData);
    } catch (error) {
      console.error('Error loading barcodes:', error);
      toast.error('Failed to load barcodes');
    } finally {
      setLoadingBarcodes(false);
    }
  };

  const handleAddBarcode = async () => {
    if (!selectedVariety || !newBarcode.barcode || !newBarcode.vendor_code) {
      toast.error('Barcode, variety, and vendor are required');
      return;
    }

    try {
      const variety = varieties.find(v => v.id === selectedVariety);
      const vendor = vendors.find(v => v.vendor_code === newBarcode.vendor_code);
      
      const barcodeData = {
        barcode: newBarcode.barcode.trim(),
        barcode_format: newBarcode.barcode_format,
        variety_id: selectedVariety,
        plant_type_id: selectedPlantType,
        plant_type_name: plantTypes.find(pt => pt.id === selectedPlantType)?.common_name,
        vendor_code: newBarcode.vendor_code,
        vendor_name: vendor?.vendor_name || newBarcode.vendor_code,
        vendor_url: vendor?.vendor_url || '',
        vendor_product_url: newBarcode.vendor_product_url,
        product_name: newBarcode.product_name || variety?.variety_name,
        packet_size: newBarcode.packet_size,
        retail_price: newBarcode.retail_price ? parseFloat(newBarcode.retail_price) : null,
        data_source: 'admin_import',
        verified: true,
        status: 'active'
      };

      const created = await base44.entities.SeedVendorBarcode.create(barcodeData);
      setBarcodes([...barcodes, created]);
      setNewBarcode({
        barcode: '',
        barcode_format: 'UPC_A',
        vendor_code: '',
        vendor_product_url: '',
        product_name: '',
        packet_size: '',
        retail_price: ''
      });
      toast.success('Barcode added!');
    } catch (error) {
      console.error('Error adding barcode:', error);
      toast.error('Failed to add barcode');
    }
  };

  const handleDeleteBarcode = async (barcodeId) => {
    if (!confirm('Delete this barcode?')) return;
    
    try {
      await base44.entities.SeedVendorBarcode.delete(barcodeId);
      setBarcodes(barcodes.filter(b => b.id !== barcodeId));
      toast.success('Barcode deleted');
    } catch (error) {
      console.error('Error deleting barcode:', error);
      toast.error('Failed to delete barcode');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('AdminHub'))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Barcode Editor</h1>
          <p className="text-gray-600">Manually add and manage seed packet barcodes</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Plant Type & Variety</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Plant Type</Label>
            <Combobox
              placeholder="Search plant types..."
              items={plantTypes.map(pt => ({
                value: pt.id,
                label: `${pt.icon || ''} ${pt.common_name}`
              }))}
              value={selectedPlantType}
              onValueChange={setSelectedPlantType}
              className="mt-2"
            />
          </div>

          {selectedPlantType && (
            <div>
              <Label>Variety</Label>
              <Select value={selectedVariety} onValueChange={setSelectedVariety}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select variety..." />
                </SelectTrigger>
                <SelectContent>
                  {varieties.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.variety_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVariety && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add New Barcode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Barcode Number *</Label>
                  <Input
                    value={newBarcode.barcode}
                    onChange={(e) => setNewBarcode({ ...newBarcode, barcode: e.target.value })}
                    placeholder="Enter UPC/EAN/barcode..."
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Barcode Format</Label>
                  <Select 
                    value={newBarcode.barcode_format} 
                    onValueChange={(v) => setNewBarcode({ ...newBarcode, barcode_format: v })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPC_A">UPC-A</SelectItem>
                      <SelectItem value="UPC_E">UPC-E</SelectItem>
                      <SelectItem value="EAN_13">EAN-13</SelectItem>
                      <SelectItem value="EAN_8">EAN-8</SelectItem>
                      <SelectItem value="CODE_128">CODE-128</SelectItem>
                      <SelectItem value="QR_CODE">QR Code</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Seed Vendor *</Label>
                <Select 
                  value={newBarcode.vendor_code} 
                  onValueChange={(v) => setNewBarcode({ ...newBarcode, vendor_code: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.vendor_code} value={vendor.vendor_code}>
                        {vendor.vendor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Product Name</Label>
                  <Input
                    value={newBarcode.product_name}
                    onChange={(e) => setNewBarcode({ ...newBarcode, product_name: e.target.value })}
                    placeholder="Product name on packet"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Packet Size</Label>
                  <Input
                    value={newBarcode.packet_size}
                    onChange={(e) => setNewBarcode({ ...newBarcode, packet_size: e.target.value })}
                    placeholder="e.g., 50 seeds, 1g"
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Retail Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newBarcode.retail_price}
                    onChange={(e) => setNewBarcode({ ...newBarcode, retail_price: e.target.value })}
                    placeholder="e.g., 3.99"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Product URL</Label>
                  <Input
                    type="url"
                    value={newBarcode.vendor_product_url}
                    onChange={(e) => setNewBarcode({ ...newBarcode, vendor_product_url: e.target.value })}
                    placeholder="https://..."
                    className="mt-2"
                  />
                </div>
              </div>

              <Button 
                onClick={handleAddBarcode}
                disabled={!newBarcode.barcode || !newBarcode.vendor_code}
                className="bg-emerald-600 hover:bg-emerald-700 w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Barcode
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Barcodes ({barcodes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBarcodes ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                </div>
              ) : barcodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BarcodeIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No barcodes for this variety yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {barcodes.map(barcode => (
                    <div key={barcode.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <BarcodeIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-mono font-bold">{barcode.barcode}</span>
                          <Badge variant="outline" className="text-xs">{barcode.barcode_format}</Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Vendor:</span> <span className="font-medium">{barcode.vendor_name}</span>
                          </div>
                          {barcode.product_name && (
                            <div>
                              <span className="text-gray-600">Product:</span> <span className="font-medium">{barcode.product_name}</span>
                            </div>
                          )}
                          {barcode.packet_size && (
                            <div>
                              <span className="text-gray-600">Size:</span> <span className="font-medium">{barcode.packet_size}</span>
                            </div>
                          )}
                          {barcode.retail_price && (
                            <div>
                              <span className="text-gray-600">Price:</span> <span className="font-medium">${barcode.retail_price}</span>
                            </div>
                          )}
                        </div>
                        {barcode.vendor_product_url && (
                          <a 
                            href={barcode.vendor_product_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 hover:underline mt-2 inline-block"
                          >
                            View Product →
                          </a>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBarcode(barcode.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}