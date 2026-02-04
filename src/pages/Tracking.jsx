import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookText, Apple, Bug } from 'lucide-react';
import GardenDiary from './GardenDiary';
import HarvestLog from './HarvestLog';
import IssuesLog from './IssuesLog';

export default function Tracking() {
  const [activeTab, setActiveTab] = useState('diary');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BookText className="w-8 h-8 text-emerald-600" />
          Garden Tracking
        </h1>
        <p className="text-gray-600 mt-1">Track your garden activities, harvests, and issues</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="diary" className="gap-2">
            <BookText className="w-4 h-4" />
            Diary
          </TabsTrigger>
          <TabsTrigger value="harvests" className="gap-2">
            <Apple className="w-4 h-4" />
            Harvest Log
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-2">
            <Bug className="w-4 h-4" />
            Issues Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diary" className="mt-6">
          <GardenDiary />
        </TabsContent>

        <TabsContent value="harvests" className="mt-6">
          <HarvestLog />
        </TabsContent>

        <TabsContent value="issues" className="mt-6">
          <IssuesLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}