import { useState, useCallback } from 'react';
import { toast } from 'sonner';

type AIPolicy = "ALLOWED" | "LIMITED" | "FORBIDDEN";
type FeatureType = "explain" | "exam-trainer";
type ExplainMode = "simple" | "with-code" | "with-analogy";
type QuestionType = "exam-style" | "open" | "multiple-choice";
type FeedbackMode = "no-hints" | "with-feedback";

interface StudyAssistantRequest {
  feature: FeatureType;
  aiPolicy: AIPolicy;
  content: string;
  contentType: "theory" | "lab";
  topicTitle?: string;
  courseContext?: string;
  explainMode?: ExplainMode;
  questionType?: QuestionType;
  feedbackMode?: FeedbackMode;
  studentAnswer?: string;
  previousQuestion?: string;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-study-assistant`;

export function useStudyAssistant() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>('');

  const streamRequest = useCallback(async (request: StudyAssistantRequest) => {
    setIsLoading(true);
    setResponse('');

    try {
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(request),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        if (resp.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (resp.status === 402) {
          toast.error("AI credits exhausted. Please add funds to continue.");
        } else {
          toast.error(errorData.error || "Failed to get AI response");
        }
        setIsLoading(false);
        return;
      }

      if (!resp.body) {
        throw new Error("No response body");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch { /* ignore */ }
        }
      }

      setIsLoading(false);
      return fullResponse;

    } catch (error) {
      console.error("Study assistant error:", error);
      toast.error("Failed to connect to AI assistant");
      setIsLoading(false);
    }
  }, []);

  const explain = useCallback(async (
    content: string,
    contentType: "theory" | "lab",
    aiPolicy: AIPolicy,
    mode: ExplainMode = "simple",
    topicTitle?: string,
    courseContext?: string
  ) => {
    return streamRequest({
      feature: "explain",
      aiPolicy,
      content,
      contentType,
      explainMode: mode,
      topicTitle,
      courseContext,
    });
  }, [streamRequest]);

  const generateQuestion = useCallback(async (
    content: string,
    contentType: "theory" | "lab",
    aiPolicy: AIPolicy,
    questionType: QuestionType = "exam-style",
    feedbackMode: FeedbackMode = "with-feedback",
    topicTitle?: string,
    courseContext?: string
  ) => {
    return streamRequest({
      feature: "exam-trainer",
      aiPolicy,
      content,
      contentType,
      questionType,
      feedbackMode,
      topicTitle,
      courseContext,
    });
  }, [streamRequest]);

  const submitAnswer = useCallback(async (
    content: string,
    contentType: "theory" | "lab",
    aiPolicy: AIPolicy,
    previousQuestion: string,
    studentAnswer: string,
    topicTitle?: string
  ) => {
    return streamRequest({
      feature: "exam-trainer",
      aiPolicy,
      content,
      contentType,
      previousQuestion,
      studentAnswer,
      topicTitle,
    });
  }, [streamRequest]);

  const reset = useCallback(() => {
    setResponse('');
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    response,
    explain,
    generateQuestion,
    submitAnswer,
    reset,
  };
}
