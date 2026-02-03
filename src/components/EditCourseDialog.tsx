import { useState, useEffect } from 'react';
import { useCourses } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Course = Database['public']['Tables']['courses']['Row'];

interface EditCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
}

export function EditCourseDialog({ open, onOpenChange, course }: EditCourseDialogProps) {
  const { updateCourse } = useCourses();
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    lecturer: '',
    lecturer_email: '',
    credits: 3,
    evaluation_type: 'EXAM' as 'EXAM' | 'PROJECT' | 'PAPER' | 'CONTINUOUS' | 'MIXED',
    ai_policy: 'LIMITED' as 'ALLOWED' | 'LIMITED' | 'FORBIDDEN',
    ai_policy_details: '',
    material_url: '',
  });

  useEffect(() => {
    if (course) {
      setFormData({
        name: course.name || '',
        code: course.code || '',
        lecturer: course.lecturer || '',
        lecturer_email: course.lecturer_email || '',
        credits: course.credits || 3,
        evaluation_type: course.evaluation_type || 'EXAM',
        ai_policy: course.ai_policy || 'LIMITED',
        ai_policy_details: course.ai_policy_details || '',
        material_url: course.material_url || '',
      });
    }
  }, [course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    
    await updateCourse.mutateAsync({ id: course.id, ...formData });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the details for this course
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name *
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="e.g., Datastructures"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-code" className="text-right">
                Code
              </Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="col-span-3"
                placeholder="e.g., DS-101"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-lecturer" className="text-right">
                Lecturer
              </Label>
              <Input
                id="edit-lecturer"
                value={formData.lecturer}
                onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
                className="col-span-3"
                placeholder="e.g., Prof. John Doe"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.lecturer_email}
                onChange={(e) => setFormData({ ...formData, lecturer_email: e.target.value })}
                className="col-span-3"
                placeholder="lecturer@university.edu"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-credits" className="text-right">
                Credits
              </Label>
              <Input
                id="edit-credits"
                type="number"
                min={1}
                max={30}
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 3 })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-evaluation" className="text-right">
                Evaluation
              </Label>
              <Select
                value={formData.evaluation_type}
                onValueChange={(value: typeof formData.evaluation_type) => 
                  setFormData({ ...formData, evaluation_type: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXAM">Exam</SelectItem>
                  <SelectItem value="PROJECT">Project</SelectItem>
                  <SelectItem value="PAPER">Paper</SelectItem>
                  <SelectItem value="CONTINUOUS">Continuous Assessment</SelectItem>
                  <SelectItem value="MIXED">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-ai_policy" className="text-right">
                AI Policy
              </Label>
              <Select
                value={formData.ai_policy}
                onValueChange={(value: typeof formData.ai_policy) => 
                  setFormData({ ...formData, ai_policy: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALLOWED">Allowed</SelectItem>
                  <SelectItem value="LIMITED">Limited</SelectItem>
                  <SelectItem value="FORBIDDEN">Forbidden</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-ai_details" className="text-right pt-2">
                AI Details
              </Label>
              <Textarea
                id="edit-ai_details"
                value={formData.ai_policy_details}
                onChange={(e) => setFormData({ ...formData, ai_policy_details: e.target.value })}
                className="col-span-3"
                placeholder="e.g., AI allowed for labs but forbidden on exams"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-material_url" className="text-right">
                Materials URL
              </Label>
              <Input
                id="edit-material_url"
                type="url"
                value={formData.material_url}
                onChange={(e) => setFormData({ ...formData, material_url: e.target.value })}
                className="col-span-3"
                placeholder="https://digitap.example.com/..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateCourse.isPending}>
              {updateCourse.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
