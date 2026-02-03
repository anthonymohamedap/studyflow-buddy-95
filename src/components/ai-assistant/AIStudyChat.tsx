import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Loader2, 
  Send, 
  RefreshCw,
  Lightbulb,
  Code,
  Sparkles,
  GraduationCap,
  HelpCircle,
  CheckSquare,
  List,
  X
} from 'lucide-react';
import { useStudyAssistant } from '@/hooks/useStudyAssistant';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

type AIPolicy = "ALLOWED" | "LIMITED" | "FORBIDDEN";
type ExplainMode = "simple" | "with-code" | "with-analogy";
type QuestionType = "exam-style" | "open" | "multiple-choice";

interface AIStudyChatProps {
  content: string;
  contentType: "theory" | "lab";
  aiPolicy: AIPolicy;
  topicTitle?: string;
  courseContext?: string;
  onClose?: () => void;
}

type Mode = "explain" | "exam-trainer";

export function AIStudyChat({ 
  content, 
  contentType, 
  aiPolicy, 
  topicTitle,
  courseContext,
  onClose 
}: AIStudyChatProps) {
  const [mode, setMode] = useState<Mode>("explain");
  const [explainMode, setExplainMode] = useState<ExplainMode>("simple");
  const [questionType, setQuestionType] = useState<QuestionType>("exam-style");
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [studentAnswer, setStudentAnswer] = useState("");
  
  const { isLoading, response, explain, generateQuestion, submitAnswer, reset } = useStudyAssistant();

  const handleExplain = async () => {
    await explain(content, contentType, aiPolicy, explainMode, topicTitle, courseContext);
  };

  const handleGenerateQuestion = async () => {
    reset();
    setStudentAnswer("");
    const question = await generateQuestion(
      content, 
      contentType, 
      aiPolicy, 
      questionType, 
      "with-feedback",
      topicTitle,
      courseContext
    );
    if (question) {
      setCurrentQuestion(question);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!studentAnswer.trim() || !currentQuestion) return;
    await submitAnswer(
      content,
      contentType,
      aiPolicy,
      currentQuestion,
      studentAnswer,
      topicTitle
    );
  };

  const getPolicyBadge = () => {
    switch (aiPolicy) {
      case "ALLOWED":
        return <Badge className="bg-success text-success-foreground">Full AI Assistance</Badge>;
      case "LIMITED":
        return <Badge className="bg-warning text-warning-foreground">Limited Assistance</Badge>;
      case "FORBIDDEN":
        return <Badge className="bg-destructive text-destructive-foreground">Guidance Only</Badge>;
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            AI Study Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            {getPolicyBadge()}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Mode selector */}
        <div className="flex gap-2 mt-3">
          <Button
            variant={mode === "explain" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("explain"); reset(); }}
            className="flex-1"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Explain
          </Button>
          <Button
            variant={mode === "exam-trainer" ? "default" : "outline"}
            size="sm"
            onClick={() => { setMode("exam-trainer"); reset(); setCurrentQuestion(""); }}
            className="flex-1"
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            Exam Trainer
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden pb-4">
        {mode === "explain" && (
          <>
            {/* Explain mode options */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={explainMode === "simple" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setExplainMode("simple")}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Simple
              </Button>
              <Button
                variant={explainMode === "with-code" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setExplainMode("with-code")}
                disabled={aiPolicy === "FORBIDDEN"}
              >
                <Code className="h-3 w-3 mr-1" />
                With Code
              </Button>
              <Button
                variant={explainMode === "with-analogy" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setExplainMode("with-analogy")}
              >
                <Lightbulb className="h-3 w-3 mr-1" />
                Analogy
              </Button>
            </div>

            {!response && !isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/30 rounded-lg">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Ready to explain!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  I'll break down this {contentType} content into simple terms.
                  {aiPolicy === "FORBIDDEN" && " (Conceptual guidance only)"}
                </p>
                <Button onClick={handleExplain} disabled={isLoading}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Explain Like I'm 12
                </Button>
              </div>
            )}
          </>
        )}

        {mode === "exam-trainer" && (
          <>
            {/* Question type options */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={questionType === "exam-style" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setQuestionType("exam-style")}
              >
                <GraduationCap className="h-3 w-3 mr-1" />
                Exam
              </Button>
              <Button
                variant={questionType === "open" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setQuestionType("open")}
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                Open
              </Button>
              <Button
                variant={questionType === "multiple-choice" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setQuestionType("multiple-choice")}
              >
                <List className="h-3 w-3 mr-1" />
                Multiple Choice
              </Button>
            </div>

            {!currentQuestion && !isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/30 rounded-lg">
                <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">AI Exam Trainer</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Practice with exam-style questions based on this {contentType} content.
                </p>
                <Button onClick={handleGenerateQuestion} disabled={isLoading}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Question
                </Button>
              </div>
            )}
          </>
        )}

        {/* Response area */}
        {(response || isLoading) && (
          <ScrollArea className="flex-1 pr-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {isLoading && !response && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
              <ReactMarkdown>{response}</ReactMarkdown>
              {isLoading && response && (
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
              )}
            </div>
          </ScrollArea>
        )}

        {/* Answer input for exam trainer */}
        {mode === "exam-trainer" && currentQuestion && !isLoading && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <Textarea
              placeholder="Type your answer here..."
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleSubmitAnswer} 
                disabled={!studentAnswer.trim()}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Submit Answer
              </Button>
              <Button 
                variant="outline" 
                onClick={handleGenerateQuestion}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                New Question
              </Button>
            </div>
          </div>
        )}

        {/* Regenerate button for explain mode */}
        {mode === "explain" && response && !isLoading && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleExplain}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Explanation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
