import { useState, useRef } from 'react';
import { useLabs, useLabMutations } from '@/hooks/useLabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Upload,
  FileText,
  Loader2,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { LabDetailPanel } from './LabDetailPanel';

interface LabsTabProps {
  courseId: string;
}

export function LabsTab({ courseId }: LabsTabProps) {
  const { labs, isLoading, refetch } = useLabs(courseId);
  const { createLab, updateLab, deleteLab, parseLab } = useLabMutations();
  const { language } = useLanguage();
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingLab, setEditingLab] = useState<typeof labs[0] | null>(null);
  const [newLabTitle, setNewLabTitle] = useState('');
  const [newLabWeek, setNewLabWeek] = useState<number | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEditLab = (lab: typeof labs[0]) => {
    setEditingLab(lab);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingLab) return;
    try {
      await updateLab.mutateAsync({
        id: editingLab.id,
        title: editingLab.title,
        week_number: editingLab.week_number,
        deadline: editingLab.deadline,
      });
      setShowEditDialog(false);
      setEditingLab(null);
      toast.success('Lab updated');
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const handleDeleteLab = async (labId: string) => {
    if (selectedLabId === labId) {
      setSelectedLabId(null);
    }
    deleteLab.mutate(labId);
  };

  const filteredLabs = labs.filter(lab =>
    lab.displayTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `labs/${courseId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create lab document
      const lab = await createLab.mutateAsync({
        courseId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        filePath,
        weekNumber: newLabWeek,
      });

      // Parse the lab document
      const fileContent = await file.text();
      await parseLab.mutateAsync({
        labId: lab.id,
        filePath,
        fileContent,
      });

      setShowAddDialog(false);
      setNewLabTitle('');
      setNewLabWeek(undefined);
      refetch();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload lab document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreateManual = async () => {
    if (!newLabTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      await createLab.mutateAsync({
        courseId,
        title: newLabTitle,
        weekNumber: newLabWeek,
      });
      setShowAddDialog(false);
      setNewLabTitle('');
      setNewLabWeek(undefined);
    } catch (error) {
      console.error('Create error:', error);
    }
  };

  const getStatusBadge = (status: string, parsingStatus: string | null) => {
    if (parsingStatus === 'parsing') {
      return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Analyzing</Badge>;
    }
    if (parsingStatus === 'error') {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
    }
    
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-warning text-warning-foreground gap-1"><Clock className="h-3 w-3" /> In Progress</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Lab List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search labs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowAddDialog(true)} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {filteredLabs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">No labs yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a lab document to get started
              </p>
              <Button onClick={() => setShowAddDialog(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Lab
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredLabs.map((lab) => (
              <Card
                key={lab.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedLabId === lab.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedLabId(lab.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{lab.displayTitle}</h4>
                      {lab.week_number && (
                        <p className="text-xs text-muted-foreground">Week {lab.week_number}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(lab.status, lab.parsing_status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditLab(lab); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleDeleteLab(lab.id); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {lab.deadline && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(lab.deadline).toLocaleDateString()}
                    </div>
                  )}
                  {lab.parsing_status === 'completed' && (
                    <div className="flex items-center gap-1 text-xs text-primary mt-2">
                      <Sparkles className="h-3 w-3" />
                      AI materials available
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Right: Lab Details */}
      <div className="lg:col-span-2">
        {selectedLabId ? (
          <LabDetailPanel 
            labId={selectedLabId} 
            onClose={() => setSelectedLabId(null)}
          />
        ) : (
          <Card className="h-full min-h-[400px]">
            <CardContent className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Lab</h3>
              <p className="text-muted-foreground">
                Choose a lab from the list to view details and generated materials
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Lab Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Lab Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Upload Document (PDF, DOCX, PPTX)</Label>
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx,.doc,.ppt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <span>Uploading & Analyzing...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-8 w-8 mb-2" />
                      <span>Click to upload</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or add manually</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="labTitle">Lab Title</Label>
                <Input
                  id="labTitle"
                  value={newLabTitle}
                  onChange={(e) => setNewLabTitle(e.target.value)}
                  placeholder="e.g., Lab 1: Introduction to React"
                />
              </div>
              <div>
                <Label htmlFor="labWeek">Week Number (optional)</Label>
                <Input
                  id="labWeek"
                  type="number"
                  value={newLabWeek || ''}
                  onChange={(e) => setNewLabWeek(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="e.g., 1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateManual} disabled={!newLabTitle.trim()}>
              Create Lab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lab Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lab</DialogTitle>
          </DialogHeader>
          {editingLab && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editLabTitle">Lab Title</Label>
                <Input
                  id="editLabTitle"
                  value={editingLab.title}
                  onChange={(e) => setEditingLab({ ...editingLab, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editLabWeek">Week Number</Label>
                <Input
                  id="editLabWeek"
                  type="number"
                  value={editingLab.week_number || ''}
                  onChange={(e) => setEditingLab({ ...editingLab, week_number: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label htmlFor="editLabDeadline">Deadline</Label>
                <Input
                  id="editLabDeadline"
                  type="date"
                  value={editingLab.deadline ? new Date(editingLab.deadline).toISOString().split('T')[0] : ''}
                  onChange={(e) => setEditingLab({ ...editingLab, deadline: e.target.value || null })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
