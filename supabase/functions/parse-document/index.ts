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
    const body = await req.json();
    const { theoryTopicId, documentTitle, filePath } = body;

    if (!theoryTopicId) return new Response(JSON.stringify({ error: "theoryTopicId vereist" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: topic, error: topicError } = await supabase.from("theory_topics").select("id").eq("id", theoryTopicId).single();
    if (topicError || !topic) return new Response(JSON.stringify({ error: "Topic niet gevonden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await supabase.from("theory_topics").update({ parsing_status: "parsing" }).eq("id", theoryTopicId);

    if (!filePath) throw new Error("Geen filePath opgegeven");

    const filename = filePath.split("/").pop() ?? "document.pdf";

    const { data: fileData, error: downloadError } = await supabase.storage.from("course-materials").download(filePath);
    if (downloadError) throw new Error(`Download mislukt: ${downloadError.message}`);

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i += 8192) {
      binary += String.fromCharCode(...uint8Array.subarray(i, i + 8192));
    }
    const fileBase64 = btoa(binary);

    const middlewareRes = await fetch(`${middlewareUrl}/parse-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileContent: fileBase64, filename, title: documentTitle || filename.replace(/\.[^.]+$/, "") }),
    });

    if (!middlewareRes.ok) throw new Error(`Middleware fout: ${await middlewareRes.text()}`);

    const result = await middlewareRes.json();
    const chapters = result.chapters ?? [];

    for (let ci = 0; ci < chapters.length; ci++) {
      const chapter = chapters[ci];
      const { data: chapterData, error: chapterError } = await supabase.from("document_chapters").insert({
        theory_topic_id: theoryTopicId, title: chapter.title, content: chapter.content,
        page_start: chapter.pageStart ?? null, page_end: chapter.pageEnd ?? null, sort_order: ci,
      }).select().single();
      if (chapterError) { console.error("Chapter fout:", chapterError); continue; }
      for (let ti = 0; ti < (chapter.topics ?? []).length; ti++) {
        const t = chapter.topics[ti];
        await supabase.from("document_topics").insert({ chapter_id: chapterData.id, title: t.title, content: t.content, sort_order: ti });
      }
    }

    await supabase.from("theory_topics").update({ parsing_status: "completed", parsed_at: new Date().toISOString(), parsing_error: null }).eq("id", theoryTopicId);

    return new Response(JSON.stringify({ success: true, chaptersCount: chapters.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Fout:", error);
    try {
      const { theoryTopicId } = await req.clone().json();
      if (theoryTopicId) await supabase.from("theory_topics").update({ parsing_status: "failed", parsing_error: error instanceof Error ? error.message : "Onbekend" }).eq("id", theoryTopicId);
    } catch {}
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Onbekend" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
