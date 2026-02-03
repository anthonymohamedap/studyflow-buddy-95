import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KeywordsContent } from '@/hooks/useRevisionAssets';

interface KeywordsTabProps {
  content: KeywordsContent;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function KeywordsTab({ content, onRegenerate, isRegenerating }: KeywordsTabProps) {
  const terms = content.terms || [];

  const importanceColor = {
    high: 'border-l-red-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-blue-500',
  };

  const importanceBadge = {
    high: 'bg-red-500/10 text-red-600 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  };

  if (terms.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No key terms available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {terms.length} key terms
        </span>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isRegenerating}>
          {isRegenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </>
          )}
        </Button>
      </div>

      {/* Terms list */}
      <div className="space-y-3">
        {terms.map((term, index) => (
          <Card 
            key={index} 
            className={cn("border-l-4", importanceColor[term.importance])}
          >
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h4 className="font-medium">{term.term}</h4>
                  <p className="text-sm text-muted-foreground">{term.definition}</p>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn("shrink-0 text-xs", importanceBadge[term.importance])}
                >
                  {term.importance}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
