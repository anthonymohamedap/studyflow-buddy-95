import { useState, useRef } from 'react';
import { useTheoryTopics } from '@/hooks/useTheoryTopics';
import { supabase } from '@/integrations/supabase/client';
import { datastructuresTheoryTopics } from '@/data/sampleTheoryTopics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Video, 
  FileText, 
  Link2, 
  Eye,
  CheckCircle2,
  Circle,
  Star,
  Trash2,
  ExternalLink,
  Upload,
  File,
  Loader2,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface TheoryTabProps {
  courseId: string;
}

const STATUS_CONFIG = {
  NOT_VIEWED: { 
    icon: Circle, 
    label: 'Not Viewed', 
    className: 'text-muted-foreground bg-muted',
    badgeClass: 'bg-muted text-muted-foreground'
  },
  REVIEWED: { 
    icon: Eye, 
    label: 'Reviewed', 
    className: 'text-warning bg-warning/10',
    badgeClass: 'bg-warning/20 text-warning'
  },
  MASTERED: { 
    icon: Star, 
    label: 'Mastered', 
    className: 'text-success bg-success/10',
    badgeClass: 'bg-success/20 text-success'
  },
};

const SOURCE_ICONS = {
  SLIDES: FileText,
  GITBOOK: BookOpen,
  VIDEO: Video,
  PDF: FileText,
  OTHER: Link2,
};

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
                {topicsByWeek[week].map((topic) => {
                  const status = STATUS_CONFIG[topic.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOT_VIEWED;
                  const StatusIcon = status.icon;
                  const SourceIcon = SOURCE_ICONS[topic.source_type as keyof typeof SOURCE_ICONS] || Link2;

                  return (
                    <Card key={topic.id} className="shadow-soft hover:shadow-glow transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => {
                              const nextStatus = topic.status === 'NOT_VIEWED' 
                                ? 'REVIEWED' 
                                : topic.status === 'REVIEWED' 
                                  ? 'MASTERED' 
                                  : 'NOT_VIEWED';
                              handleStatusChange(topic.id, nextStatus);
                            }}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${status.className}`}
                          >
                            <StatusIcon className="h-5 w-5" />
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-medium">{topic.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    <SourceIcon className="h-3 w-3 mr-1" />
                                    {topic.source_type}
                                  </Badge>
                                  <Badge className={`text-xs ${status.badgeClass}`}>
                                    {status.label}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {topic.source_url && (
                                  <a href={topic.source_url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </a>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => deleteTopic.mutate(topic.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {topic.personal_summary && (
                              <p className="text-sm text-muted-foreground mt-2 border-l-2 border-primary/30 pl-3">
                                {topic.personal_summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
