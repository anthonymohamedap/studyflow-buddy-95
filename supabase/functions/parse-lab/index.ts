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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    // Helper to make AI call and parse JSON response
    const callAI = async (prompt: string): Promise<unknown> => {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.15,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI call failed: ${errorText}`);
      }

      const result = await response.json();
      if (!result.choices?.[0]?.message?.content) {
        throw new Error("Invalid AI response: missing content");
      }

      const content = result.choices[0].message.content;
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      return JSON.parse(jsonStr);
    };

    const docSlice30k = documentContent.substring(0, 30000);
    const docSlice20k = documentContent.substring(0, 20000);
    const docSlice25k = documentContent.substring(0, 25000);
    const docSlice18k = documentContent.substring(0, 18000);

    // Build all prompts
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
${docSlice30k}`;

    const overviewPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Create a brief LAB OVERVIEW from this assignment.

OUTPUT FORMAT:
{
  "title": "Lab title/name (from document)",
  "about": "1-2 sentences: What this lab is about",
  "end_goal": "What must work or be submitted to pass",
  "key_concepts": ["Concept 1", "Concept 2"]
}

STRICT RULES:
- Only include information EXPLICITLY in the document
- If end goal is unclear, state "See deliverables section" or "Not explicitly specified"
- Do NOT invent requirements or add features not in the document

Document content:
${docSlice20k}`;

    const approachPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Convert this lab assignment into a PRACTICAL, ACTIONABLE execution plan.

CRITICAL PRIORITY - DETECT "HANDS-ON" SECTIONS:
1. FIRST, scan the document for explicit "Hands-on" markers (e.g., "Hands-on #1:", "Hands-on 1:", "Exercise 1:", "Stap 1:", "Opdracht 1:", "Task 1:")
2. If found, extract EACH hands-on section as a separate step with its EXACT instructions
3. If no explicit markers, derive logical steps from the document structure

CRITICAL: Write as if the student is sitting in the lab RIGHT NOW under time pressure.

FORMAT EACH STEP AS IMPERATIVE INSTRUCTIONS:
- Use commands: "Create...", "Run...", "Write...", "Configure...", "Test...", "Select...", "Click..."
- Be EXPLICIT about: UI actions, menu paths, files to create/edit, commands to run
- Preserve the EXACT sequence from the document
- Do NOT merge or skip hands-on sections

Document content:
${docSlice25k}

Return JSON in this format:
{
  "steps": [
    {
      "number": 1,
      "title": "Short action title",
      "action_items": ["Step 1", "Step 2"],
      "commands": [],
      "files_to_create": [],
      "verification": "How to verify this step is complete",
      "pitfalls": [],
      "source": "Document section reference"
    }
  ],
  "tools_required": [],
  "time_estimate": "Not specified",
  "has_explicit_hands_on": true
}`;

    const howToPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Analyze this lab document to extract PRACTICAL HOW-TO WORKFLOWS.

Scan the ENTIRE document semantically and extract workflows from explanations, theory sections, examples, and implied actions.

Document content:
${docSlice20k}

Return JSON:
{
  "workflows": [
    {
      "title": "Task or workflow name",
      "description": "Brief context",
      "steps": [
        { "number": 1, "action": "What to do", "reasoning": "Why", "type": "explicit|inferred" }
      ],
      "tools_involved": [],
      "source": "Document section reference"
    }
  ]
}`;

    const checklistPrompt = `${GROUNDING_PREAMBLE}

You are an academic lab assistant. Create a LAB SUCCESS CHECKLIST from this assignment.

Include:
1. MUST EXIST TO PASS - What deliverables are required
2. MUST COMPILE/RUN - What must work technically
3. COMMONLY FORGOTTEN - Things students often miss
4. TYPICAL MISTAKES - Common errors to avoid

Document content:
${docSlice18k}

Return JSON:
{
  "must_exist": [
    { "text": "Deliverable", "source": "Section ref", "needs_clarification": false }
  ],
  "must_work": [
    { "text": "What must compile/run", "source": "Section ref" }
  ],
  "commonly_forgotten": [
    { "text": "Thing students miss", "why": "Why easy to forget" }
  ],
  "typical_mistakes": [
    { "mistake": "Common error", "consequence": "What goes wrong", "prevention": "How to avoid" }
  ],
  "submission_format": "How to submit or 'Not specified'"
}`;

    // Run ALL AI calls in parallel for maximum speed
    const [structuredData, overviewData, approachData, howToData, checklistData] = await Promise.all([
      callAI(structurePrompt).catch(e => { console.error("Structure parse failed:", e); return null; }),
      callAI(overviewPrompt).catch(e => { console.error("Overview parse failed:", e); return null; }),
      callAI(approachPrompt).catch(e => { console.error("Approach parse failed:", e); return null; }),
      callAI(howToPrompt).catch(e => { console.error("How-to parse failed:", e); return null; }),
      callAI(checklistPrompt).catch(e => { console.error("Checklist parse failed:", e); return null; }),
    ]);

    // Process structure result
    const structResult = structuredData as { description?: string; sections?: Array<{ type: string; title: string; content: string }> } | null;

    // Update lab description
    if (structResult?.description) {
      await supabase
        .from("lab_documents")
        .update({ description: structResult.description })
        .eq("id", labId);
    }

    // Insert extracted sections
    if (structResult?.sections && Array.isArray(structResult.sections)) {
      for (let i = 0; i < structResult.sections.length; i++) {
        const section = structResult.sections[i];
        await supabase.from("lab_sections").insert({
          lab_id: labId,
          section_type: section.type || "other",
          title: section.title,
          content: section.content,
          sort_order: i,
        });
      }
    }

    // Process overview
    const overviewResult = overviewData as { title?: string; about?: string; end_goal?: string; key_concepts?: string[] } | null;
    const summaryContent = overviewResult ? {
      title: overviewResult.title || "Lab Summary",
      bullets: [
        overviewResult.about,
        `End goal: ${overviewResult.end_goal}`,
        ...(overviewResult.key_concepts || []).map((c: string) => `Key concept: ${c}`)
      ].filter(Boolean),
      about: overviewResult.about,
      end_goal: overviewResult.end_goal,
      key_concepts: overviewResult.key_concepts,
    } : { title: "Lab Summary", bullets: [] };

    // Process approach
    const approachContent = (approachData as { steps: unknown[] } | null) || { steps: [] };

    // Process how-to
    const howToContent = (howToData as { how_to_guides?: unknown[]; workflows?: unknown[] } | null) || { how_to_guides: [] };

    // Process checklist
    const checklistRaw = checklistData as { must_exist?: unknown[]; must_work?: Array<{ text: string }>; commonly_forgotten?: unknown[]; typical_mistakes?: unknown[]; submission_format?: string } | null;
    const checklistContent = checklistRaw ? {
      ...checklistRaw,
      items: [
        ...(checklistRaw.must_exist || []),
        ...(checklistRaw.must_work || []).map((item) => ({ ...item, required: true })),
      ]
    } : { items: [] };

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
