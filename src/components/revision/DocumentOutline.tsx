import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Loader2, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDocumentChapters, useParseDocument } from '@/hooks/useDocumentStructure';
import { useLanguage } from '@/contexts/LanguageContext';
import { TranslationStatus } from '@/components/TranslationStatus';
import { cn } from '@/lib/utils';
import { TopicDetailDialog } from './TopicDetailDialog';

interface DocumentOutlineProps {
  theoryTopicId: string;
  documentTitle: string;
  filePath?: string | null;
  sourceUrl?: string | null;
  parsingStatus?: string;
  onParseDocument?: () => void;
}

export function DocumentOutline({ 
  theoryTopicId, 
  documentTitle,
  filePath,
  sourceUrl,
  parsingStatus,
}: DocumentOutlineProps) {
  const { data: chapters, isLoading } = useDocumentChapters(theoryTopicId);
  const { language } = useLanguage();
  const parseDocument = useParseDocument();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Helper to get translated title
  const getTitle = (item: { title: string; title_nl?: string | null }) => {
    if (language === 'nl' && item.title_nl) {
      return item.title_nl;
    }
    return item.title;
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  // Extract storage path from source_url as fallback when file_path is null
  const getEffectiveFilePath = (): string | null => {
    if (filePath) return filePath;
    // Try to extract path from Supabase storage URL
    if (sourceUrl) {
      const marker = '/storage/v1/object/public/course-materials/';
      const idx = sourceUrl.indexOf(marker);
      if (idx !== -1) {
        return decodeURIComponent(sourceUrl.substring(idx + marker.length));
      }
    }
    return null;
  };

  const handleParse = () => {
    const effectivePath = getEffectiveFilePath();
    if (!effectivePath) return;
    parseDocument.mutate({
      theoryTopicId,
      filePath: effectivePath,
      documentTitle,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading document structure...
      </div>
    );
  }

  if (parsingStatus === 'parsing' || parseDocument.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>AI is analyzing your document...</span>
      </div>
    );
  }

  if (!chapters || chapters.length === 0) {
    if (parsingStatus === 'failed') {
      return (
        <div className="space-y-3 py-4">
          <p className="text-sm text-destructive">Failed to parse document. Please try again.</p>
          <Button size="sm" onClick={handleParse} disabled={!getEffectiveFilePath()}>
            <Sparkles className="h-4 w-4 mr-2" />
            Retry Analysis
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3 py-4">
        <p className="text-sm text-muted-foreground">
          Use AI to extract chapters and topics from this document.
        </p>
        <Button 
          size="sm" 
          onClick={handleParse} 
          disabled={!getEffectiveFilePath() || parseDocument.isPending}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Analyze Document
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Document Structure
        </h4>
        <Badge variant="secondary" className="text-xs">
          {chapters.length} chapters
        </Badge>
      </div>

      <div className="space-y-1">
        {chapters.map((chapter) => (
          <Collapsible
            key={chapter.id}
            open={expandedChapters.has(chapter.id)}
            onOpenChange={() => toggleChapter(chapter.id)}
          >
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
                {expandedChapters.has(chapter.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium truncate flex-1">{getTitle(chapter)}</span>
                <TranslationStatus
                  type="chapter"
                  id={chapter.id}
                  translationStatus={chapter.translation_status}
                  hasTranslation={!!chapter.title_nl}
                  compact
                />
                <Badge variant="outline" className="text-xs shrink-0">
                  {chapter.topics.length}
                </Badge>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-6 border-l pl-3 py-1 space-y-1">
                {chapter.topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-2 py-1 rounded-md text-sm transition-colors",
                      "hover:bg-primary/10 hover:text-primary",
                      selectedTopicId === topic.id && "bg-primary/10 text-primary"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">{getTitle(topic)}</span>
                    <TranslationStatus
                      type="topic"
                      id={topic.id}
                      translationStatus={topic.translation_status}
                      hasTranslation={!!topic.title_nl}
                      compact
                    />
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Topic Detail Dialog */}
      <TopicDetailDialog 
        topicId={selectedTopicId} 
        onClose={() => setSelectedTopicId(null)} 
      />
    </div>
  );
}
