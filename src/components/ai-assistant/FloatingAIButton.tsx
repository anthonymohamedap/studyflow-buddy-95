import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { Bot, Sparkles } from 'lucide-react';
import { AIStudyChat } from './AIStudyChat';
import { cn } from '@/lib/utils';

type AIPolicy = "ALLOWED" | "LIMITED" | "FORBIDDEN";

interface FloatingAIButtonProps {
  aiPolicy: AIPolicy;
  courseName?: string;
  courseId?: string;
  defaultContent?: string;
  defaultContentType?: "theory" | "lab";
  defaultTopicTitle?: string;
}

export function FloatingAIButton({
  aiPolicy,
  courseName,
  courseId,
  defaultContent = "",
  defaultContentType = "theory",
  defaultTopicTitle,
}: FloatingAIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [showSelectionButton, setShowSelectionButton] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 10) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        setSelectedText(text);
        setSelectionPosition({
          x: Math.min(rect.left + rect.width / 2, window.innerWidth - 120),
          y: rect.top - 50,
        });
        setShowSelectionButton(true);
      }
    } else {
      setShowSelectionButton(false);
    }
  }, []);

  const handleClickOutside = useCallback(() => {
    // Delay to allow button click to register
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection?.toString().trim()) {
        setShowSelectionButton(false);
      }
    }, 200);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleTextSelection, handleClickOutside]);

  const handleExplainSelection = () => {
    setShowSelectionButton(false);
    setIsOpen(true);
  };

  const contentToUse = selectedText || defaultContent;

  return (
    <>
      {/* Selection popup button */}
      {showSelectionButton && (
        <div
          className="fixed z-[100] animate-in fade-in zoom-in-90 duration-150"
          style={{
            left: selectionPosition.x,
            top: selectionPosition.y,
            transform: 'translateX(-50%)',
          }}
        >
          <Button
            size="sm"
            onClick={handleExplainSelection}
            className="shadow-lg gap-2"
          >
            <Sparkles className="h-3 w-3" />
            Explain Selection
          </Button>
        </div>
      )}

      {/* Floating button */}
      <Button
        size="lg"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "hover:scale-110 transition-transform duration-200",
          "bg-gradient-to-r from-primary to-primary/80"
        )}
      >
        <Bot className="h-6 w-6" />
      </Button>

      {/* Chat sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>AI Study Assistant</SheetTitle>
            <SheetDescription>Get help understanding course content</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <AIStudyChat
              content={contentToUse}
              contentType={defaultContentType}
              aiPolicy={aiPolicy}
              topicTitle={defaultTopicTitle}
              courseContext={courseName}
              courseId={courseId}
              onClose={() => setIsOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
