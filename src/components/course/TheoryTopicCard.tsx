import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

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
}

export function TheoryTopicCard({ topic, onStatusChange, onDelete }: TheoryTopicCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const status = STATUS_CONFIG[topic.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOT_VIEWED;
  const StatusIcon = status.icon;
  const SourceIcon = SOURCE_ICONS[topic.source_type as keyof typeof SOURCE_ICONS] || Link2;

  const hasPreview = topic.source_url && (
    topic.source_url.endsWith('.pdf') || 
    topic.source_type === 'PDF' ||
    topic.source_url.includes('supabase') // Files uploaded to storage
  );

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
                  onClick={() => onDelete(topic.id)}
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
      </CardContent>
    </Card>
  );
}
