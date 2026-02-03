import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function CalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { exchangeCode } = useGoogleCalendar();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setError(errorParam === 'access_denied' 
        ? 'Access was denied. Please try again.' 
        : errorParam);
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received');
      return;
    }

    exchangeCode.mutate(code, {
      onSuccess: () => {
        setStatus('success');
        // Redirect after short delay
        setTimeout(() => {
          const redirectPath = localStorage.getItem('google_calendar_redirect') || '/';
          localStorage.removeItem('google_calendar_redirect');
          navigate(redirectPath);
        }, 1500);
      },
      onError: (err: Error) => {
        setStatus('error');
        setError(err.message);
      },
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connecting Google Calendar</h2>
              <p className="text-muted-foreground">Please wait while we complete the connection...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connected Successfully!</h2>
              <p className="text-muted-foreground">Redirecting you back to the app...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="text-primary hover:underline"
              >
                Return to Dashboard
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
