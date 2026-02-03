import { useState, useRef } from 'react';
import { useLab, useLabAssets, useLabSections, useLabMutations } from '@/hooks/useLabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { TranslationStatus } from '@/components/TranslationStatus';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X,
  FileText,
  ListChecks,
  Route,
  BookOpen,
  Sparkles,
  Loader2,
  RefreshCw,
  Upload,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface LabDetailPanelProps {
  labId: string;
  onClose: () => void;
}

export function LabDetailPanel({ labId, onClose }: LabDetailPanelProps) {
  const { lab, isLoading: labLoading } = useLab(labId);
  const { summary, approachPlan, checklist, isLoading: assetsLoading, refetch: refetchAssets } = useLabAssets(labId);
  const { sections, isLoading: sectionsLoading } = useLabSections(labId);
  const { updateLab, parseLab } = useLabMutations();
  const { language } = useLanguage();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStatusChange = (status: string) => {
    updateLab.mutate({ id: labId, status: status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' });
  };

  const handleRegenerate = async () => {
    if (!lab?.file_path) {
      toast.error('No document attached to regenerate from');
      return;
    }
    setIsRegenerating(true);
    try {
      await parseLab.mutateAsync({ labId, filePath: lab.file_path });
      refetchAssets();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRegenerating(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `labs/${lab?.course_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      await updateLab.mutateAsync({ id: labId, file_path: filePath });
      
      const fileContent = await file.text();
      await parseLab.mutateAsync({ labId, filePath, fileContent });
      refetchAssets();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload and analyze document');
    } finally {
      setIsRegenerating(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (labLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!lab) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Lab not found</p>
        </CardContent>
      </Card>
    );
  }

  const hasGeneratedContent = summary || approachPlan || checklist;
  const isParsing = lab.parsing_status === 'parsing';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CardTitle className="text-xl">{lab.displayTitle}</CardTitle>
            {language === 'nl' && !lab.title_nl && (
              <Badge variant="outline" className="text-xs">EN only</Badge>
            )}
          </div>
          {lab.week_number && (
            <Badge variant="secondary">Week {lab.week_number}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={lab.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Description */}
        {lab.displayDescription && (
          <p className="text-muted-foreground">{lab.displayDescription}</p>
        )}

        {/* No document attached */}
        {!lab.file_path && !hasGeneratedContent && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">No Document Attached</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a lab document to generate AI study materials
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.doc,.ppt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isRegenerating}>
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Document
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Parsing in progress */}
        {isParsing && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Analyzing document...</p>
                <p className="text-sm text-muted-foreground">
                  Extracting content and generating study materials
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parsing error */}
        {lab.parsing_status === 'error' && (
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Analysis Failed</p>
                <p className="text-sm text-muted-foreground">{lab.parsing_error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Generated Content Tabs */}
        {hasGeneratedContent && !isParsing && (
          <Tabs defaultValue="summary" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="summary" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="approach" className="gap-2">
                  <Route className="h-4 w-4" />
                  Approach Plan
                </TabsTrigger>
                <TabsTrigger value="checklist" className="gap-2">
                  <ListChecks className="h-4 w-4" />
                  Checklist
                </TabsTrigger>
                {sections.length > 0 && (
                  <TabsTrigger value="sections" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Sections
                  </TabsTrigger>
                )}
              </TabsList>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRegenerate}
                disabled={isRegenerating || !lab.file_path}
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerate
              </Button>
            </div>

            <TabsContent value="summary">
              <SummaryContent summary={summary} />
            </TabsContent>

            <TabsContent value="approach">
              <ApproachPlanContent approachPlan={approachPlan} />
            </TabsContent>

            <TabsContent value="checklist">
              <ChecklistContent checklist={checklist} labId={labId} />
            </TabsContent>

            {sections.length > 0 && (
              <TabsContent value="sections">
                <SectionsContent sections={sections} />
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Document link */}
        {lab.file_path && (
          <div className="pt-4 border-t">
            <Button variant="outline" size="sm" asChild>
              <a 
                href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/course-materials/${lab.file_path}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Original Document
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryContent({ summary }: { summary: ReturnType<typeof useLabAssets>['summary'] }) {
  if (!summary) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2" />
          No summary generated yet
        </CardContent>
      </Card>
    );
  }

  const content = summary.displayContent as { title?: string; bullets?: string[] };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {content.title || 'Lab Summary'}
          </CardTitle>
          {summary.needsTranslation && (
            <Badge variant="outline" className="text-xs">NL not generated yet</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {content.bullets && content.bullets.length > 0 ? (
          <ul className="space-y-2">
            {content.bullets.map((bullet, index) => (
              <li key={index} className="flex gap-2">
                <Badge variant="secondary" className="shrink-0 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {index + 1}
                </Badge>
                <span className="text-sm">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No summary points available</p>
        )}
      </CardContent>
    </Card>
  );
}

function ApproachPlanContent({ approachPlan }: { approachPlan: ReturnType<typeof useLabAssets>['approachPlan'] }) {
  if (!approachPlan) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2" />
          No approach plan generated yet
        </CardContent>
      </Card>
    );
  }

  const content = approachPlan.displayContent as { 
    steps?: Array<{
      number: number;
      title: string;
      description: string;
      checks?: string[];
      pitfalls?: string[];
    }> 
  };

  return (
    <div className="space-y-4">
      {approachPlan.needsTranslation && (
        <Badge variant="outline" className="text-xs">NL not generated yet</Badge>
      )}
      {content.steps && content.steps.length > 0 ? (
        content.steps.map((step, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {step.number || index + 1}
                </div>
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{step.description}</p>
              
              {step.checks && step.checks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">✓ Checks:</p>
                  <ul className="text-sm space-y-1">
                    {step.checks.map((check, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3 w-3 text-success mt-1 shrink-0" />
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step.pitfalls && step.pitfalls.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">⚠ Pitfalls:</p>
                  <ul className="text-sm space-y-1">
                    {step.pitfalls.map((pitfall, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 text-warning mt-1 shrink-0" />
                        {pitfall}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="bg-muted/50">
          <CardContent className="py-8 text-center text-muted-foreground">
            No steps available
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChecklistContent({ checklist, labId }: { 
  checklist: ReturnType<typeof useLabAssets>['checklist'];
  labId: string;
}) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  if (!checklist) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2" />
          No checklist generated yet
        </CardContent>
      </Card>
    );
  }

  const content = checklist.displayContent as { 
    items?: Array<{ text: string; required?: boolean }> 
  };

  const toggleItem = (index: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const completedCount = checkedItems.size;
  const totalCount = content.items?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Deliverables Checklist</CardTitle>
          <Badge variant={completedCount === totalCount ? 'default' : 'secondary'}>
            {completedCount}/{totalCount}
          </Badge>
        </div>
        {checklist.needsTranslation && (
          <Badge variant="outline" className="text-xs w-fit">NL not generated yet</Badge>
        )}
      </CardHeader>
      <CardContent>
        {content.items && content.items.length > 0 ? (
          <ul className="space-y-3">
            {content.items.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <Checkbox
                  checked={checkedItems.has(index)}
                  onCheckedChange={() => toggleItem(index)}
                />
                <div className="flex-1">
                  <span className={checkedItems.has(index) ? 'line-through text-muted-foreground' : ''}>
                    {item.text}
                  </span>
                  {item.required && (
                    <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No deliverables found in document</p>
        )}
      </CardContent>
    </Card>
  );
}

function SectionsContent({ sections }: { sections: Array<{ id: string; section_type: string; displayTitle: string | null; displayContent: string | null }> }) {
  const typeLabels: Record<string, string> = {
    description: 'Description',
    requirements: 'Requirements',
    tasks: 'Tasks',
    deliverables: 'Deliverables',
    evaluation: 'Evaluation Criteria',
    other: 'Other',
  };

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="outline">{typeLabels[section.section_type] || section.section_type}</Badge>
              {section.displayTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{section.displayContent}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
