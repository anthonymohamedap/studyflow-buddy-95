import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Loader2, Check, X, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizContent } from '@/hooks/useRevisionAssets';

interface QuizTabProps {
  content: QuizContent;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function QuizTab({ content, onRegenerate, isRegenerating }: QuizTabProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());

  const questions = content.questions || [];

  const handleAnswer = (questionIndex: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
  };

  const toggleReveal = (index: number) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResults(false);
    setRevealedAnswers(new Set());
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, index) => {
      if (q.type === 'mcq' && answers[index] === q.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  if (questions.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No quiz questions available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {questions.length} questions
        </span>
        <div className="flex gap-2">
          {showResults && (
            <Button variant="outline" size="sm" onClick={resetQuiz}>
              Retry Quiz
            </Button>
          )}
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
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">Q{index + 1}</Badge>
                  <span>{question.question}</span>
                </CardTitle>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {question.type === 'mcq' ? 'Multiple Choice' : 'Open'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {question.type === 'mcq' && question.options ? (
                <RadioGroup
                  value={answers[index] || ''}
                  onValueChange={(value) => handleAnswer(index, value)}
                  disabled={showResults}
                >
                  {question.options.map((option, optIndex) => (
                    <div
                      key={optIndex}
                      className={cn(
                        "flex items-center space-x-2 p-2 rounded-md transition-colors",
                        showResults && option === question.correctAnswer && "bg-green-500/10",
                        showResults && answers[index] === option && option !== question.correctAnswer && "bg-red-500/10"
                      )}
                    >
                      <RadioGroupItem value={option} id={`q${index}-${optIndex}`} />
                      <Label htmlFor={`q${index}-${optIndex}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                      {showResults && option === question.correctAnswer && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                      {showResults && answers[index] === option && option !== question.correctAnswer && (
                        <X className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={answers[index] || ''}
                    onChange={(e) => handleAnswer(index, e.target.value)}
                    placeholder="Write your answer here..."
                    className="resize-none"
                    rows={3}
                    disabled={showResults}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleReveal(index)}
                    className="text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {revealedAnswers.has(index) ? 'Hide' : 'Show'} Answer
                  </Button>
                  {revealedAnswers.has(index) && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">Correct Answer:</p>
                      <p className="text-sm text-muted-foreground">{question.correctAnswer}</p>
                      {question.explanation && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{question.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {showResults && question.explanation && question.type === 'mcq' && (
                <p className="text-xs text-muted-foreground italic pt-2 border-t">
                  {question.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit button */}
      {!showResults && (
        <Button onClick={() => setShowResults(true)} className="w-full">
          Check Answers
        </Button>
      )}

      {/* Score */}
      {showResults && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-lg font-semibold">
                Your Score: {calculateScore()} / {questions.filter(q => q.type === 'mcq').length} MCQ
              </p>
              <p className="text-sm text-muted-foreground">
                Check open-ended questions manually above
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
