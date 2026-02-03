import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export function LanguageToggle() {
  const { language, setLanguage, isLoading } = useLanguage();

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Globe className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="uppercase font-medium">{language}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={cn(language === 'en' && 'bg-accent')}
        >
          <span className="mr-2">🇬🇧</span>
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLanguage('nl')}
          className={cn(language === 'nl' && 'bg-accent')}
        >
          <span className="mr-2">🇳🇱</span>
          Nederlands
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
