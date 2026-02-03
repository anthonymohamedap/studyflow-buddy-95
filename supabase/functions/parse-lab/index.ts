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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Verify JWT and get user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = claimsData.claims.sub as string;

    const { labId, filePath, fileContent } = await req.json();

    if (!labId) {
      throw new Error("Lab ID is required");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user owns this lab through the course
    const { data: lab, error: labError } = await supabase
      .from("lab_documents")
      .select("id, course_id, courses(user_id)")
      .eq("id", labId)
      .single();

    if (labError || !lab) {
      return new Response(
        JSON.stringify({ error: "Lab not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check ownership via the course
    const courseData = lab.courses as unknown as { user_id: string } | null;
    if (!courseData || courseData.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update parsing status
    await supabase
      .from("lab_documents")
      .update({ parsing_status: "parsing" })
      .eq("id", labId);

    let documentContent = fileContent;

    // If file path provided, download from storage
    if (filePath && !fileContent) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("course-materials")
        .download(filePath);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      documentContent = await fileData.text();
    }

    if (!documentContent) {
      throw new Error("No document content available");
    }

    // Parse document structure with AI
    const structurePrompt = `You are analyzing a lab assignment document. Extract the following information:

1. A brief description of what this lab is about (2-3 sentences max)
2. Any requirements or constraints mentioned
3. The tasks that need to be completed
4. Deliverables (what must be submitted)
5. Evaluation criteria (if mentioned)

IMPORTANT RULES:
- Only extract information that is EXPLICITLY stated in the document
- If a section is not found, set it to null
- Do not invent or assume any requirements
- Keep descriptions concise

Return your response as JSON in this exact format:
{
  "description": "Brief description of the lab",
  "sections": [
    {
      "type": "description|requirements|tasks|deliverables|evaluation|other",
      "title": "Section title if any",
      "content": "Content of the section"
    }
  ]
}

Document content:
${documentContent.substring(0, 30000)}`;

    const structureResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: structurePrompt }],
        temperature: 0.3,
      }),
    });

    if (!structureResponse.ok) {
      const errorText = await structureResponse.text();
      throw new Error(`AI structure extraction failed: ${errorText}`);
    }

    const structureResult = await structureResponse.json();
    
    if (!structureResult.choices?.[0]?.message?.content) {
      throw new Error("Invalid AI response: missing content");
    }

    let structuredData;
    try {
      const content = structureResult.choices[0].message.content;
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      structuredData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse structure:", structureResult.choices[0].message.content);
      throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
    }

    // Update lab description
    if (structuredData.description) {
      await supabase
        .from("lab_documents")
        .update({ description: structuredData.description })
        .eq("id", labId);
    }

    // Insert extracted sections
    if (structuredData.sections && Array.isArray(structuredData.sections)) {
      for (let i = 0; i < structuredData.sections.length; i++) {
        const section = structuredData.sections[i];
        await supabase.from("lab_sections").insert({
          lab_id: labId,
          section_type: section.type || "other",
          title: section.title,
          content: section.content,
          sort_order: i,
        });
      }
    }

    // Generate summary
    const summaryPrompt = `Based on this lab assignment, create a brief summary with 3-6 bullet points that describe:
- What this lab is about
- What the end result should be
- Key skills or concepts being practiced

IMPORTANT: Only include information from the document. If something is unclear, say "Not specified in material".

Document content:
${documentContent.substring(0, 20000)}

Return JSON in this format:
{
  "title": "Lab title/name",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"]
}`;

    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: summaryPrompt }],
        temperature: 0.3,
      }),
    });

    let summaryContent = { title: "Lab Summary", bullets: [] };
    if (summaryResponse.ok) {
      const summaryResult = await summaryResponse.json();
      try {
        const content = summaryResult.choices[0].message.content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                          content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        summaryContent = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse summary:", e);
      }
    }

    // Generate approach plan (stappenplan)
    const approachPrompt = `Create a step-by-step approach plan (stappenplan) for completing this lab assignment.

Include for each step:
- What to do
- What to check/verify
- Common pitfalls to avoid
- Suggested order of work

IMPORTANT RULES:
- Base ALL steps on the actual lab requirements
- If requirements are unclear, note "Clarify with lecturer"
- Never invent requirements not in the document

Document content:
${documentContent.substring(0, 20000)}

Return JSON in this format:
{
  "steps": [
    {
      "number": 1,
      "title": "Step title",
      "description": "What to do",
      "checks": ["What to verify"],
      "pitfalls": ["Common mistakes to avoid"]
    }
  ]
}`;

    const approachResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: approachPrompt }],
        temperature: 0.3,
      }),
    });

    let approachContent = { steps: [] };
    if (approachResponse.ok) {
      const approachResult = await approachResponse.json();
      try {
        const content = approachResult.choices[0].message.content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                          content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        approachContent = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse approach:", e);
      }
    }

    // Generate checklist
    const checklistPrompt = `Extract a deliverables checklist from this lab assignment.

List all items that must be submitted or completed.

IMPORTANT: Only include items explicitly mentioned in the document.

Document content:
${documentContent.substring(0, 15000)}

Return JSON in this format:
{
  "items": [
    { "text": "Deliverable item", "required": true }
  ]
}`;

    const checklistResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: checklistPrompt }],
        temperature: 0.2,
      }),
    });

    let checklistContent = { items: [] };
    if (checklistResponse.ok) {
      const checklistResult = await checklistResponse.json();
      try {
        const content = checklistResult.choices[0].message.content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                          content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        checklistContent = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse checklist:", e);
      }
    }

    // Save generated assets
    const now = new Date().toISOString();
    
    await supabase.from("lab_assets").upsert([
      {
        lab_id: labId,
        asset_type: "summary",
        content: summaryContent,
        generated_at: now,
        is_generating: false,
      },
      {
        lab_id: labId,
        asset_type: "approach_plan",
        content: approachContent,
        generated_at: now,
        is_generating: false,
      },
      {
        lab_id: labId,
        asset_type: "checklist",
        content: checklistContent,
        generated_at: now,
        is_generating: false,
      },
    ], { onConflict: "lab_id,asset_type" });

    // Update parsing status
    await supabase
      .from("lab_documents")
      .update({ 
        parsing_status: "completed",
        parsed_at: now,
      })
      .eq("id", labId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: summaryContent,
        approach: approachContent,
        checklist: checklistContent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error parsing lab:", error);

    // Try to update error status
    try {
      const { labId } = await req.clone().json();
      if (labId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from("lab_documents")
          .update({ 
            parsing_status: "error",
            parsing_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq("id", labId);
      }
    } catch (e) {
      console.error("Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
