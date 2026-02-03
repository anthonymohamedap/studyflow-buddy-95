import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, BookOpen, Save } from 'lucide-react';
import { useDocumentTopic } from '@/hooks/useDocumentStructure';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslateContent } from '@/hooks/useTranslation';
import { TranslationStatus } from '@/components/TranslationStatus';
import { 
  useRevisionAsset, 
  useGenerateRevision, 
  useTopicNotes,
  type AssetType,
  type SummaryContent,
  type FlashcardContent,
  type QuizContent,
  type KeywordsContent,
} from '@/hooks/useRevisionAssets';
import { useAuth } from '@/contexts/AuthContext';
import { SummaryTab } from './tabs/SummaryTab';
import { FlashcardsTab } from './tabs/FlashcardsTab';
import { QuizTab } from './tabs/QuizTab';
import { KeywordsTab } from './tabs/KeywordsTab';

interface TopicDetailDialogProps {
  topicId: string | null;
  onClose: () => void;
}

export function TopicDetailDialog({ topicId, onClose }: TopicDetailDialogProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const translateContent = useTranslateContent();
  const [activeTab, setActiveTab] = useState<AssetType | 'notes'>('summary');
  const [localNotes, setLocalNotes] = useState('');
  
  const { data: topic, isLoading: topicLoading } = useDocumentTopic(topicId ?? undefined);
  const { notes, saveNotes } = useTopicNotes(topicId ?? undefined, user?.id);
  const generateRevision = useGenerateRevision();

  // Asset hooks
  const { data: summaryAsset, isLoading: summaryLoading } = useRevisionAsset(topicId ?? undefined, 'summary');
  const { data: flashcardsAsset, isLoading: flashcardsLoading } = useRevisionAsset(topicId ?? undefined, 'flashcards');
  const { data: quizAsset, isLoading: quizLoading } = useRevisionAsset(topicId ?? undefined, 'quiz');
  const { data: keywordsAsset, isLoading: keywordsLoading } = useRevisionAsset(topicId ?? undefined, 'keywords');

  const handleGenerate = (assetType: AssetType) => {
    if (!topicId || !topic?.content) return;
    generateRevision.mutate({
      topicId,
      assetType,
      topicContent: topic.content,
      topicTitle: topic.title,
    });
  };

  const handleSaveNotes = () => {
    saveNotes.mutate({ content: localNotes });
  };

  // Initialize local notes when notes load
  if (notes && localNotes === '' && notes.content !== localNotes) {
    setLocalNotes(notes.content);
  }

  // Helper to get translated content for revision assets
  const getAssetContent = <T,>(asset: { content: T; content_nl?: T | null } | null | undefined): T | null => {
    if (!asset) return null;
    if (language === 'nl' && asset.content_nl && Object.keys(asset.content_nl as object).length > 0) {
      return asset.content_nl as T;
    }
    return asset.content;
  };

  // Get topic title in correct language
  const getTopicTitle = () => {
    if (!topic) return 'Topic Details';
    if (language === 'nl' && topic.title_nl) {
      return topic.title_nl;
    }
    return topic.title;
  };

  const isGenerating = (assetType: AssetType) => {
    const assetMap = {
      summary: summaryAsset,
      flashcards: flashcardsAsset,
      quiz: quizAsset,
      keywords: keywordsAsset,
    };
    return assetMap[assetType]?.is_generating || generateRevision.isPending;
  };

  const renderGenerateButton = (assetType: AssetType, label: string) => {
    const generating = isGenerating(assetType);
    return (
      <Button 
        onClick={() => handleGenerate(assetType)} 
        disabled={generating || !topic?.content}
        className="w-full"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate {label}
          </>
        )}
      </Button>
    );
  };

  const renderAssetWithTranslation = (
    assetType: AssetType,
    asset: typeof summaryAsset | typeof flashcardsAsset | typeof quizAsset | typeof keywordsAsset,
    isLoading: boolean,
    label: string,
    description: string,
    renderContent: (content: unknown) => React.ReactNode
  ) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }

    if (asset?.generated_at && asset.content) {
      const content = getAssetContent(asset);
      const needsTranslation = language === 'nl' && (!asset.content_nl || Object.keys(asset.content_nl as object).length === 0);
      
      return (
        <div className="space-y-2">
          {needsTranslation && (
            <TranslationStatus
              type="revision_asset"
              id={asset.id}
              translationStatus={asset.translation_status}
              hasTranslation={false}
            />
          )}
          {renderContent(content)}
        </div>
      );
    }

    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">{description}</p>
        {renderGenerateButton(assetType, label)}
      </div>
    );
  };

  return (
    <Dialog open={!!topicId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {topicLoading ? 'Loading...' : getTopicTitle()}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssetType | 'notes')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="summary" className="text-xs sm:text-sm">Summary</TabsTrigger>
            <TabsTrigger value="keywords" className="text-xs sm:text-sm">Key Terms</TabsTrigger>
            <TabsTrigger value="flashcards" className="text-xs sm:text-sm">Flashcards</TabsTrigger>
            <TabsTrigger value="quiz" className="text-xs sm:text-sm">Quiz</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="summary" className="mt-0">
              {renderAssetWithTranslation(
                'summary',
                summaryAsset,
                summaryLoading,
                'Summary',
                'Generate a comprehensive summary of this topic.',
                (content) => (
                  <SummaryTab 
                    content={content as SummaryContent} 
                    onRegenerate={() => handleGenerate('summary')} 
                    isRegenerating={isGenerating('summary')} 
                  />
                )
              )}
            </TabsContent>

            <TabsContent value="keywords" className="mt-0">
              {renderAssetWithTranslation(
                'keywords',
                keywordsAsset,
                keywordsLoading,
                'Key Terms',
                'Extract key terms and definitions from this topic.',
                (content) => (
                  <KeywordsTab 
                    content={content as KeywordsContent} 
                    onRegenerate={() => handleGenerate('keywords')} 
                    isRegenerating={isGenerating('keywords')} 
                  />
                )
              )}
            </TabsContent>

            <TabsContent value="flashcards" className="mt-0">
              {renderAssetWithTranslation(
                'flashcards',
                flashcardsAsset,
                flashcardsLoading,
                'Flashcards',
                'Create flashcards for effective memorization.',
                (content) => (
                  <FlashcardsTab 
                    content={content as FlashcardContent} 
                    onRegenerate={() => handleGenerate('flashcards')} 
                    isRegenerating={isGenerating('flashcards')} 
                  />
                )
              )}
            </TabsContent>

            <TabsContent value="quiz" className="mt-0">
              {renderAssetWithTranslation(
                'quiz',
                quizAsset,
                quizLoading,
                'Quiz',
                'Test your understanding with a quiz.',
                (content) => (
                  <QuizTab 
                    content={content as QuizContent} 
                    onRegenerate={() => handleGenerate('quiz')} 
                    isRegenerating={isGenerating('quiz')} 
                  />
                )
              )}
            </TabsContent>
            <TabsContent value="notes" className="mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Your personal notes for this topic</p>
                  <Button 
                    size="sm" 
                    onClick={handleSaveNotes} 
                    disabled={saveNotes.isPending}
                  >
                    {saveNotes.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Write your notes here..."
                  className="min-h-[300px] resize-none"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
