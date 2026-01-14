import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Database,
  Upload,
  Settings,
  Shield,
  Edit,
  Image as ImageIcon,
  Users,
  RefreshCw,
  Map,
  Trash2,
  Link2,
  Bug,
  FileText,
  MessageSquare,
  Search,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const ADMIN_TOOLS = {
  'Data & Catalog': [
    { name: 'Data Import', route: 'AdminDataImport', icon: Upload, description: 'Import plant types, varieties, and taxonomy via CSV' },
    { name: 'Data Maintenance', route: 'AdminDataMaintenance', icon: Settings, description: 'Run maintenance scripts and data cleanup' },
    { name: 'Bulk Edit', route: 'AdminBulkEdit', icon: Edit, description: 'Edit multiple records at once' },
    { name: 'Deduplicate Varieties', route: 'AdminDeduplicateVarieties', icon: RefreshCw, description: 'Find and merge duplicate varieties' },
    { name: 'Subcategory Mapping', route: 'SubcategoryMapping', icon: Map, description: 'Manage plant subcategory mappings' },
    { name: 'Browse Categories', route: 'BrowseCategoryConfig', icon: Database, description: 'Configure browse category groupings' },
    { name: 'Data Cleanup', route: 'AdminDataCleanup', icon: Trash2, description: 'Remove invalid records and orphaned data' },
  ],
  'Community Moderation': [
    { name: 'User Reports', route: 'UserReports', icon: Shield, description: 'Review user reports of inappropriate content' },
    { name: 'Variety Reviews', route: 'VarietyReviewQueue', icon: Shield, description: 'Review user-submitted variety reviews' },
    { name: 'Change Requests', route: 'ChangeRequests', icon: Edit, description: 'Review user requests to edit varieties' },
    { name: 'Image Submissions', route: 'ImageSubmissions', icon: ImageIcon, description: 'Review user-submitted variety photos' },
    { name: 'Forum Admin', route: 'ForumAdmin', icon: MessageSquare, description: 'Moderate forum topics and posts' },
  ],
  'Companion Planting': [
    { name: 'Companion Rule Import', route: 'CompanionRuleImport', icon: Upload, description: 'Import companion rules via CSV' },
    { name: 'Companion Rules Audit', route: 'CompanionRulesAudit', icon: Link2, description: 'Audit companion rule consistency' },
  ],
  'Debug & Audit': [
    { name: 'Audit Log', route: 'AdminAuditLog', icon: Shield, description: 'View system action logs' },
    { name: 'Admin Log', route: 'AdminLog', icon: FileText, description: 'View internal application logs' },
    { name: 'Ship Audit', route: 'ShipAudit', icon: Bug, description: 'Review feature ship status' },
    { name: 'Debug Features', route: 'DebugFeatures', icon: Bug, description: 'Test and debug features' },
  ],
  'User Management': [
    { name: 'Manage Users', route: 'Users', icon: Users, description: 'View and manage user accounts' },
  ]
};

export default function AdminHub() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const userData = await base44.auth.me();
      if (!userData || (userData.role !== 'admin' && !userData.is_moderator && !userData.is_editor)) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate(createPageUrl('Dashboard'));
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

  const filteredTools = Object.entries(ADMIN_TOOLS).reduce((acc, [category, tools]) => {
    const filtered = tools.filter(tool => 
      !searchQuery || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {});

  return (
    <ErrorBoundary fallbackTitle="Admin Hub Error">
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Hub</h1>
            <p className="text-gray-600 mt-1">Access all administrative tools and moderation features</p>
          </div>
          <Badge className="bg-red-600 text-white">
            Admin Access
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search admin tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tool Categories */}
        {Object.entries(filteredTools).map(([category, tools]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{category}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.route} to={createPageUrl(tool.route)}>
                    <Card className="hover:shadow-lg transition-all hover:border-emerald-300 cursor-pointer h-full">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base">{tool.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {tool.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(filteredTools).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No tools match your search
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}