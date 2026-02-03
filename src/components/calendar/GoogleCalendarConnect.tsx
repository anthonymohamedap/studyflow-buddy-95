import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Link2, Link2Off, Loader2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface GoogleCalendarConnectProps {
  variant?: 'card' | 'inline';
}

export function GoogleCalendarConnect({ variant = 'inline' }: GoogleCalendarConnectProps) {
  const {
    isConnected,
    isCheckingConnection,
    lastSyncedAt,
    isConnecting,
    connect,
    disconnect,
  } = useGoogleCalendar();

  if (isCheckingConnection) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = isConnected ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Google Calendar</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
        </div>
        <Badge variant="default">Connected</Badge>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Last synced</span>
        <span className="flex items-center gap-2">
          <RefreshCw className="h-3 w-3" />
          {lastSyncedAt
            ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
            : 'Never'}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Calendar className="h-4 w-4 flex-shrink-0" />
        <span>
          All your study events sync to Google Calendar.
        </span>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Link2Off className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to your Google Calendar. Your events in Google Calendar will remain, but new changes won't sync.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnect.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ) : (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">Google Calendar</p>
          <p className="text-xs text-muted-foreground">Not connected</p>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
        <p className="mb-2">Connecting Google Calendar will:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Sync all your study deadlines</li>
          <li>Manage events from any device</li>
          <li>Get reminders via Google Calendar</li>
        </ul>
      </div>

      <Button 
        onClick={connect} 
        className="w-full"
        disabled={isConnecting}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Link2 className="h-4 w-4 mr-2" />
        )}
        Connect Google Calendar
      </Button>
    </div>
  );

  if (variant === 'card') {
    return (
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Google Calendar</CardTitle>
          <CardDescription>
            Sync your study schedule with Google Calendar
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return <div className="p-4">{content}</div>;
}
