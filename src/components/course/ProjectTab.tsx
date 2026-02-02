import { useState } from 'react';
import { useProject, useTodoItems } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Plus, 
  FolderKanban,
  Calendar,
  Users,
  FileText,
  CheckSquare,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

interface ProjectTabProps {
  courseId: string;
}

const STATUS_CONFIG = {
  NOT_STARTED: { label: 'Not Started', className: 'bg-muted text-muted-foreground' },
  PLANNING: { label: 'Planning', className: 'bg-info/20 text-info' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-warning/20 text-warning' },
  REVIEW: { label: 'In Review', className: 'bg-primary/20 text-primary' },
  SUBMITTED: { label: 'Submitted', className: 'bg-success/20 text-success' },
};

export function ProjectTab({ courseId }: ProjectTabProps) {
  const { project, isLoading, createProject, updateProject } = useProject(courseId);
  const { todos, createTodo, updateTodo, deleteTodo } = useTodoItems(project?.id);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    deadline: '',
    documentation_requirements: '',
    group_size: 1,
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProject.mutateAsync({
      course_id: courseId,
      ...newProject,
      deadline: newProject.deadline ? new Date(newProject.deadline).toISOString() : null,
    });
    setShowCreateDialog(false);
    setNewProject({
      title: '',
      description: '',
      deadline: '',
      documentation_requirements: '',
      group_size: 1,
    });
  };

  const handleStatusChange = async (newStatus: 'NOT_STARTED' | 'PLANNING' | 'IN_PROGRESS' | 'REVIEW' | 'SUBMITTED') => {
    if (project) {
      await updateProject.mutateAsync({ id: project.id, status: newStatus });
    }
  };

  const handleAddTodo = async () => {
    if (newTodo.trim() && project) {
      await createTodo.mutateAsync({
        project_id: project.id,
        description: newTodo.trim(),
      });
      setNewTodo('');
    }
  };

  const completedTodos = todos.filter(t => t.completed).length;
  const todoProgress = todos.length > 0 ? (completedTodos / todos.length) * 100 : 0;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!project) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No project yet</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Add a project if this course has one
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </CardContent>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <form onSubmit={handleCreateProject}>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    placeholder="e.g., Architecture Project"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="What is this project about?"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={newProject.deadline}
                      onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group_size">Group Size</Label>
                    <Input
                      id="group_size"
                      type="number"
                      min={1}
                      max={10}
                      value={newProject.group_size}
                      onChange={(e) => setNewProject({ ...newProject, group_size: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="docs">Documentation Requirements</Label>
                  <Textarea
                    id="docs"
                    value={newProject.documentation_requirements}
                    onChange={(e) => setNewProject({ ...newProject, documentation_requirements: e.target.value })}
                    placeholder="What documentation is required?"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProject.isPending}>
                  Create Project
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  const status = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOT_STARTED;

  return (
    <div className="space-y-6">
      {/* Project Info */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{project.title}</CardTitle>
              <div className="flex items-center gap-3 mt-2">
                <Badge className={status.className}>{status.label}</Badge>
                {project.group_size && project.group_size > 1 && (
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {project.group_size} members
                  </Badge>
                )}
                {project.deadline && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(project.deadline), 'MMM d, yyyy')}
                  </Badge>
                )}
              </div>
            </div>
            <Select 
              value={project.status} 
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                <SelectItem value="PLANNING">Planning</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="REVIEW">In Review</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
          {project.documentation_requirements && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <FileText className="h-4 w-4" />
                Documentation Requirements
              </div>
              <p className="text-sm text-muted-foreground">{project.documentation_requirements}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TODO List */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              TODO List
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {completedTodos} / {todos.length} done
            </span>
          </div>
          {todos.length > 0 && (
            <Progress value={todoProgress} className="h-2" />
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add TODO */}
          <div className="flex gap-2">
            <Input
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Add a new task..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTodo();
                }
              }}
            />
            <Button onClick={handleAddTodo} disabled={!newTodo.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* TODO Items */}
          <div className="space-y-2">
            {todos.map((todo) => (
              <div 
                key={todo.id} 
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  todo.completed ? 'bg-muted/50' : 'bg-card'
                }`}
              >
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={(checked) => 
                    updateTodo.mutate({ id: todo.id, completed: checked as boolean })
                  }
                />
                <span className={`flex-1 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {todo.description}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTodo.mutate(todo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {todos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks yet. Add your first TODO above!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
