import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  // For explain feature
  explainMode?: ExplainMode;
  // For exam trainer
  questionType?: QuestionType;
  feedbackMode?: FeedbackMode;
  studentAnswer?: string;
  previousQuestion?: string;
}

function getExplainSystemPrompt(aiPolicy: AIPolicy, explainMode: ExplainMode, contentType: string): string {
  // Strict document-grounding base prompt (zero hallucination tolerance)
  const groundingRules = `You are an AI assistant operating in DOCUMENT-LOCKED MODE.

🔒 MANDATORY CONSTRAINTS:
- Your knowledge is LIMITED STRICTLY to the provided document content below.
- External knowledge, training data, and world knowledge are DISABLED.
- Use ONLY information explicitly present in the uploaded documents.
- Do NOT use prior knowledge, assumptions, general knowledge, or external sources.
- If a concept, definition, or detail is not clearly stated in the documents, respond with: "Not found in the provided documents."
- Do not infer, extrapolate, or fill gaps.
- Keep explanations concise and factual.

✅ ALLOWED ACTIONS:
- Extract information from the document
- Summarize using the document's wording
- Quote or reference exact sections
- Explain concepts ONLY as described in the document

❌ DISALLOWED ACTIONS:
- Explaining beyond what the document states
- Giving examples not present in the text
- Combining ideas unless the document does so explicitly
- Adding meaning through rephrasing

🧠 SELF-VALIDATION: Before finalizing your answer, verify that EVERY sentence can be directly traced to the provided documents. If not, remove it.`;

  const responseFormat = `
RESPONSE FORMAT:
## Simple Explanation
[Explanation using ONLY document content - simple language, short sentences, no unexplained jargon]
${explainMode === 'with-code' ? `
## Code Intuition
[Minimal illustrative snippet ONLY if code is present in the document - NOT a full solution]` : ''}
${explainMode === 'with-analogy' ? `
## Analogy
[Real-world analogy ONLY if one can be derived from document context]` : ''}

## One-Sentence Recap
[Single sentence summary from the document]

## Source Reference
[Quote or reference the exact section/topic this information comes from]`;

  if (aiPolicy === "FORBIDDEN") {
    return `${groundingRules}

You are explaining ${contentType} content.
${responseFormat}

🚫 ADDITIONAL RESTRICTIONS (AI Policy: FORBIDDEN):
- Provide conceptual intuition ONLY
- DO NOT provide any code solutions, even partial ones
- Focus on helping the student think about the problem
- Encourage independent reasoning
- Guide them to discover the answer themselves`;
  }

  if (aiPolicy === "LIMITED") {
    return `${groundingRules}

You are explaining ${contentType} content.
${responseFormat}

⚠️ ADDITIONAL RESTRICTIONS (AI Policy: LIMITED):
- Explanations and reasoning guidance are allowed
- DO NOT provide full solutions
- For code examples: show only minimal illustrative snippets from the document, never exam-ready solutions
- Help the student understand concepts without giving away answers`;
  }

  return `${groundingRules}

You are explaining ${contentType} content.
${responseFormat}

AI Policy: ALLOWED - Full assistance is permitted while maintaining strict document grounding.`;
}

