import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CalendarGuide({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendar Planner User Guide</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card className="p-6 bg-emerald-50 border-emerald-200">
            <h2 className="font-bold text-lg mb-3">📍 How to Find Calendar Planner</h2>
            <ol className="space-y-2 text-sm">
              <li><strong>1. Open the sidebar</strong> (left side of screen)</li>
              <li><strong>2. Look for "Calendar Planner"</strong> (📅 icon)</li>
              <li><strong>3. Click it</strong> to open your crop planning calendar</li>
            </ol>
          </Card>

          <div>
            <h2 className="font-bold text-lg mb-3">✨ Key Features</h2>
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-2">🌱 My Crops Sidebar (Left)</h3>
                <p className="text-sm text-gray-700">
                  View all your scheduled crops grouped by plant type. Click any crop to highlight its tasks on the timeline.
                  Use the menu (⋮) to Edit, Duplicate, or Delete crops.
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">📊 Timeline View (Center)</h3>
                <p className="text-sm text-gray-700 mb-2">
                  See all your planting tasks displayed as colored bars across months:
                </p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4">
                  <li>• <Badge className="bg-purple-500">Purple</Badge> = Bed Preparation</li>
                  <li>• <Badge className="bg-blue-500">Blue</Badge> = Seeding (Indoors)</li>
                  <li>• <Badge className="bg-emerald-500">Green</Badge> = Direct Seeding</li>
                  <li>• <Badge className="bg-amber-500">Orange</Badge> = Transplanting</li>
                  <li>• <Badge className="bg-red-500">Red</Badge> = Harvesting</li>
                </ul>
                <p className="text-sm text-gray-700 mt-3">
                  <strong>Drag task bars</strong> to reschedule tasks across the timeline!
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">➕ Add Crop Button</h3>
                <p className="text-sm text-gray-700 mb-2">Schedule new crops with two options:</p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4">
                  <li>• <strong>From Seed Stash</strong>: Select seeds you already have</li>
                  <li>• <strong>From Plant Catalog</strong>: Choose any variety from the catalog</li>
                </ul>
                <p className="text-sm text-gray-700 mt-3">
                  The system auto-generates tasks based on frost dates and days-to-maturity!
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">⚙️ Advanced Scheduling</h3>
                <p className="text-sm text-gray-700">
                  Click "Advanced Settings" when adding crops to customize:
                </p>
                <ul className="text-sm text-gray-700 space-y-1 ml-4 mt-2">
                  <li>• Days to maturity</li>
                  <li>• Indoor seeding offset (weeks before frost)</li>
                  <li>• Transplant timing (weeks after frost)</li>
                  <li>• Succession plantings (auto-create multiple crops at intervals)</li>
                </ul>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-lg mb-3">🔄 Integration with Other Features</h2>
            <div className="space-y-3">
              <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="font-semibold mb-2">📌 From Plan Tab (in Plant Seeds modal)</h3>
                <p className="text-sm text-gray-700">
                  When planting in your garden grid (Plot Layout or My Garden), you'll now see a <strong>"From Plan"</strong> tab.
                  This shows crops you've scheduled in the Calendar that haven't been placed yet. Click one to auto-place it!
                </p>
              </Card>

              <Card className="p-4 bg-purple-50 border-purple-200">
                <h3 className="font-semibold mb-2">🌿 My Plants Page</h3>
                <p className="text-sm text-gray-700">
                  Track individual plant lifecycles from seed → sprout → transplant → harvest.
                  Add photos, notes, and watch milestones auto-populate as you update status.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Find it in the sidebar under "My Plants"
                </p>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="font-bold text-lg mb-3">💡 Pro Tips</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Set your frost dates in Settings → Growing Profile for accurate scheduling</li>
              <li>✓ Use succession plantings for continuous harvests (lettuce, beans, etc.)</li>
              <li>✓ Drag tasks on the timeline to adjust dates quickly</li>
              <li>✓ Click any task bar to view detailed "How to" instructions for beginners</li>
              <li>✓ Duplicate crops to quickly create similar schedules</li>
              <li>✓ Use the "From Plan" tab to place scheduled crops into your garden beds</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}