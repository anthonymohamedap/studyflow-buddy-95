import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Eye, 
  Circle, 
  Star, 
  Trash2, 
  ExternalLink,
  ChevronDown,
  FileText,
  BookOpen,
  Video,
  Link2,
  Sparkles,
  Loader2,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { DocumentOutline } from '@/components/revision/DocumentOutline';

type TheoryTopic = Database['public']['Tables']['theory_topics']['Row'];

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

interface TheoryTopicCardProps {
  topic: TheoryTopic;
  onStatusChange: (topicId: string, newStatus: 'NOT_VIEWED' | 'REVIEWED' | 'MASTERED') => void;
  onDelete: (topicId: string) => void;
  onUpdate: (id: string, data: Partial<TheoryTopic>) => void;
}

export function TheoryTopicCard({ topic, onStatusChange, onDelete, onUpdate }: TheoryTopicCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editData, setEditData] = useState({
    title: topic.title,
    source_type: topic.source_type || 'SLIDES',
    source_url: topic.source_url || '',
    week_number: topic.week_number || 1,
    personal_summary: topic.personal_summary || '',
  });

  const handleSaveEdit = () => {
    onUpdate(topic.id, {
      title: editData.title,
      source_type: editData.source_type as 'SLIDES' | 'GITBOOK' | 'VIDEO' | 'PDF' | 'OTHER',
      source_url: editData.source_url || null,
      week_number: editData.week_number,
      personal_summary: editData.personal_summary || null,
    });
    setShowEditDialog(false);
  };
  
  const status = STATUS_CONFIG[topic.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOT_VIEWED;
  const StatusIcon = status.icon;
  const SourceIcon = SOURCE_ICONS[topic.source_type as keyof typeof SOURCE_ICONS] || Link2;

  const hasPreview = topic.source_url && (
    topic.source_url.endsWith('.pdf') || 
    topic.source_type === 'PDF' ||
    topic.source_url.includes('supabase') // Files uploaded to storage
  );

  const canParse = topic.source_type === 'PDF' || topic.source_type === 'SLIDES';
  const isParsed = topic.parsing_status === 'completed';
  const isParsing = topic.parsing_status === 'parsing';


  const handleStatusClick = () => {
    const nextStatus = topic.status === 'NOT_VIEWED' 
      ? 'REVIEWED' 
      : topic.status === 'REVIEWED' 
        ? 'MASTERED' 
        : 'NOT_VIEWED';
    onStatusChange(topic.id, nextStatus);
  };

  return (
    <Card className="shadow-soft hover:shadow-glow transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <button
            onClick={handleStatusClick}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${status.className}`}
          >
            <StatusIcon className="h-5 w-5" />
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-medium">{topic.title}</h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    <SourceIcon className="h-3 w-3 mr-1" />
                    {topic.source_type}
                  </Badge>
                  <Badge className={`text-xs ${status.badgeClass}`}>
                    {status.label}
                  </Badge>
                  {isParsed && (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Parsed
                    </Badge>
                  )}
                  {isParsing && (
                    <Badge variant="secondary" className="text-xs">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Parsing...
                    </Badge>
                  )}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(topic.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {topic.personal_summary && (
              <p className="text-sm text-muted-foreground mt-2 border-l-2 border-primary/30 pl-3">
                {topic.personal_summary}
              </p>
            )}

            {/* AI Study Materials Outline */}
            {canParse && (
              <Collapsible open={showOutline} onOpenChange={setShowOutline} className="mt-3">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Study Materials
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showOutline ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    {loadingContent ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading document content...
                      </div>
                    ) : (
                      <DocumentOutline
                        theoryTopicId={topic.id}
                        documentTitle={topic.title}
                        documentContent={documentContent}
                        parsingStatus={topic.parsing_status || 'pending'}
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Collapsible File Preview */}
            {hasPreview && (
              <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Preview Document
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-lg border bg-muted/30 overflow-hidden">
                    <iframe
                      src={topic.source_url || ''}
                      className="w-full h-[500px]"
                      title={`Preview of ${topic.title}`}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Topic</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-week">Week</Label>
                  <Input
                    id="edit-week"
                    type="number"
                    min={1}
                    max={16}
                    value={editData.week_number}
                    onChange={(e) => setEditData({ ...editData, week_number: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <Select
                    value={editData.source_type}
                    onValueChange={(value: 'SLIDES' | 'GITBOOK' | 'VIDEO' | 'PDF' | 'OTHER') => setEditData({ ...editData, source_type: value })}
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
                <Label htmlFor="edit-url">Source URL</Label>
                <Input
                  id="edit-url"
                  type="url"
                  value={editData.source_url}
                  onChange={(e) => setEditData({ ...editData, source_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-summary">Personal Summary</Label>
                <Textarea
                  id="edit-summary"
                  value={editData.personal_summary}
                  onChange={(e) => setEditData({ ...editData, personal_summary: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
