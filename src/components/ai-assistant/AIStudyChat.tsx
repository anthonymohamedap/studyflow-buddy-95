import { useState, useRef, useEffect } from 'react';
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
  List,
  X,
  User,
  History,
  Trash2,
  MessageSquarePlus
} from 'lucide-react';
import { useStudyAssistant } from '@/hooks/useStudyAssistant';
import { useChatHistory } from '@/hooks/useChatHistory';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

type AIPolicy = "ALLOWED" | "LIMITED" | "FORBIDDEN";

interface AIStudyChatProps {
  content: string;
  contentType: "theory" | "lab";
  aiPolicy: AIPolicy;
  topicTitle?: string;
  courseContext?: string;
  courseId?: string;
  onClose?: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AIStudyChat({ 
  content, 
  contentType, 
  aiPolicy, 
  topicTitle,
  courseContext,
  courseId,
  onClose 
}: AIStudyChatProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { isLoading, response, sendRequest, reset } = useStudyAssistant();
  const {
    conversations,
    activeConversationId,
    loadMessages,
    createConversation,
    saveMessage,
    deleteConversation,
    startNewChat,
    messages: savedMessages,
    loadingConversations,
    loadingMessages,
  } = useChatHistory(courseId);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, response, isLoading]);

  // When loading a saved conversation, set messages
  useEffect(() => {
    if (savedMessages.length > 0) {
      setChatMessages(savedMessages.map(m => ({ role: m.role, content: m.content })));
      setShowHistory(false);
    }
  }, [savedMessages]);

  // When a response completes, add it to chat history and save
  useEffect(() => {
    if (!isLoading && response && chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.role === "user") {
        setChatMessages(prev => [...prev, { role: "assistant", content: response }]);
        // Save assistant message to DB
        if (activeConversationId) {
          saveMessage(activeConversationId, "assistant", response);
        }
        reset();
      }
    }
  }, [isLoading, response]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;
    
    setInputValue("");
    
    const newUserMessage: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);

    // Create conversation if needed, then save user message
    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation(contentType, topicTitle);
    }
    if (convId) {
      await saveMessage(convId, "user", text);
    }

    // Build messages array for API
    const apiMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }));
    await sendRequest(apiMessages, courseContext, content.slice(0, 6000));
  };

  const handleQuickAction = (action: string) => {
    const messages: Record<string, string> = {
      "explain-simple": `Leg het volgende materiaal uit in eenvoudige termen${topicTitle ? ` over "${topicTitle}"` : ''}:\n\n${content.slice(0, 4000)}`,
      "explain-code": `Leg het volgende materiaal uit met code voorbeelden${topicTitle ? ` over "${topicTitle}"` : ''}:\n\n${content.slice(0, 4000)}`,
      "explain-analogy": `Leg het volgende materiaal uit met een real-world analogie${topicTitle ? ` over "${topicTitle}"` : ''}:\n\n${content.slice(0, 4000)}`,
      "exam-question": `Genereer een examenvraag gebaseerd op dit materiaal${topicTitle ? ` over "${topicTitle}"` : ''}:\n\n${content.slice(0, 4000)}`,
      "multiple-choice": `Genereer een multiple choice vraag gebaseerd op dit materiaal${topicTitle ? ` over "${topicTitle}"` : ''}:\n\n${content.slice(0, 4000)}`,
    };
    handleSend(messages[action]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setChatMessages([]);
    reset();
    startNewChat();
  };

  const handleLoadConversation = (convId: string) => {
    loadMessages(convId);
  };

  const getPolicyBadge = () => {
    switch (aiPolicy) {
      case "ALLOWED":
        return <Badge className="bg-success text-success-foreground">Full AI</Badge>;
      case "LIMITED":
        return <Badge className="bg-warning text-warning-foreground">Limited</Badge>;
      case "FORBIDDEN":
        return <Badge className="bg-destructive text-destructive-foreground">Guidance Only</Badge>;
    }
  };

  const hasMessages = chatMessages.length > 0;

  // History panel
  if (showHistory) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Chatgeschiedenis
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden pb-4">
          <Button 
            variant="outline" 
            className="w-full mb-3 gap-2" 
            onClick={() => { handleNewChat(); setShowHistory(false); }}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Nieuwe chat
          </Button>
          <ScrollArea className="h-[calc(100%-48px)]">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Nog geen chatgeschiedenis</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div 
                    key={conv.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                      activeConversationId === conv.id && "bg-muted border-primary/30"
                    )}
                    onClick={() => handleLoadConversation(conv.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.topic_title || "Chat"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: nl })}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            AI Study Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            {getPolicyBadge()}
            {courseId && (
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(true)} title="Chatgeschiedenis">
                <History className="h-4 w-4" />
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden pb-4">
        {/* Quick actions when no messages yet */}
        {!hasMessages && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">AI Study Assistant</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Ask anything about this {contentType} content, or use a quick action below.
            </p>
            
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              <Button variant="outline" size="sm" onClick={() => handleQuickAction("explain-simple")} className="gap-1">
                <Sparkles className="h-3 w-3" />
                Simple Explain
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickAction("explain-analogy")} className="gap-1">
                <Lightbulb className="h-3 w-3" />
                With Analogy
              </Button>
              <Button 
                variant="outline" size="sm" 
                onClick={() => handleQuickAction("explain-code")} 
                className="gap-1"
                disabled={aiPolicy === "FORBIDDEN"}
              >
                <Code className="h-3 w-3" />
                With Code
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickAction("exam-question")} className="gap-1">
                <GraduationCap className="h-3 w-3" />
                Exam Question
              </Button>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {(hasMessages || isLoading) && (
          <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
            <div className="space-y-4 pb-2">
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    "rounded-lg px-3 py-2 max-w-[85%]",
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming response */}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-3 py-2 max-w-[85%] bg-muted">
                    {response ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{response}</ReactMarkdown>
                        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Input area */}
        <div className="mt-3 pt-3 border-t flex-shrink-0">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type your question or message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={isLoading}
            />
            <Button 
              onClick={() => handleSend()} 
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="flex-shrink-0 h-[44px] w-[44px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {hasMessages && !isLoading && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleQuickAction("exam-question")}>
                <GraduationCap className="h-3 w-3" />
                Exam Question
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleQuickAction("multiple-choice")}>
                <List className="h-3 w-3" />
                MC Question
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleNewChat}>
                <RefreshCw className="h-3 w-3" />
                New Chat
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
