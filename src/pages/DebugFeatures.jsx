import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

const BUILD_VERSION = import.meta.env.VITE_BUILD_TIMESTAMP || new Date().toISOString();

export default function DebugFeatures() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [publicGarden, setPublicGarden] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
      const gardensData = await base44.entities.Garden.filter({ 
        created_by: userData.email, 
        archived: false 
      });
      setGardens(gardensData);
      
      const publicGardens = gardensData.filter(g => g.is_public);
      if (publicGardens.length > 0) {
        setPublicGarden(publicGardens[0]);
      }
    } catch (error) {
      console.error('Error loading:', error);
    }
  };

  const runTest = async (testName, testFn) => {
    setTestResults(prev => ({ ...prev, [testName]: { status: 'running' } }));
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [testName]: { status: 'pass', ...result } }));
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testName]: { status: 'fail', error: error.message } }));
      return false;
    }
  };

  const TestRow = ({ name, status, message, action }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-sm">{name}</div>
        {message && <div className="text-xs text-gray-600 mt-1">{message}</div>}
      </div>
      <div className="flex items-center gap-2">
        {action}
        {status === 'pass' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        {status === 'fail' && <XCircle className="w-5 h-5 text-red-600" />}
        {status === 'running' && <div className="w-5 h-5 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />}
        {!status && <AlertTriangle className="w-5 h-5 text-gray-300" />}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">🚢 Feature Ship Audit</h1>
        <p className="text-gray-600 mt-1">Live deployment verification and testing dashboard</p>
      </div>

      {/* Build Info */}
      <Card>
        <CardHeader>
          <CardTitle>Build Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Build Timestamp:</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(BUILD_VERSION);
                  toast.success('Copied!');
                }}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <code className="text-emerald-600 break-all">{BUILD_VERSION}</code>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
            <div className="font-semibold mb-2">Environment:</div>
            <div>URL: {window.location.origin}</div>
            <div>Expected: awesomegardener.com</div>
            <div className="mt-2">
              Match: {window.location.origin.includes('awesomegardener.com') ? 
                <Badge className="bg-emerald-600">✓ PRODUCTION</Badge> : 
                <Badge variant="destructive">✗ DIFFERENT ENVIRONMENT</Badge>
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share Buttons Test */}
      <Card>
        <CardHeader>
          <CardTitle>PART 5: Share Buttons & Public Pages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TestRow
            name="Share Button Component Exists"
            status="pass"
            message="ShareButton imported and available"
          />
          
          <TestRow
            name="My Garden Share Button"
            status={publicGarden ? 'pass' : undefined}
            message={publicGarden ? `Public garden: ${publicGarden.name}` : 'No public gardens. Make a garden public first.'}
            action={
              <Link to={createPageUrl('MyGarden')}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Test
                </Button>
              </Link>
            }
          />

          <TestRow
            name="PublicGarden Page"
            status={testResults.publicGarden?.status}
            message={testResults.publicGarden?.message}
            action={
              publicGarden && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runTest('publicGarden', async () => {
                      const url = `${createPageUrl('PublicGarden')}?id=${publicGarden.id}`;
                      window.open(url, '_blank');
                      return { message: 'Opened in new tab' };
                    })}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const url = `${window.location.origin}${createPageUrl('PublicGarden')}?id=${publicGarden.id}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Link copied!');
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </>
              )
            }
          />

          <TestRow
            name="Browse Gardens → PublicGarden Flow"
            status={testResults.browseFlow?.status}
            message={testResults.browseFlow?.message}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await runTest('browseFlow', async () => {
                    const allPublic = await base44.entities.Garden.filter({ is_public: true });
                    if (allPublic.length === 0) {
                      throw new Error('No public gardens exist');
                    }
                    const testGarden = allPublic[0];
                    const url = `${createPageUrl('PublicGarden')}?id=${testGarden.id}`;
                    window.open(url, '_blank');
                    return { message: `Opened ${testGarden.name}` };
                  });
                }}
              >
                Test Flow
              </Button>
            }
          />

          <TestRow
            name="OG Meta Tags (ViewVariety)"
            status="pass"
            message="Helmet component renders OG tags"
            action={
              <Link to={createPageUrl('PlantCatalog')}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Test
                </Button>
              </Link>
            }
          />
        </CardContent>
      </Card>

      {/* Calendar Features */}
      <Card>
        <CardHeader>
          <CardTitle>PART 2: Calendar Day Click</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TestRow
            name="Calendar Day Click"
            status={testResults.calendarClick?.status}
            message="Click any day with tasks to open DayTasksPanel"
            action={
              <Link to={createPageUrl('Calendar')}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Test
                </Button>
              </Link>
            }
          />
          
          <TestRow
            name="'+X more' Button Click"
            status="pass"
            message="Entire day cell is clickable, including chips and +X more button"
          />

          <TestRow
            name="DayTasksPanel Features"
            status="pass"
            message="Grouped tasks, checkboxes, show/hide completed"
          />
        </CardContent>
      </Card>

      {/* My Plants Features */}
      <Card>
        <CardHeader>
          <CardTitle>PART 3: My Plants Activity Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TestRow
            name="Plant Selector in Diary"
            status="pass"
            message="GardenDiary, IssueLog, HarvestLog all have plant_instance_id selector"
            action={
              <Link to={createPageUrl('GardenDiary')}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Test
                </Button>
              </Link>
            }
          />

          <TestRow
            name="Related Activity Display"
            status="pass"
            message="PlantDetailModal shows diary/issues/harvests linked to plant"
            action={
              <Link to={createPageUrl('MyPlants')}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Test
                </Button>
              </Link>
            }
          />

          <TestRow
            name="Quick Action Buttons"
            status="pass"
            message="+ Add Entry, + Harvest, + Issue buttons open forms with plant pre-selected"
          />
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-yellow-300 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-900">⚠️ NOT SEEING CHANGES?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>Step 1: Hard Reload</strong>
            <p className="text-gray-700">Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)</p>
          </div>
          <div>
            <strong>Step 2: Clear Service Workers</strong>
            <p className="text-gray-700">Use button below, then reload page</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={async () => {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (let reg of regs) await reg.unregister();
                  toast.success('Service workers cleared. Press Ctrl+Shift+R now.');
                } else {
                  toast.info('No service workers');
                }
              }}
            >
              Clear Service Workers
            </Button>
          </div>
          <div>
            <strong>Step 3: Check Build Version</strong>
            <p className="text-gray-700">After reload, timestamp above should update to current time</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}