function getExamTrainerSystemPrompt(
  aiPolicy: AIPolicy, 
  questionType: QuestionType, 
  feedbackMode: FeedbackMode,
  isAnswering: boolean
): string {
  // Strict document-grounding base prompt (zero hallucination tolerance)
  const groundingRules = `You are an AI Exam Trainer operating in DOCUMENT-LOCKED MODE.

🔒 MANDATORY CONSTRAINTS:
- Your knowledge is LIMITED STRICTLY to the provided document content.
- External knowledge, training data, and world knowledge are DISABLED.
- Generate questions and feedback ONLY from information explicitly present in the documents.
- If a concept or detail is not clearly stated in the documents, DO NOT test it.
- Do not infer, extrapolate, or fill gaps.

✅ ALLOWED ACTIONS:
- Extract testable concepts from the document
- Generate questions based on document content
- Quote or reference exact sections
- Provide feedback grounded in document text

❌ DISALLOWED ACTIONS:
- Creating questions about topics not in the document
- Adding knowledge beyond what the document states
- Giving examples not present in the text
- Assuming or inventing requirements

🧠 SELF-VALIDATION: Before finalizing, verify that EVERY question/answer can be directly traced to the provided documents.`;

  const questionContext = `Generate questions that reflect real exams by testing understanding of:
- Why something works (as explained in the document)
- When to use it (based on document context)
- What would break if used incorrectly (per document examples)

Question types to generate:
- "Based on this material, explain why concept X is required"
- "Which change would cause this solution to fail?"
- "Predict the output or behavior of a modified version"`;

  if (isAnswering) {
    // Student is answering a question
    if (aiPolicy === "FORBIDDEN") {
      return `${groundingRules}

🚫 ADDITIONAL RESTRICTIONS (AI Policy: FORBIDDEN):
- DO NOT confirm if the answer is correct or incorrect
- Instead, ask guiding questions to help them think
- Focus on exam thinking strategy
- Never reveal the answer

RESPONSE FORMAT:
## Guiding Questions
[Ask questions that help them reason through their answer - based on document content]

## Thinking Strategy
[Tips for approaching this type of question in exams]

## Source Reference
[Which section of the document this relates to]`;
    }

    if (aiPolicy === "LIMITED") {
      return `${groundingRules}

⚠️ ADDITIONAL RESTRICTIONS (AI Policy: LIMITED):
- Guide reasoning step-by-step
- DO NOT reveal the full answer immediately
- Help them discover mistakes through questions

RESPONSE FORMAT:
## Feedback
[Indicate direction without giving away the answer]

## Reasoning Guide
[Step-by-step questions to help them think through it - grounded in document]

## Related Concept
[Link to the relevant theory/lab topic from the document]

## Source Reference
[Quote the relevant section]`;
    }

    return `${groundingRules}

AI Policy: ALLOWED - Provide full feedback while maintaining strict document grounding.

RESPONSE FORMAT:
## Feedback
[Correct/Incorrect with clear explanation from the document]

## Why This Answer
[Detailed explanation referencing specific document content]

## Common Mistakes
[What students often get wrong on this topic - based on document complexity]

## Related Concept
[Link to relevant theory/lab topic]

## Source Reference
[Quote the exact section this answer is based on]`;
  }

  // Generating a new question
  const questionFormat = questionType === "multiple-choice" 
    ? `## Question
[Your question here - MUST be answerable from the document]

## Options
A) [Option A - from document content]
B) [Option B - from document content]
C) [Option C - from document content]
D) [Option D - from document content]`
    : `## Question
[Your ${questionType === 'exam-style' ? 'exam-style' : 'open'} question here - MUST be answerable from the document]`;

  return `${groundingRules}

${questionContext}

Generate a ${questionType} question based on the provided content.
${feedbackMode === 'no-hints' ? 'Do not provide any hints.' : 'The student will receive feedback after answering.'}

RESPONSE FORMAT:
${questionFormat}

## Difficulty
[Easy/Medium/Hard]

## Topic Focus
[What concept this tests - must be from the document]

## Source Reference
[Quote or reference the exact section this question is based on]`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (request.feature === "explain") {
      const mode = request.explainMode || "simple";
      systemPrompt = getExplainSystemPrompt(request.aiPolicy, mode, request.contentType);
      
      userPrompt = `Please explain the following ${request.contentType} content${request.topicTitle ? ` from "${request.topicTitle}"` : ''}:

---
${request.content}
---

${request.courseContext ? `Course context: ${request.courseContext}` : ''}`;

    } else if (request.feature === "exam-trainer") {
      const questionType = request.questionType || "exam-style";
      const feedbackMode = request.feedbackMode || "with-feedback";
      const isAnswering = !!request.studentAnswer && !!request.previousQuestion;

      systemPrompt = getExamTrainerSystemPrompt(
        request.aiPolicy, 
        questionType, 
        feedbackMode,
        isAnswering
      );

      if (isAnswering) {
        userPrompt = `The student was asked:
${request.previousQuestion}

Their answer:
${request.studentAnswer}

Based on this content:
---
${request.content}
---

Provide feedback according to the AI policy.`;
      } else {
        userPrompt = `Generate a ${questionType} question based on this ${request.contentType} content${request.topicTitle ? ` from "${request.topicTitle}"` : ''}:

---
${request.content}
---

${request.courseContext ? `Course context: ${request.courseContext}` : ''}`;
      }
    } else {
      throw new Error("Unknown feature type");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Study assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
