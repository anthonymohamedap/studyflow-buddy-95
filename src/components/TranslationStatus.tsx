import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslateContent } from '@/hooks/useTranslation';

interface TranslationStatusProps {
  type: 'chapter' | 'topic' | 'revision_asset';
  id: string;
  translationStatus?: string | null;
  hasTranslation: boolean;
  compact?: boolean;
}

export function TranslationStatus({
  type,
  id,
  translationStatus,
  hasTranslation,
  compact = false,
}: TranslationStatusProps) {
  const { language } = useLanguage();
  const translateContent = useTranslateContent();

  // Only show when viewing in Dutch
  if (language !== 'nl') return null;

  const isTranslating = translationStatus === 'translating' || translateContent.isPending;

  if (hasTranslation) return null;

  if (isTranslating) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {!compact && 'Translating...'}
      </Badge>
    );
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={(e) => {
          e.stopPropagation();
          translateContent.mutate({ type, id });
        }}
        title="Translate to Dutch"
      >
        <Languages className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-muted-foreground">
        NL not generated yet
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1"
        onClick={(e) => {
          e.stopPropagation();
          translateContent.mutate({ type, id });
        }}
      >
        <Languages className="h-3 w-3" />
        Translate
      </Button>
    </div>
  );
}
