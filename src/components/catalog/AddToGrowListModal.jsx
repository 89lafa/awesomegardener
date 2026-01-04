import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

export default function AddToGrowListModal({ open, onOpenChange, variety, plantType, profile, onSuccess }) {
  // Support both Variety and PlantProfile
  const plantData = profile || variety;
  const [growLists, setGrowLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    if (open) {
      loadGrowLists();
    }
  }, [open]);

  const loadGrowLists = async () => {
    try {
      const lists = await base44.entities.GrowList.list('-created_date');
      setGrowLists(lists);
    } catch (error) {
      console.error('Error loading grow lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    try {
      const newList = await base44.entities.GrowList.create({
        name: newListName,
        status: 'active'
      });
      setGrowLists([newList, ...growLists]);
      setSelectedListId(newList.id);
      setShowNewList(false);
      setNewListName('');
      toast.success('Grow list created!');
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create list');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedListId) return;

    setSaving(true);
    try {
      // Create GrowListItem
      await base44.entities.GrowList.update(selectedListId, {
        items: [
          ...(growLists.find(l => l.id === selectedListId)?.items || []),
          {
            variety_id: plantData.id,
            variety_name: plantData.variety_name,
            plant_type_id: plantType?.id || plantData.plant_type_id,
            plant_type_name: plantType?.common_name || plantData.common_name,
            quantity: parseInt(quantity) || 1,
            added_date: new Date().toISOString()
          }
        ]
      });

      toast.success('Added to grow list!');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error adding to grow list:', error);
      toast.error('Failed to add to grow list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Grow List</DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            {plantData?.variety_name} • {plantType?.common_name || plantData?.common_name}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : showNewList ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="newListName">New List Name</Label>
              <Input
                id="newListName"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., 2026 Garden Plan"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewList(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateList} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Create List
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="growlist">Select Grow List</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a list..." />
                </SelectTrigger>
                <SelectContent>
                  {growLists.map(list => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.items?.length || 0} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="link"
                onClick={() => setShowNewList(true)}
                className="mt-2 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create new list
              </Button>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity to Grow</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!selectedListId || saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  'Add to List'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}