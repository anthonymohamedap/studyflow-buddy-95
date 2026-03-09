import { useState, useCallback } from 'react';
import { toast } from 'sonner';

type AIPolicy = "ALLOWED" | "LIMITED" | "FORBIDDEN";
type ExplainMode = "simple" | "with-code" | "with-analogy";
type QuestionType = "exam-style" | "open" | "multiple-choice";
type FeedbackMode = "no-hints" | "with-feedback";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-study-assistant`;

function buildExplainMessage(
  content: string,
  contentType: "theory" | "lab",
  aiPolicy: AIPolicy,
  mode: ExplainMode,
  topicTitle?: string,
): string {
  const policyNote = aiPolicy === "FORBIDDEN"
    ? "Geef alleen conceptuele uitleg, geen code of directe antwoorden."
    : aiPolicy === "LIMITED"
    ? "Geef uitleg maar geen volledige oplossingen."
    : "";

  const modeNote = mode === "with-code"
    ? "Voeg minimale code snippets toe ter illustratie."
    : mode === "with-analogy"
    ? "Gebruik een real-world analogie om het concept uit te leggen."
    : "Leg het uit in eenvoudige termen.";

  return `Leg het volgende ${contentType} materiaal uit${topicTitle ? ` over "${topicTitle}"` : ''}.\n\n${policyNote}\n${modeNote}\n\n---\n${content}\n---`;
}

function buildQuestionMessage(
  content: string,
  contentType: "theory" | "lab",
  questionType: QuestionType,
  topicTitle?: string,
): string {
  return `Genereer een ${questionType} vraag gebaseerd op dit ${contentType} materiaal${topicTitle ? ` over "${topicTitle}"` : ''}:\n\n---\n${content}\n---`;
}

function buildAnswerMessage(
  previousQuestion: string,
  studentAnswer: string,
): string {
  return `De student kreeg deze vraag:\n${previousQuestion}\n\nHun antwoord:\n${studentAnswer}\n\nGeef feedback.`;
}

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
          toast.error("AI credits exhausted. Please add funds to continue.");
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

  const explain = useCallback(async (
    content: string,
    contentType: "theory" | "lab",
    aiPolicy: AIPolicy,
    mode: ExplainMode = "simple",
    topicTitle?: string,
    courseContext?: string
  ) => {
    const userMessage = buildExplainMessage(content, contentType, aiPolicy, mode, topicTitle);
    return sendRequest(
      [{ role: "user", content: userMessage }],
      courseContext,
      content.slice(0, 6000),
    );
  }, [sendRequest]);

  const generateQuestion = useCallback(async (
    content: string,
    contentType: "theory" | "lab",
    aiPolicy: AIPolicy,
    questionType: QuestionType = "exam-style",
    feedbackMode: FeedbackMode = "with-feedback",
    topicTitle?: string,
    courseContext?: string
  ) => {
    const userMessage = buildQuestionMessage(content, contentType, questionType, topicTitle);
    return sendRequest(
      [{ role: "user", content: userMessage }],
      courseContext,
      content.slice(0, 6000),
    );
  }, [sendRequest]);

  const submitAnswer = useCallback(async (
    content: string,
    contentType: "theory" | "lab",
    aiPolicy: AIPolicy,
    previousQuestion: string,
    studentAnswer: string,
    topicTitle?: string
  ) => {
    const userMessage = buildAnswerMessage(previousQuestion, studentAnswer);
    return sendRequest(
      [{ role: "user", content: userMessage }],
      undefined,
      content.slice(0, 6000),
    );
  }, [sendRequest]);

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
