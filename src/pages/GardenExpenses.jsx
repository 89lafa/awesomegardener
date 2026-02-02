import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpenseTracker } from '@/components/expenses/ExpenseTracker';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GardenExpenses() {
  const [user, setUser] = useState(null);
  const [season, setSeason] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Get current season
      const seasons = await base44.entities.GardenSeason.filter({
        created_by: userData.email,
        status: 'active'
      });

      if (seasons.length > 0) {
        setSeason(seasons[0]);
        const expensesData = await base44.entities.GardenExpense.filter({
          garden_season_id: seasons[0].id
        }, '-date');
        setExpenses(expensesData);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!season) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-gray-500">No active garden season</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Garden Expenses</h1>
        <p className="text-gray-600">Track costs for {season.name}</p>
      </div>

      <ExpenseTracker
        expenses={expenses}
        gardenSeasonId={season.id}
        onExpenseAdded={loadData}
      />
    </div>
  );
}