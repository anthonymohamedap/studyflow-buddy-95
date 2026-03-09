import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const middlewareUrl = Deno.env.get("MIDDLEWARE_URL") ?? "https://blaine-unrefreshed-swingingly.ngrok-free.dev";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { labId, filePath, fileContent } = await req.json();

    if (!labId) throw new Error("labId is vereist");

    const { data: lab, error: labError } = await supabase
      .from("lab_documents").select("id, course_id").eq("id", labId).single();

    if (labError || !lab) {
      return new Response(
        JSON.stringify({ error: "Lab niet gevonden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("lab_documents").update({ parsing_status: "parsing" }).eq("id", labId);

    const filename = filePath ? (filePath.split("/").pop() ?? "lab.pdf") : "lab.pdf";
    let fileBase64: string | undefined;

    if (filePath) {
      // Download en converteer naar base64
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("course-materials").download(filePath);

      if (downloadError) throw new Error(`Download mislukt: ${downloadError.message}`);

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i += 8192) {
        binary += String.fromCharCode(...uint8Array.subarray(i, i + 8192));
      }
      fileBase64 = btoa(binary);
    }

    const middlewareRes = await fetch(`${middlewareUrl}/parse-lab`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: fileBase64,
        documentContent: fileContent,
        filename,
      }),
    });

    if (!middlewareRes.ok) throw new Error(`Middleware fout: ${await middlewareRes.text()}`);

    const result = await middlewareRes.json();
    const now = new Date().toISOString();

    if (result.sections?.length) {
      for (let i = 0; i < result.sections.length; i++) {
        const s = result.sections[i];
        await supabase.from("lab_sections").insert({
          lab_id: labId, section_type: s.type || "other",
          title: s.title, content: s.content, sort_order: i,
        });
      }
    }

    await supabase.from("lab_assets").upsert([
      { lab_id: labId, asset_type: "summary",       content: result.summary,   generated_at: now, is_generating: false },
      { lab_id: labId, asset_type: "approach_plan", content: result.approach,  generated_at: now, is_generating: false },
      { lab_id: labId, asset_type: "checklist",     content: result.checklist, generated_at: now, is_generating: false },
      { lab_id: labId, asset_type: "how_to",        content: result.howTo,     generated_at: now, is_generating: false },
    ], { onConflict: "lab_id,asset_type" });

    await supabase.from("lab_documents")
      .update({ parsing_status: "completed", parsed_at: now })
      .eq("id", labId);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("parse-lab fout:", error);
    try {
      const { labId } = await req.clone().json();
      if (labId) {
        await supabase.from("lab_documents").update({
          parsing_status: "error",
          parsing_error: error instanceof Error ? error.message : "Onbekend",
        }).eq("id", labId);
      }
    } catch {}
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Onbekend" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
