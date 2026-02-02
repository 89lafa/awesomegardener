import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpenseTracker } from '@/components/expenses/ExpenseTracker';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GardenExpenses() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [selectedGarden, setSelectedGarden] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const gardenList = await base44.entities.Garden.filter({
        created_by: userData.email
      }, '-created_date');

      setGardens(gardenList);

      if (gardenList.length > 0) {
        const firstGarden = gardenList[0];
        setSelectedGarden(firstGarden);

        const seasons = await base44.entities.GardenSeason.filter({
          garden_id: firstGarden.id
        }, '-created_date');

        if (seasons.length > 0) {
          setSeason(seasons[0]);
          loadExpenses(seasons[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async (seasonId) => {
    try {
      const expenseList = await base44.entities.GardenExpense.filter({
        garden_season_id: seasonId
      }, '-created_date');
      setExpenses(expenseList);
    } catch (error) {
      console.error('Error loading expenses:', error);
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Garden Expenses</h1>
        <p className="text-gray-600">Track costs and ROI for your gardens</p>
      </div>

      {gardens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-500">Create a garden to start tracking expenses</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Garden Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">Garden</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {gardens.map(garden => (
                <button
                  key={garden.id}
                  onClick={async () => {
                    setSelectedGarden(garden);
                    const seasons = await base44.entities.GardenSeason.filter({
                      garden_id: garden.id
                    }, '-created_date');
                    if (seasons.length > 0) {
                      setSeason(seasons[0]);
                      await loadExpenses(seasons[0].id);
                    }
                  }}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    selectedGarden?.id === garden.id
                      ? 'bg-emerald-50 border-emerald-500'
                      : 'bg-white border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <p className="font-medium text-gray-900">{garden.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Expense Tracker */}
          {season && (
            <ExpenseTracker
              expenses={expenses}
              gardenSeasonId={season.id}
              onExpenseAdded={() => loadExpenses(season.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}