import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2 } from 'lucide-react';
import type { SummaryContent } from '@/hooks/useRevisionAssets';

interface SummaryTabProps {
  content: SummaryContent;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function SummaryTab({ content, onRegenerate, isRegenerating }: SummaryTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {/* Main Points */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Main Points</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {content.mainPoints?.map((point, index) => (
              <li key={index} className="flex gap-2">
                <Badge variant="secondary" className="shrink-0 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {index + 1}
                </Badge>
                <span className="text-sm">{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Detailed Explanation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detailed Explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {content.detailedExplanation}
          </p>
        </CardContent>
      </Card>

      {/* Key Takeaways */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Key Takeaways</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {content.keyTakeaways?.map((takeaway, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {takeaway}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
