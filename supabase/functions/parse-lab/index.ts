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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
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

    const structureResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: structurePrompt }],
        temperature: 0.2,
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

    const overviewResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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
    // PRIORITY: Look for explicit "Hands-on" sections in the document
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

STRICT RULES:
- Extract VERBATIM instructions from hands-on sections when present
- Base ALL steps on actual document requirements
- Do NOT invent steps that are not in the document
- If requirements are unclear: state "Not specified - clarify with lecturer"
- Include the original hands-on number as reference

Document content:
${documentContent.substring(0, 25000)}

Return JSON in this format:
{
  "steps": [
    {
      "number": 1,
      "title": "Short action title (e.g., 'Hands-on #1: Save simulation as new file')",
      "action_items": [
        "Open File / Save World As... menu",
        "Save the simulation as obstacles.wbt",
        "Verify the file is saved correctly"
      ],
      "commands": [],
      "files_to_create": ["obstacles.wbt"],
      "verification": "How to verify this step is complete",
      "pitfalls": ["Do NOT skip X", "Common mistake: Y"],
      "source": "Hands-on #1" 
    }
  ],
  "tools_required": ["List of tools/software mentioned in document"],
  "time_estimate": "Estimated time if mentioned, or 'Not specified'",
  "has_explicit_hands_on": true
}`;

    const approachResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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

You are an academic lab assistant. Analyze this lab document to extract PRACTICAL HOW-TO WORKFLOWS.

CRITICAL: DO NOT RELY ONLY ON EXPLICIT STEP-BY-STEP SECTIONS.

Instead, scan the ENTIRE document semantically and extract workflows from:
- Explanations and descriptions of concepts
- Theory sections that describe processes
- Examples showing how things work
- Contextual clues like "First...", "Before...", "This requires...", "To achieve...", "In practice..."
- Implied actions from lab goals and deliverables

🔍 DETECTION RULES:
1. If something is described, infer it must be done
2. If a concept is explained, extract the setup/configuration steps
3. If a result is shown, infer the process that produces it
4. Treat inferred steps equally with explicit steps

📋 WHAT COUNTS AS A WORKFLOW/TASK:
- Any configuration or setup action
- Any preparation requirement
- Any tool/software usage pattern
- Any logical sequence needed to achieve a result
- Process flows hidden in explanations

📝 OUTPUT FORMAT:
For each detected workflow/task, provide:
1. Clear task title (e.g., "Configure Floor Physics", "Set up Sphere Geometry")
2. Ordered steps with:
   - Action: What to do (imperative)
   - Reasoning: Why this step exists (from document context)
3. If a step is implied/inferred, that's valid - document context justifies it

Document content:
${documentContent.substring(0, 20000)}

Return JSON:
{
  "workflows": [
    {
      "title": "Task or workflow name",
      "description": "Brief context of when/why this workflow is used",
      "steps": [
        {
          "number": 1,
          "action": "What to do (imperative verb)",
          "reasoning": "Why this step is necessary (from document)",
          "type": "explicit|inferred"
        },
        {
          "number": 2,
          "action": "Next action",
          "reasoning": "Context from document",
          "type": "explicit|inferred"
        }
      ],
      "tools_involved": ["Tool1", "Tool2"],
      "source": "Document section(s) that explain this workflow"
    }
  ],
  "note": "Summary of extraction approach if needed"
}`;

    const howToResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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

    const checklistResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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
