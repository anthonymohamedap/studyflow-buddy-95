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

    // Generate overview (strict grounding)
    const overviewPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Create a brief LAB OVERVIEW from this assignment.

OUTPUT FORMAT:
{
  "title": "Lab title/name (from document)",
  "about": "1-2 sentences: What this lab is about",
  "end_goal": "What must work or be submitted to pass",
  "key_concepts": ["Concept 1", "Concept 2"] // Only concepts EXPLICITLY mentioned
}

STRICT RULES:
- Only include information EXPLICITLY in the document
- If end goal is unclear, state "See deliverables section" or "Not explicitly specified"
- Do NOT invent requirements or add features not in the document

Document content:
${documentContent.substring(0, 20000)}`;

    const overviewResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: overviewPrompt }],
        temperature: 0.1,
      }),
    });

    let summaryContent: { title: string; bullets: string[]; about?: string; end_goal?: string; key_concepts?: string[] } = { title: "Lab Summary", bullets: [] };
    if (overviewResponse.ok) {
      const overviewResult = await overviewResponse.json();
      try {
        const content = overviewResult.choices[0].message.content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                          content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        const parsed = JSON.parse(jsonStr);
        // Convert to legacy format for compatibility, but include new fields
        summaryContent = {
          title: parsed.title || "Lab Summary",
          bullets: [
            parsed.about,
            `End goal: ${parsed.end_goal}`,
            ...(parsed.key_concepts || []).map((c: string) => `Key concept: ${c}`)
          ].filter(Boolean),
          about: parsed.about,
          end_goal: parsed.end_goal,
          key_concepts: parsed.key_concepts,
        };
      } catch (e) {
        console.error("Failed to parse overview:", e);
      }
    }

    // Generate ACTIONABLE step-by-step execution plan (strict grounding)
    const approachPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Convert this lab assignment into a PRACTICAL, ACTIONABLE execution plan.

CRITICAL: Write as if the student is sitting in the lab RIGHT NOW under time pressure.

FORMAT EACH STEP AS IMPERATIVE INSTRUCTIONS:
- Use commands: "Create...", "Run...", "Write...", "Configure...", "Test..."
- Be EXPLICIT about: files to create/edit, commands to run, code to write
- If something is implied in the document, make it explicit
- Do NOT write summaries - write ACTION ITEMS

STRICT RULES:
- Base ALL steps on actual document requirements
- Do NOT invent steps that are not logically required
- Do NOT add features not mentioned in the document
- If requirements are unclear: state "Not specified - clarify with lecturer"
- Reference document sections where possible

Document content:
${documentContent.substring(0, 25000)}

Return JSON in this format:
{
  "steps": [
    {
      "number": 1,
      "title": "Short action title (e.g., 'Set up project structure')",
      "actions": [
        "Create a new folder called X",
        "Run command: npm init",
        "Create file: src/main.js with basic structure"
      ],
      "commands": ["npm init", "mkdir src"],
      "files_to_create": ["src/main.js", "package.json"],
      "verification": "How to verify this step is complete (from document)",
      "pitfalls": ["Do NOT skip X", "Common mistake: Y"],
      "source": "Document section reference"
    }
  ],
  "tools_required": ["List of tools/software mentioned in document"],
  "time_estimate": "Estimated time if mentioned, or 'Not specified'"
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
        temperature: 0.15,
      }),
    });

    let approachContent: { steps: unknown[]; tools_required?: string[]; time_estimate?: string } = { steps: [] };
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

    // Generate practical "How-To" guidance for specific tools/techniques
    const howToPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Based on this lab document, provide PRACTICAL HOW-TO GUIDANCE for any tools, frameworks, or techniques mentioned.

RULES:
- Only cover tools/techniques EXPLICITLY mentioned in the document
- Explain HOW to do it, not WHAT it is (assume student knows theory)
- Write for someone doing this LIVE in a lab session
- You may reference official documentation for standard tool usage
- Do NOT invent tools or frameworks not mentioned

Document content:
${documentContent.substring(0, 20000)}

Return JSON:
{
  "how_to_guides": [
    {
      "topic": "Tool or technique name (from document)",
      "quick_reference": [
        "Practical instruction 1",
        "Command or code snippet if relevant",
        "Where to find more info (official docs)"
      ],
      "common_errors": ["Error message: solution"],
      "source": "Document section mentioning this"
    }
  ]
}

If no specific tools are mentioned that need guidance, return:
{ "how_to_guides": [], "note": "No specific tool guidance needed based on document" }`;

    const howToResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: howToPrompt }],
        temperature: 0.15,
      }),
    });

    let howToContent: { how_to_guides: unknown[] } = { how_to_guides: [] };
    if (howToResponse.ok) {
      const howToResult = await howToResponse.json();
      try {
        const content = howToResult.choices[0].message.content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                          content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        howToContent = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse how-to:", e);
      }
    }

    // Generate SUCCESS CHECKLIST with common mistakes (strict grounding)
    const checklistPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Create a LAB SUCCESS CHECKLIST from this assignment.

Include:
1. ✅ MUST EXIST TO PASS - What deliverables are required
2. ✅ MUST COMPILE/RUN - What must work technically  
3. ✅ COMMONLY FORGOTTEN - Things students often miss
4. ⚠️ TYPICAL MISTAKES - Common errors to avoid

STRICT RULES:
- Only include items from the document OR logical requirements (like "code must compile")
- Mark items with "needs_clarification": true if implied but not stated
- Use exact document wording where possible
- Reference document sections

Document content:
${documentContent.substring(0, 18000)}

Return JSON:
{
  "must_exist": [
    { "text": "Deliverable (exact wording)", "source": "Section ref", "needs_clarification": false }
  ],
  "must_work": [
    { "text": "What must compile/run/function", "source": "Section ref" }
  ],
  "commonly_forgotten": [
    { "text": "Thing students often miss", "why": "Why it's easy to forget" }
  ],
  "typical_mistakes": [
    { "mistake": "Common error", "consequence": "What goes wrong", "prevention": "How to avoid" }
  ],
  "submission_format": "How to submit (if specified, else 'Not specified in document')"
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
        temperature: 0.1,
      }),
    });

    let checklistContent: { 
      items?: unknown[]; 
      must_exist?: unknown[]; 
      must_work?: unknown[]; 
      commonly_forgotten?: unknown[]; 
      typical_mistakes?: unknown[];
      submission_format?: string;
    } = { items: [] };
    if (checklistResponse.ok) {
      const checklistResult = await checklistResponse.json();
      try {
        const content = checklistResult.choices[0].message.content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                          content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        const parsed = JSON.parse(jsonStr);
        // Include both new format and legacy compatibility
        checklistContent = {
          ...parsed,
          // Legacy format for backward compatibility
          items: [
            ...(parsed.must_exist || []),
            ...(parsed.must_work || []).map((item: { text: string }) => ({ ...item, required: true })),
          ]
        };
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
      {
        lab_id: labId,
        asset_type: "how_to",
        content: howToContent,
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
        howTo: howToContent,
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
