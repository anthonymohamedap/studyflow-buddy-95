import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlashcardContent } from '@/hooks/useRevisionAssets';

interface FlashcardsTabProps {
  content: FlashcardContent;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function FlashcardsTab({ content, onRegenerate, isRegenerating }: FlashcardsTabProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const cards = content.cards || [];
  const currentCard = cards[currentIndex];

  const nextCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const prevCard = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  if (cards.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No flashcards available.</div>;
  }

  const difficultyColor = {
    easy: 'bg-green-500/10 text-green-600 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    hard: 'bg-red-500/10 text-red-600 border-red-500/20',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {cards.length}
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

      {/* Flashcard */}
      <Card className="min-h-[250px] flex flex-col">
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
          <Badge 
            variant="outline" 
            className={cn("mb-4", difficultyColor[currentCard.difficulty])}
          >
            {currentCard.difficulty}
          </Badge>
          
          <div className="text-center space-y-4 flex-1 flex flex-col justify-center">
            <p className="text-lg font-medium">{currentCard.question}</p>
            
            {showAnswer && (
              <div className="pt-4 border-t">
                <p className="text-muted-foreground">{currentCard.answer}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevCard}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Button 
          variant={showAnswer ? "secondary" : "default"}
          onClick={() => setShowAnswer(!showAnswer)}
        >
          {showAnswer ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide Answer
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Show Answer
            </>
          )}
        </Button>
        
        <Button variant="outline" size="icon" onClick={nextCard}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1">
        {cards.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setShowAnswer(false);
              setCurrentIndex(index);
            }}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              index === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
}
