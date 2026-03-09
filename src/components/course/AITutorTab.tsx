import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, 
  BookOpen, 
  FlaskRound, 
  Lightbulb, 
  GraduationCap,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useTheoryTopics } from '@/hooks/useTheoryTopics';
import { useLabs } from '@/hooks/useLabs';
import { useDocumentChapters } from '@/hooks/useDocumentStructure';
import { AIStudyChat } from '@/components/ai-assistant';
import { useLanguage } from '@/contexts/LanguageContext';

type AIPolicy = "ALLOWED" | "LIMITED" | "FORBIDDEN";

interface AITutorTabProps {
  courseId: string;
  courseName: string;
  aiPolicy: AIPolicy;
}

export function AITutorTab({ courseId, courseName, aiPolicy }: AITutorTabProps) {
  const { language } = useLanguage();
  const { topics: theoryTopics, isLoading: theoryLoading } = useTheoryTopics(courseId);
  const { labs, isLoading: labsLoading } = useLabs(courseId);
  
  const [selectedSource, setSelectedSource] = useState<{
    type: "theory" | "lab";
    id: string;
    title: string;
    content: string;
  } | null>(null);

  const [expandedTheoryId, setExpandedTheoryId] = useState<string | null>(null);
  
  // Get document structure for expanded theory topic
  const { data: chapters } = useDocumentChapters(expandedTheoryId ?? undefined);

  const handleSelectTheoryTopic = (topicId: string, title: string) => {
    // Get all chapter and topic content
    const theoryChapters = chapters || [];
    let content = "";
    theoryChapters.forEach(ch => {
      const chapterTitle = language === 'nl' && ch.title_nl ? ch.title_nl : ch.title;
      content += `## ${chapterTitle}\n`;
      if (ch.content) {
        const chapterContent = language === 'nl' && ch.content_nl ? ch.content_nl : ch.content;
        content += chapterContent + "\n\n";
      }
      ch.topics?.forEach(t => {
        const topicTitle = language === 'nl' && t.title_nl ? t.title_nl : t.title;
        const topicContent = language === 'nl' && t.content_nl ? t.content_nl : t.content;
        content += `### ${topicTitle}\n${topicContent || ''}\n\n`;
      });
    });
    
    if (content.trim()) {
      setSelectedSource({
        type: "theory",
        id: topicId,
        title,
        content: content.slice(0, 10000), // Limit content size
      });
    }
  };

  const handleSelectLab = async (labId: string, title: string, description?: string) => {
    setSelectedSource({
      type: "lab",
      id: labId,
      title,
      content: description || `Lab: ${title}`,
    });
  };

  const getPolicyDescription = () => {
    switch (aiPolicy) {
      case "ALLOWED":
        return "Full AI assistance is available for this course.";
      case "LIMITED":
        return "AI can explain concepts but won't provide full solutions.";
      case "FORBIDDEN":
        return "AI provides guidance only - no direct answers.";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Content selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Select Content to Study
          </CardTitle>
          <p className="text-sm text-muted-foreground">{getPolicyDescription()}</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="theory">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="theory" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Theory
              </TabsTrigger>
              <TabsTrigger value="labs" className="gap-2">
                <FlaskRound className="h-4 w-4" />
                Labs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="theory">
              <ScrollArea className="h-[400px] pr-4">
                {theoryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : theoryTopics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No theory topics available</p>
                    <p className="text-sm">Upload documents in the Theory tab first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {theoryTopics.map((topic) => (
                      <div key={topic.id}>
                        <Button
                          variant={expandedTheoryId === topic.id ? "secondary" : "ghost"}
                          className="w-full justify-between text-left"
                          onClick={() => {
                            if (expandedTheoryId === topic.id) {
                              handleSelectTheoryTopic(topic.id, topic.title);
                            } else {
                              setExpandedTheoryId(topic.id);
                            }
                          }}
                        >
                          <span className="truncate">{topic.title}</span>
                          <ChevronRight className={`h-4 w-4 transition-transform ${expandedTheoryId === topic.id ? 'rotate-90' : ''}`} />
                        </Button>
                        
                        {expandedTheoryId === topic.id && chapters && (
                          <div className="ml-4 mt-2 space-y-1 border-l-2 pl-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => handleSelectTheoryTopic(topic.id, topic.title)}
                            >
                              <Bot className="h-3 w-3 mr-2" />
                              Study entire document
                            </Button>
                            {chapters.map((ch) => (
                              <div key={ch.id} className="text-sm text-muted-foreground py-1">
                                {language === 'nl' && ch.title_nl ? ch.title_nl : ch.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="labs">
              <ScrollArea className="h-[400px] pr-4">
                {labsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : labs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No labs available</p>
                    <p className="text-sm">Add labs in the Labos tab first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {labs.map((lab) => {
                      const title = language === 'nl' && lab.title_nl ? lab.title_nl : lab.title;
                      const description = language === 'nl' && lab.description_nl ? lab.description_nl : lab.description;
                      return (
                        <Button
                          key={lab.id}
                          variant={selectedSource?.id === lab.id ? "secondary" : "ghost"}
                          className="w-full justify-between text-left h-auto py-3"
                          onClick={() => handleSelectLab(lab.id, title, description || undefined)}
                        >
                          <div className="flex flex-col items-start">
                            <span className="truncate">{title}</span>
                            {lab.week_number && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                Week {lab.week_number}
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Right: AI Chat */}
      <div className="h-[550px]">
        {selectedSource ? (
          <AIStudyChat
            content={selectedSource.content}
            contentType={selectedSource.type}
            aiPolicy={aiPolicy}
            topicTitle={selectedSource.title}
            courseContext={courseName}
            courseId={courseId}
            onClose={() => setSelectedSource(null)}
          />
        ) : (
          <Card className="h-full flex flex-col items-center justify-center text-center">
            <CardContent className="pt-6">
              <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select Content to Start</h3>
              <p className="text-muted-foreground mb-4">
                Choose a theory topic or lab from the left panel to begin studying with AI assistance.
              </p>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4 text-warning" />
                  <span>Explain concepts</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span>Practice exams</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
