import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Package, ListChecks, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AddToStashButton({ variety, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    quantity: 1,
    unit: 'seeds',
    year_acquired: new Date().getFullYear()
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await base44.auth.me();
      
      // Create or find plant profile
      const profiles = await base44.entities.PlantProfile.filter({
        variety_name: variety.variety_name,
        created_by: user.email
      });
      
      let profileId;
      if (profiles.length > 0) {
        profileId = profiles[0].id;
      } else {
        const newProfile = await base44.entities.PlantProfile.create({
          variety_name: variety.variety_name,
          common_name: variety.plant_type_name,
          variety_id: variety.id
        });
        profileId = newProfile.id;
      }
      
      // Create seed lot
      await base44.entities.SeedLot.create({
        plant_profile_id: profileId,
        ...formData,
        from_catalog: true
      });
      
      toast.success('Added to Seed Stash');
      setOpen(false);
    } catch (error) {
      console.error('Error adding to stash:', error);
      toast.error('Failed to add to stash');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Package className="w-3 h-3" />
        Add to Stash
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Seed Stash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seeds">Seeds</SelectItem>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Year Acquired</Label>
              <Input
                type="number"
                value={formData.year_acquired}
                onChange={(e) => setFormData({ ...formData, year_acquired: parseInt(e.target.value) })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddToGrowListButton({ variety, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [growLists, setGrowLists] = useState([]);
  const [selectedList, setSelectedList] = useState('');

  React.useEffect(() => {
    if (open) {
      loadGrowLists();
    }
  }, [open]);

  const loadGrowLists = async () => {
    try {
      const user = await base44.auth.me();
      const lists = await base44.entities.GrowList.filter({ created_by: user.email });
      setGrowLists(lists);
      if (lists.length > 0) setSelectedList(lists[0].id);
    } catch (error) {
      console.error('Error loading grow lists:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedList) return;
    setSaving(true);
    try {
      const list = growLists.find(l => l.id === selectedList);
      const items = list.items || [];
      
      // Check if already in list
      if (items.some(i => i.variety_name === variety.variety_name)) {
        toast.error('Already in grow list');
        setOpen(false);
        return;
      }
      
      items.push({
        variety_name: variety.variety_name,
        plant_type_name: variety.plant_type_name,
        variety_id: variety.id,
        quantity: 1,
        added_date: new Date().toISOString()
      });
      
      await base44.entities.GrowList.update(selectedList, { items });
      toast.success('Added to Grow List');
      setOpen(false);
    } catch (error) {
      console.error('Error adding to grow list:', error);
      toast.error('Failed to add to grow list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <ListChecks className="w-3 h-3" />
        Add to Grow List
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Grow List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {growLists.length === 0 ? (
              <p className="text-sm text-gray-600">No grow lists found. Create one first.</p>
            ) : (
              <div>
                <Label>Select Grow List</Label>
                <Select value={selectedList} onValueChange={setSelectedList}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {growLists.map(list => (
                      <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || growLists.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}