import { Sun, Moon, Contrast } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const themes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'high-contrast', label: 'High Contrast', icon: Contrast },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  const currentTheme = themes.find(t => t.value === theme);
  const Icon = currentTheme?.icon || Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Icon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map(({ value, label, icon: ItemIcon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "gap-2",
              theme === value && "bg-accent"
            )}
          >
            <ItemIcon className="h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
