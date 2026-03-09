import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-study-assistant`;

export function useStudyAssistant() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>('');

  const sendRequest = useCallback(async (
    messages: Array<{ role: string; content: string }>,
    courseName?: string,
    context?: string,
  ) => {
    setIsLoading(true);
    setResponse('');

    try {
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages,
          courseName: courseName ?? "het vak",
          context,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        if (resp.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (resp.status === 402) {
          toast.error("AI credits exhausted.");
        } else {
          toast.error(errorData.error || "Failed to get AI response");
        }
        setIsLoading(false);
        return;
      }

      const data = await resp.json();
      const reply = data.reply || "";
      setResponse(reply);
      setIsLoading(false);
      return reply;

    } catch (error) {
      console.error("Study assistant error:", error);
      toast.error("Failed to connect to AI assistant");
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResponse('');
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    response,
    sendRequest,
    reset,
  };
}
