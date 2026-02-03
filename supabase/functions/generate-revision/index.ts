import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AssetType = "summary" | "flashcards" | "quiz" | "keywords";

const PROMPTS: Record<AssetType, string> = {
  summary: `You are an expert educational content summarizer.
Create a comprehensive summary of the given topic content.

IMPORTANT RULES:
1. ONLY use information present in the provided content
2. If information is incomplete, say "Not found in material" for that section
3. Never invent facts or add information not in the source

Output a JSON object:
{
  "mainPoints": ["Key point 1", "Key point 2", ...],
  "detailedExplanation": "A 2-3 paragraph detailed explanation",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", ...]
}`,

  flashcards: `You are an expert educational flashcard creator.
Create flashcards based ONLY on the given content.

IMPORTANT RULES:
1. Every flashcard must be directly derived from the provided content
2. Never invent facts or questions not supported by the source
3. Create 5-10 high-quality flashcards

Output a JSON object:
{
  "cards": [
    {
      "question": "Question text",
      "answer": "Answer text",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}`,

  quiz: `You are an expert educational quiz creator.
Create a quiz based ONLY on the given content.

IMPORTANT RULES:
1. All questions must be answerable from the provided content
2. Never invent questions about topics not covered
3. Create 5-8 questions mixing MCQ and open-ended

Output a JSON object:
{
  "questions": [
    {
      "type": "mcq" | "open",
      "question": "Question text",
      "options": ["A", "B", "C", "D"] | null,
      "correctAnswer": "The correct answer",
      "explanation": "Why this is correct"
    }
  ]
}`,

  keywords: `You are an expert at extracting key terms and definitions.
Extract key terms and their definitions from the given content.

IMPORTANT RULES:
1. Only extract terms that are actually defined or explained in the content
2. If a term's definition is unclear, mark it as "Definition not fully provided in material"
3. Extract 5-15 key terms

Output a JSON object:
{
  "terms": [
    {
      "term": "Term name",
      "definition": "Definition from the material",
      "importance": "high" | "medium" | "low"
    }
  ]
}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    // Verify JWT and get user
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = user.id;

    const { topicId, assetType, topicContent, topicTitle } = await req.json();

    if (!topicId || !assetType || !topicContent) {
      return new Response(
        JSON.stringify({ error: "topicId, assetType, and topicContent are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["summary", "flashcards", "quiz", "keywords"].includes(assetType)) {
      return new Response(
        JSON.stringify({ error: "Invalid assetType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user owns this topic through the course chain
    const { data: topic, error: topicError } = await supabase
      .from("document_topics")
      .select(`
        id,
        chapter_id,
        document_chapters(
          theory_topic_id,
          theory_topics(
            course_id,
            courses(user_id)
          )
        )
      `)
      .eq("id", topicId)
      .single();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({ error: "Topic not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract user_id from nested structure
    const chapters = topic.document_chapters as unknown as {
      theory_topics: { courses: { user_id: string } | null } | null
    } | null;
    const ownerUserId = chapters?.theory_topics?.courses?.user_id;
    
    if (!ownerUserId || ownerUserId !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as generating
    await supabase
      .from("revision_assets")
      .upsert({
        topic_id: topicId,
        asset_type: assetType,
        is_generating: true,
        content: {},
      }, { onConflict: "topic_id,asset_type" });

    // Generate content with AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: PROMPTS[assetType as AssetType] },
          {
            role: "user",
            content: `Generate ${assetType} for this topic "${topicTitle || 'Untitled'}":\n\n${topicContent}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        await supabase
          .from("revision_assets")
          .update({ is_generating: false })
          .eq("topic_id", topicId)
          .eq("asset_type", assetType);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        await supabase
          .from("revision_assets")
          .update({ is_generating: false })
          .eq("topic_id", topicId)
          .eq("asset_type", assetType);
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      throw new Error(`AI gateway error: ${errorText}`);
    }

    const aiResult = await response.json();
    const generatedContent = JSON.parse(aiResult.choices[0].message.content);

    // Update the revision asset
    const { error: updateError } = await supabase
      .from("revision_assets")
      .update({
        content: generatedContent,
        is_generating: false,
        generated_at: new Date().toISOString(),
      })
      .eq("topic_id", topicId)
      .eq("asset_type", assetType);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, content: generatedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Generate revision error:", error);

    // Try to reset generating status
    try {
      const { topicId, assetType } = await req.clone().json();
      if (topicId && assetType) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("revision_assets")
            .update({ is_generating: false })
            .eq("topic_id", topicId)
            .eq("asset_type", assetType);
        }
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
