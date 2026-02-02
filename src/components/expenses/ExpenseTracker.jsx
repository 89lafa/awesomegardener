import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { format } from 'date-fns';

export function ExpenseTracker({ expenses, gardenSeasonId, onExpenseAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'seeds',
    description: '',
    amount_dollars: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    vendor: ''
  });

  const handleAddExpense = async () => {
    if (!formData.description || !formData.amount_dollars) return;

    await base44.entities.GardenExpense.create({
      garden_season_id: gardenSeasonId,
      ...formData,
      amount_dollars: parseFloat(formData.amount_dollars)
    });

    setFormData({
      category: 'seeds',
      description: '',
      amount_dollars: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      vendor: ''
    });
    setShowForm(false);
    onExpenseAdded?.();
  };

  const categories = [
    'seeds', 'soil', 'tools', 'water', 'fertilizer', 'pest_control', 'infrastructure', 'other'
  ];

  const getCategoryIcon = (category) => {
    const icons = {
      seeds: '🌱',
      soil: '🪴',
      tools: '🔧',
      water: '💧',
      fertilizer: '🧪',
      pest_control: '🐛',
      infrastructure: '🏗️',
      other: '📦'
    };
    return icons[category] || '📦';
  };

  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount_dollars || 0), 0);
  const byCategory = categories.map(cat => ({
    category: cat,
    total: expenses
      .filter(e => e.category === cat)
      .reduce((sum, e) => sum + (e.amount_dollars || 0), 0)
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900">${totalSpent.toFixed(2)}</p>
              </div>
              <DollarSign className="w-12 h-12 text-emerald-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expenses</p>
                <p className="text-3xl font-bold text-gray-900">{expenses.length}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Add Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {getCategoryIcon(cat)} {cat.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount_dollars}
                  onChange={(e) => setFormData({ ...formData, amount_dollars: e.target.value })}
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input
                placeholder="What was purchased?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Vendor (optional)</label>
                <Input
                  placeholder="Where purchased from"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddExpense}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Add Expense
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </Button>
      )}

      {/* Expenses by Category */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">By Category</h3>
        <div className="space-y-2">
          {byCategory.filter(b => b.total > 0).map(item => (
            <div key={item.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm">
                {getCategoryIcon(item.category)} {item.category.replace('_', ' ')}
              </span>
              <span className="font-semibold text-gray-900">${item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Expenses */}
      {expenses.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Recent Expenses</h3>
          <div className="space-y-2">
            {expenses.slice(0, 5).map(expense => (
              <div key={expense.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{expense.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(new Date(expense.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className="font-semibold text-gray-900">${expense.amount_dollars.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}