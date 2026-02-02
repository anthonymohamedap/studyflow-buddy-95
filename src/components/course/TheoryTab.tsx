import { useState, useRef } from 'react';
import { useTheoryTopics } from '@/hooks/useTheoryTopics';
import { supabase } from '@/integrations/supabase/client';
import { datastructuresTheoryTopics } from '@/data/sampleTheoryTopics';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, 
  BookOpen, 
  Upload,
  Trash2,
  Loader2,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { TheoryTopicCard } from './TheoryTopicCard';

interface TheoryTabProps {
  courseId: string;
}

// Status and source config moved to TheoryTopicCard component

export function TheoryTab({ courseId }: TheoryTabProps) {
  const { topics, isLoading, createTopic, updateTopic, deleteTopic } = useTheoryTopics(courseId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newTopic, setNewTopic] = useState({
    title: '',
    source_type: 'SLIDES' as 'SLIDES' | 'GITBOOK' | 'VIDEO' | 'PDF' | 'OTHER',
    source_url: '',
    week_number: 1,
    personal_summary: '',
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-set title from filename if empty
      if (!newTopic.title) {
        const name = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        setNewTopic(prev => ({ ...prev, title: name }));
      }
      // Auto-detect source type from extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        setNewTopic(prev => ({ ...prev, source_type: 'PDF' }));
      }
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${courseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('course-materials')
      .upload(fileName, file);
    
    if (error) {
      toast.error('Failed to upload file: ' + error.message);
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('course-materials')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingFile(true);
    
    try {
      let fileUrl = newTopic.source_url;
      
      // Upload file if selected
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (uploadedUrl) {
          fileUrl = uploadedUrl;
        }
      }
      
      await createTopic.mutateAsync({
        course_id: courseId,
        ...newTopic,
        source_url: fileUrl,
      });
      
      setShowAddDialog(false);
      setSelectedFile(null);
      setNewTopic({
        title: '',
        source_type: 'SLIDES',
        source_url: '',
        week_number: 1,
        personal_summary: '',
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleImportSampleTopics = async () => {
    try {
      for (const topic of datastructuresTheoryTopics) {
        await createTopic.mutateAsync({
          course_id: courseId,
          ...topic,
        });
      }
      toast.success(`Imported ${datastructuresTheoryTopics.length} theory topics!`);
    } catch (error) {
      toast.error('Failed to import some topics');
    }
  };

  const handleStatusChange = async (topicId: string, newStatus: 'NOT_VIEWED' | 'REVIEWED' | 'MASTERED') => {
    await updateTopic.mutateAsync({ id: topicId, status: newStatus });
  };

  // Group topics by week
  const topicsByWeek = topics.reduce((acc, topic) => {
    const week = topic.week_number || 0;
    if (!acc[week]) acc[week] = [];
    acc[week].push(topic);
    return acc;
  }, {} as Record<number, typeof topics>);

  const weeks = Object.keys(topicsByWeek).map(Number).sort((a, b) => a - b);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Theory Topics</h3>
          <p className="text-sm text-muted-foreground">Track your understanding of course material</p>
        </div>
        <div className="flex gap-2">
          {topics.length === 0 && (
            <Button variant="secondary" onClick={handleImportSampleTopics} disabled={createTopic.isPending}>
              <Sparkles className="h-4 w-4 mr-2" />
              Import Sample Topics
            </Button>
          )}
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Topic
          </Button>
        </div>
      </div>

      {topics.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No theory topics yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add topics from your course syllabus to track your progress
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleImportSampleTopics} disabled={createTopic.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />
                Import from Syllabi
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Topic
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {weeks.map((week) => (
            <div key={week}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {week === 0 ? 'Unassigned' : `Week ${week}`}
              </h4>
              <div className="space-y-3">
                {topicsByWeek[week].map((topic) => (
                  <TheoryTopicCard
                    key={topic.id}
                    topic={topic}
                    onStatusChange={handleStatusChange}
                    onDelete={(id) => deleteTopic.mutate(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Topic Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <form onSubmit={handleAddTopic}>
            <DialogHeader>
              <DialogTitle>Add Theory Topic</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newTopic.title}
                  onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                  placeholder="e.g., Introduction to Recursion"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="week">Week</Label>
                  <Input
                    id="week"
                    type="number"
                    min={1}
                    max={16}
                    value={newTopic.week_number}
                    onChange={(e) => setNewTopic({ ...newTopic, week_number: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_type">Source Type</Label>
                  <Select
                    value={newTopic.source_type}
                    onValueChange={(value: typeof newTopic.source_type) => 
                      setNewTopic({ ...newTopic, source_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SLIDES">Slides</SelectItem>
                      <SelectItem value="GITBOOK">GitBook</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="PDF">PDF</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Upload Document</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.pptx,.ppt,.docx,.doc"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {selectedFile ? selectedFile.name : 'Choose File'}
                  </Button>
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedFile(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Or enter a URL below</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_url">Source URL</Label>
                <Input
                  id="source_url"
                  type="url"
                  value={newTopic.source_url}
                  onChange={(e) => setNewTopic({ ...newTopic, source_url: e.target.value })}
                  placeholder="https://..."
                  disabled={!!selectedFile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Personal Summary</Label>
                <Textarea
                  id="summary"
                  value={newTopic.personal_summary}
                  onChange={(e) => setNewTopic({ ...newTopic, personal_summary: e.target.value })}
                  placeholder="Your notes about this topic..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTopic.isPending || uploadingFile}>
                {uploadingFile ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Add Topic'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
