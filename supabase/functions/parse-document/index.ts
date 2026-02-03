import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const { theoryTopicId, documentContent, documentTitle } = await req.json();
    
    if (!theoryTopicId || !documentContent) {
      return new Response(
        JSON.stringify({ error: "theoryTopicId and documentContent are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify theory topic exists
    const { data: theoryTopic, error: topicError } = await supabase
      .from("theory_topics")
      .select("id, course_id")
      .eq("id", theoryTopicId)
      .single();

    if (topicError || !theoryTopic) {
      return new Response(
        JSON.stringify({ error: "Theory topic not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update parsing status
    await supabase
      .from("theory_topics")
      .update({ parsing_status: "parsing" })
      .eq("id", theoryTopicId);

    // Use AI to extract chapters and topics
    const systemPrompt = `You are a document structure analyzer for educational materials. 
Your task is to analyze the given document content and extract its hierarchical structure.

IMPORTANT RULES:
1. Only extract information that is ACTUALLY present in the document
2. If you cannot identify clear chapters, create logical groupings based on content themes
3. Never invent or assume content not in the document
4. Preserve the original terminology and headings from the document

Output a JSON object with this structure:
{
  "chapters": [
    {
      "title": "Chapter title as found in document",
      "content": "Brief summary of this chapter's scope (1-2 sentences)",
      "pageStart": null,
      "pageEnd": null,
      "topics": [
        {
          "title": "Topic/section title",
          "content": "Extracted content for this topic - include key information, definitions, and concepts"
        }
      ]
    }
  ]
}

If the document has no clear structure, create logical groupings with descriptive titles.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze this document titled "${documentTitle || 'Untitled'}" and extract its structure:\n\n${documentContent.substring(0, 50000)}` 
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        await supabase
          .from("theory_topics")
          .update({ parsing_status: "failed", parsing_error: "Rate limit exceeded. Please try again later." })
          .eq("id", theoryTopicId);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      throw new Error(`AI gateway error: ${errorText}`);
    }

    const aiResult = await response.json();
    
    // Validate AI response structure
    if (!aiResult.choices?.[0]?.message?.content) {
      throw new Error("Invalid AI response: missing content");
    }
    
    let structuredContent;
    try {
      const rawContent = aiResult.choices[0].message.content;
      // Strip markdown code blocks if present
      let cleanedContent = rawContent
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      
      // Find JSON boundaries - handle both objects and arrays
      const jsonStart = cleanedContent.search(/[\[{]/);
      if (jsonStart === -1) {
        throw new Error("No JSON object or array found in response");
      }
      
      // Find the matching closing bracket
      const startChar = cleanedContent[jsonStart];
      const endChar = startChar === '{' ? '}' : ']';
      let depth = 0;
      let jsonEnd = -1;
      
      for (let i = jsonStart; i < cleanedContent.length; i++) {
        if (cleanedContent[i] === startChar) depth++;
        if (cleanedContent[i] === endChar) depth--;
        if (depth === 0) {
          jsonEnd = i;
          break;
        }
      }
      
      if (jsonEnd === -1) {
        throw new Error("Malformed JSON - unbalanced brackets");
      }
      
      cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
      
      let parsed = JSON.parse(cleanedContent);
      
      // Handle case where AI returns array wrapper: [{ chapters: [...] }]
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].chapters) {
        parsed = parsed[0];
      }
      
      structuredContent = parsed;
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
    }
    
    // Validate chapters array exists
    if (!structuredContent.chapters || !Array.isArray(structuredContent.chapters)) {
      console.error("AI response missing chapters:", structuredContent);
      throw new Error("AI response did not contain valid chapters array");
    }

    // Insert chapters and topics
    for (let chapterIndex = 0; chapterIndex < structuredContent.chapters.length; chapterIndex++) {
      const chapter = structuredContent.chapters[chapterIndex];
      
      const { data: chapterData, error: chapterError } = await supabase
        .from("document_chapters")
        .insert({
          theory_topic_id: theoryTopicId,
          title: chapter.title,
          content: chapter.content,
          page_start: chapter.pageStart,
          page_end: chapter.pageEnd,
          sort_order: chapterIndex,
        })
        .select()
        .single();

      if (chapterError) {
        console.error("Error inserting chapter:", chapterError);
        continue;
      }

      // Insert topics for this chapter
      if (chapter.topics && Array.isArray(chapter.topics)) {
        for (let topicIndex = 0; topicIndex < chapter.topics.length; topicIndex++) {
          const topic = chapter.topics[topicIndex];
          
          const { error: topicError } = await supabase
            .from("document_topics")
            .insert({
              chapter_id: chapterData.id,
              title: topic.title,
              content: topic.content,
              sort_order: topicIndex,
            });

          if (topicError) {
            console.error("Error inserting topic:", topicError);
          }
        }
      }
    }

    // Update parsing status to completed
    await supabase
      .from("theory_topics")
      .update({ 
        parsing_status: "completed", 
        parsed_at: new Date().toISOString(),
        parsing_error: null 
      })
      .eq("id", theoryTopicId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        chaptersCount: structuredContent.chapters.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Parse document error:", error);
    
    // Try to update status to failed
    try {
      const { theoryTopicId } = await req.clone().json();
      if (theoryTopicId) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("theory_topics")
            .update({ 
              parsing_status: "failed", 
              parsing_error: error instanceof Error ? error.message : "Unknown error" 
            })
            .eq("id", theoryTopicId);
        }
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
