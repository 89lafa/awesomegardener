import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, Eye, Loader2, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';


export default function AdminBlogManager() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    hero_image: '',
    excerpt: '',
    content: '',
    category: 'news',
    tags: [],
    status: 'draft',
    allow_comments: true
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const user = await base44.auth.me();
      if (!user || (user.role !== 'admin' && !user.is_moderator)) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      loadPosts();
    } catch (error) {
      navigate(createPageUrl('Dashboard'));
    }
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.BlogPost.list('-created_date', 100);
      setPosts(data);
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast.error('Title and content are required');
      return;
    }

    try {
      const user = await base44.auth.me();
      const slug = formData.slug || generateSlug(formData.title);
      
      const postData = {
        ...formData,
        slug,
        author_email: user.email,
        author_name: user.full_name,
        published_date: formData.status === 'published' && !editingPost ? new Date().toISOString() : formData.published_date
      };

      if (editingPost) {
        await base44.entities.BlogPost.update(editingPost.id, postData);
        toast.success('Post updated!');
      } else {
        await base44.entities.BlogPost.create(postData);
        toast.success('Post created!');
      }
      
      closeDialog();
      loadPosts();
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('Failed to save post');
    }
  };

  const handleDelete = async (post) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    
    try {
      await base44.entities.BlogPost.delete(post.id);
      toast.success('Post deleted');
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, hero_image: file_url });
      toast.success('Image uploaded!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const openNew = () => {
    setEditingPost(null);
    setFormData({
      title: '',
      slug: '',
      hero_image: '',
      excerpt: '',
      content: '',
      category: 'news',
      tags: [],
      status: 'draft',
      allow_comments: true
    });
    setShowDialog(true);
  };

  const openEdit = (post) => {
    setEditingPost(post);
    setFormData({
      title: post.title || '',
      slug: post.slug || '',
      hero_image: post.hero_image || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      category: post.category || 'news',
      tags: post.tags || [],
      status: post.status || 'draft',
      allow_comments: post.allow_comments ?? true,
      published_date: post.published_date
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingPost(null);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('AdminHub'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Blog Manager</h1>
            <p className="text-gray-600">Create and manage blog posts</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          New Post
        </Button>
      </div>

      <div className="grid gap-4">
        {posts.map(post => (
          <Card key={post.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {post.hero_image && (
                  <img src={post.hero_image} alt={post.title} className="w-32 h-24 object-cover rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{post.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                          {post.status}
                        </Badge>
                        <span className="capitalize">{post.category}</span>
                        {post.published_date && (
                          <span>{format(new Date(post.published_date), 'MMM d, yyyy')}</span>
                        )}
                        <span>{post.view_count || 0} views</span>
                        <span>{post.upvote_count || 0} upvotes</span>
                        <span>{post.comment_count || 0} comments</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => window.open(createPageUrl('BlogPost') + `?id=${post.id}`, '_blank')}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(post)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(post)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 && (
        <Card className="py-16">
          <CardContent className="text-center">
            <h3 className="text-lg font-semibold mb-2">No blog posts yet</h3>
            <p className="text-gray-600 mb-4">Create your first blog post to share news and updates</p>
            <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Create First Post
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={closeDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Edit Post' : 'New Blog Post'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setFormData({ 
                    ...formData, 
                    title,
                    slug: generateSlug(title)
                  });
                }}
                placeholder="Post title"
                className="mt-2"
              />
            </div>

            <div>
              <Label>URL Slug</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="url-friendly-slug"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Hero Image</Label>
              {formData.hero_image && (
                <img src={formData.hero_image} alt="Hero" className="w-full h-48 object-cover rounded-lg mt-2" />
              )}
              <Button
                onClick={() => document.getElementById('hero-upload').click()}
                variant="outline"
                disabled={uploading}
                className="w-full mt-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                {formData.hero_image ? 'Change Image' : 'Upload Image'}
              </Button>
              <input
                id="hero-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div>
              <Label>Excerpt (short summary)</Label>
              <Textarea
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                placeholder="Brief summary for preview..."
                rows={2}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Content *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your blog post content here..."
                rows={16}
                className="mt-2 font-mono text-sm"
              />
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2 text-xs space-y-1">
                <p className="font-bold text-blue-900">Markdown Formatting Guide:</p>
                <p><strong>**Bold text**</strong> → <strong>Bold text</strong></p>
                <p><strong>*Italic text*</strong> → <em>Italic text</em></p>
                <p><strong># Heading 1</strong> → Large heading</p>
                <p><strong>## Heading 2</strong> → Medium heading</p>
                <p><strong>### Heading 3</strong> → Small heading</p>
                <p><strong>[Link text](https://url.com)</strong> → Clickable link</p>
                <p><strong>- List item</strong> → Bullet point</p>
                <p><strong>1. Numbered item</strong> → Numbered list</p>
                <p><strong>Two line breaks = New paragraph</strong></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blog">Blog</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="guide">Guide</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="tip">Tip</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tags (comma-separated keywords)</Label>
              <Input
                value={formData.tags?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  setFormData({ ...formData, tags });
                }}
                placeholder="gardening, tips, tomatoes"
                className="mt-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allow_comments"
                checked={formData.allow_comments}
                onChange={(e) => setFormData({ ...formData, allow_comments: e.target.checked })}
              />
              <Label htmlFor="allow_comments">Allow comments</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              {editingPost ? 'Update' : 'Create'} Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}