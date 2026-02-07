import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TranslateRequest {
  type: "chapter" | "topic" | "revision_asset" | "lab" | "lab_asset";
  id: string;
}

interface BulkTranslateRequest {
  type: "course" | "document" | "lab_course";
  id: string;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { type, id, bulk } = body;

    if (bulk) {
      return await handleBulkTranslation(supabase, openaiApiKey, body as BulkTranslateRequest);
    }

    return await handleSingleTranslation(supabase, openaiApiKey, { type, id } as TranslateRequest);
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function translateText(openaiApiKey: string, text: string, context: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in academic content. Translate the following ${context} from English to Dutch.

CRITICAL RULES:
1. Translate ONLY the provided text - do not add, remove, or modify any information
2. Maintain the exact same structure and formatting
3. Keep technical terms that are commonly used in English in academic contexts
4. If the text is already in Dutch, return it as-is
5. Preserve any markdown formatting, bullet points, or special characters
6. Return ONLY the translated text, no explanations or notes`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Translation API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || text;
}

async function translateJSON(openaiApiKey: string, content: Record<string, unknown>, assetType: string): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator for academic content. Translate the following ${assetType} JSON content from English to Dutch.

CRITICAL RULES:
1. Translate ONLY text values - keep all JSON keys unchanged
2. Do not add, remove, or modify any information
3. Maintain the exact same JSON structure
4. Keep technical terms that are commonly used in English in academic contexts
5. Return ONLY valid JSON, no explanations
6. For flashcards: translate both questions and answers
7. For quizzes: translate questions, options, correctAnswer, and explanation
8. For summaries: translate mainPoints, detailedExplanation, and keyTakeaways
9. For keywords: translate term and definition`,
        },
        {
          role: "user",
          content: JSON.stringify(content, null, 2),
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Translation API error: ${error}`);
  }

  const data = await response.json();
  const translatedText = data.choices[0]?.message?.content || "";
  
  const jsonMatch = translatedText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, translatedText];
  const jsonStr = jsonMatch[1] || translatedText;
  
  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    console.error("Failed to parse translated JSON:", jsonStr);
    return content;
  }
}

async function handleSingleTranslation(
  supabase: SupabaseClient,
  openaiApiKey: string,
  request: TranslateRequest
): Promise<Response> {
  const { type, id } = request;

  if (type === "chapter") {
    const { data: chapter, error } = await supabase
      .from("document_chapters")
      .select("id, title, content")
      .eq("id", id)
      .single();

    if (error || !chapter) {
      return new Response(
        JSON.stringify({ error: "Chapter not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("document_chapters")
      .update({ translation_status: "translating" })
      .eq("id", id);

    try {
      const titleNl = await translateText(openaiApiKey, chapter.title, "chapter title");
      const contentNl = chapter.content 
        ? await translateText(openaiApiKey, chapter.content, "chapter content")
        : null;

      await supabase
        .from("document_chapters")
        .update({
          title_nl: titleNl,
          content_nl: contentNl,
          translation_status: "completed",
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true, title_nl: titleNl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      await supabase
        .from("document_chapters")
        .update({ translation_status: "failed" })
        .eq("id", id);
      throw error;
    }
  }

  if (type === "topic") {
    const { data: topic, error } = await supabase
      .from("document_topics")
      .select("id, title, content")
      .eq("id", id)
      .single();

    if (error || !topic) {
      return new Response(
        JSON.stringify({ error: "Topic not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("document_topics")
      .update({ translation_status: "translating" })
      .eq("id", id);

    try {
      const titleNl = await translateText(openaiApiKey, topic.title, "topic title");
      const contentNl = topic.content 
        ? await translateText(openaiApiKey, topic.content, "topic content")
        : null;

      await supabase
        .from("document_topics")
        .update({
          title_nl: titleNl,
          content_nl: contentNl,
          translation_status: "completed",
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true, title_nl: titleNl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      await supabase
        .from("document_topics")
        .update({ translation_status: "failed" })
        .eq("id", id);
      throw error;
    }
  }

  if (type === "revision_asset") {
    const { data: asset, error } = await supabase
      .from("revision_assets")
      .select("id, content, asset_type")
      .eq("id", id)
      .single();

    if (error || !asset) {
      return new Response(
        JSON.stringify({ error: "Revision asset not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("revision_assets")
      .update({ translation_status: "translating" })
      .eq("id", id);

    try {
      const contentNl = await translateJSON(
        openaiApiKey, 
        asset.content as Record<string, unknown>, 
        asset.asset_type
      );

      await supabase
        .from("revision_assets")
        .update({
          content_nl: contentNl,
          translation_status: "completed",
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true, content_nl: contentNl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      await supabase
        .from("revision_assets")
        .update({ translation_status: "failed" })
        .eq("id", id);
      throw error;
    }
  }

  if (type === "lab") {
    const { data: lab, error } = await supabase
      .from("lab_documents")
      .select("id, title, description")
      .eq("id", id)
      .single();

    if (error || !lab) {
      return new Response(
        JSON.stringify({ error: "Lab not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("lab_documents")
      .update({ translation_status: "translating" })
      .eq("id", id);

    try {
      const titleNl = await translateText(openaiApiKey, lab.title, "lab title");
      const descriptionNl = lab.description 
        ? await translateText(openaiApiKey, lab.description, "lab description")
        : null;

      await supabase
        .from("lab_documents")
        .update({
          title_nl: titleNl,
          description_nl: descriptionNl,
          translation_status: "completed",
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true, title_nl: titleNl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      await supabase
        .from("lab_documents")
        .update({ translation_status: "failed" })
        .eq("id", id);
      throw error;
    }
  }

  if (type === "lab_asset") {
    const { data: asset, error } = await supabase
      .from("lab_assets")
      .select("id, content, asset_type")
      .eq("id", id)
      .single();

    if (error || !asset) {
      return new Response(
        JSON.stringify({ error: "Lab asset not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("lab_assets")
      .update({ translation_status: "translating" })
      .eq("id", id);

    try {
      const contentNl = await translateJSON(
        openaiApiKey, 
        asset.content as Record<string, unknown>, 
        asset.asset_type
      );

      await supabase
        .from("lab_assets")
        .update({
          content_nl: contentNl,
          translation_status: "completed",
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({ success: true, content_nl: contentNl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      await supabase
        .from("lab_assets")
        .update({ translation_status: "failed" })
        .eq("id", id);
      throw error;
    }
  }

  return new Response(
    JSON.stringify({ error: "Invalid type" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleBulkTranslation(
  supabase: SupabaseClient,
  openaiApiKey: string,
  request: BulkTranslateRequest
): Promise<Response> {
  const { type, id } = request;

  if (type === "course") {
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", id)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: theoryTopics } = await supabase
      .from("theory_topics")
      .select("id")
      .eq("course_id", id);

    if (!theoryTopics?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No topics to translate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let translatedCount = 0;

    for (const topic of theoryTopics) {
      const { data: chapters } = await supabase
        .from("document_chapters")
        .select("id")
        .eq("theory_topic_id", topic.id)
        .eq("translation_status", "pending");

      for (const chapter of chapters || []) {
        await handleSingleTranslation(supabase, openaiApiKey, { type: "chapter", id: chapter.id });
        translatedCount++;

        const { data: docTopics } = await supabase
          .from("document_topics")
          .select("id")
          .eq("chapter_id", chapter.id)
          .eq("translation_status", "pending");

        for (const docTopic of docTopics || []) {
          await handleSingleTranslation(supabase, openaiApiKey, { type: "topic", id: docTopic.id });
          translatedCount++;

          const { data: assets } = await supabase
            .from("revision_assets")
            .select("id")
            .eq("topic_id", docTopic.id)
            .eq("translation_status", "pending");

          for (const asset of assets || []) {
            await handleSingleTranslation(supabase, openaiApiKey, { type: "revision_asset", id: asset.id });
            translatedCount++;
          }
        }
      }
    }

    // Also translate labs
    const { data: labs } = await supabase
      .from("lab_documents")
      .select("id")
      .eq("course_id", id)
      .eq("translation_status", "pending");

    for (const lab of labs || []) {
      await handleSingleTranslation(supabase, openaiApiKey, { type: "lab", id: lab.id });
      translatedCount++;

      const { data: labAssets } = await supabase
        .from("lab_assets")
        .select("id")
        .eq("lab_id", lab.id)
        .eq("translation_status", "pending");

      for (const asset of labAssets || []) {
        await handleSingleTranslation(supabase, openaiApiKey, { type: "lab_asset", id: asset.id });
        translatedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, translatedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Invalid bulk type" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
