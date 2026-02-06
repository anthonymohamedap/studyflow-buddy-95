import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Strict document-grounding preamble for zero hallucination tolerance
const GROUNDING_PREAMBLE = `🔒 DOCUMENT-LOCKED MODE - ZERO HALLUCINATION TOLERANCE

MANDATORY CONSTRAINTS:
- Your knowledge is LIMITED STRICTLY to the document content provided below.
- External knowledge, training data, and world knowledge are DISABLED.
- Use ONLY information EXPLICITLY present in the document.
- Do NOT use prior knowledge, assumptions, general knowledge, or external sources.
- If information is not clearly stated in the document, respond with null or "Not found in document".
- Do not infer, extrapolate, or fill gaps.
- Keep all outputs concise and factual.

✅ ALLOWED ACTIONS: Extract, Summarize, Quote
❌ DISALLOWED ACTIONS: Explaining beyond document, Giving examples not in text, Combining ideas not explicitly combined

🧠 SELF-VALIDATION: Before finalizing, verify EVERY item can be directly traced to the document. If not, remove it.

---`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const { labId, filePath, fileContent } = await req.json();

    if (!labId) {
      throw new Error("Lab ID is required");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify lab exists
    const { data: lab, error: labError } = await supabase
      .from("lab_documents")
      .select("id, course_id")
      .eq("id", labId)
      .single();

    if (labError || !lab) {
      return new Response(
        JSON.stringify({ error: "Lab not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Parse document structure with AI (strict grounding)
    const structurePrompt = `${GROUNDING_PREAMBLE}

You are analyzing a lab assignment document. Extract the following information:

1. A brief description of what this lab is about (2-3 sentences max)
2. Any requirements or constraints mentioned
3. The tasks that need to be completed
4. Deliverables (what must be submitted)
5. Evaluation criteria (if mentioned)

STRICT RULES:
- Only extract information that is EXPLICITLY stated in the document
- If a section is not found, set it to null
- Do not invent or assume any requirements
- Keep descriptions concise
- Quote exact wording where possible

Return your response as JSON in this exact format:
{
  "description": "Brief description of the lab (or null if not found)",
  "sections": [
    {
      "type": "description|requirements|tasks|deliverables|evaluation|other",
      "title": "Section title if any (or null)",
      "content": "Content of the section - use exact document wording"
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
        temperature: 0.2, // Lower temperature for more factual extraction
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

    // Generate summary (strict grounding)
    const summaryPrompt = `${GROUNDING_PREAMBLE}

Based on this lab assignment, create a brief summary with 3-6 bullet points that describe:
- What this lab is about
- What the end result should be
- Key skills or concepts being practiced

STRICT RULES:
- Only include information from the document
- If something is unclear, say "Not specified in material"
- Use document wording, not paraphrasing

Document content:
${documentContent.substring(0, 20000)}

Return JSON in this format:
{
  "title": "Lab title/name (from document)",
  "bullets": ["Bullet 1 (document-based)", "Bullet 2", "Bullet 3"]
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
        temperature: 0.2,
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

    // Generate approach plan (stappenplan) with strict grounding
    const approachPrompt = `${GROUNDING_PREAMBLE}

Create a step-by-step approach plan (stappenplan) for completing this lab assignment.

Include for each step:
- What to do (from document requirements)
- What to check/verify (from document criteria)
- Common pitfalls to avoid (based on document complexity)
- Suggested order of work

STRICT RULES:
- Base ALL steps on the actual lab requirements in the document
- If requirements are unclear, note "Clarify with lecturer"
- Never invent requirements not explicitly stated
- Reference specific document sections where possible

Document content:
${documentContent.substring(0, 20000)}

Return JSON in this format:
{
  "steps": [
    {
      "number": 1,
      "title": "Step title (from document task)",
      "description": "What to do (document-based)",
      "checks": ["What to verify (from document criteria)"],
      "pitfalls": ["Common mistakes based on document complexity"],
      "source": "Reference to document section (if available)"
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
        temperature: 0.2,
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

    // Generate checklist with strict grounding
    const checklistPrompt = `${GROUNDING_PREAMBLE}

Extract a deliverables checklist from this lab assignment.

List all items that must be submitted or completed.

STRICT RULES:
- Only include items EXPLICITLY mentioned in the document
- If an item is implied but not stated, add "needs_clarification": true
- Use exact document wording for item text
- Reference the section where each item is mentioned

Document content:
${documentContent.substring(0, 15000)}

Return JSON in this format:
{
  "items": [
    { 
      "text": "Deliverable item (exact document wording)", 
      "required": true,
      "needs_clarification": false,
      "source": "Document section reference"
    }
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
        temperature: 0.1, // Very low for factual extraction
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
