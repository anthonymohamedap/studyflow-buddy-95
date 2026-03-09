import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const middlewareUrl = Deno.env.get("MIDDLEWARE_URL");
  if (!middlewareUrl) throw new Error("MIDDLEWARE_URL secret is niet geconfigureerd");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { theoryTopicId, documentTitle, filePath } = await req.json();

    if (!theoryTopicId) {
      return new Response(
        JSON.stringify({ error: "theoryTopicId is vereist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: theoryTopic, error: topicError } = await supabase
      .from("theory_topics")
      .select("id, course_id")
      .eq("id", theoryTopicId)
      .single();

    if (topicError || !theoryTopic) {
      return new Response(
        JSON.stringify({ error: "Theory topic niet gevonden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("theory_topics")
      .update({ parsing_status: "parsing" })
      .eq("id", theoryTopicId);

    if (!filePath) {
      throw new Error("Geen filePath opgegeven");
    }

    const filename = filePath.split("/").pop() ?? "document.pdf";

    // Download bestand uit Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("course-materials")
      .download(filePath);

    if (downloadError) throw new Error(`Download mislukt: ${downloadError.message}`);

    // Zet om naar base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const fileBase64 = btoa(binary);

    // Stuur als base64 naar middleware
    const middlewareRes = await fetch(`${middlewareUrl}/parse-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileContent: fileBase64,
        filename: filename,
        title: documentTitle || filename.replace(/\.[^.]+$/, ""),
      }),
    });

    if (!middlewareRes.ok) {
      const err = await middlewareRes.text();
      throw new Error(`Middleware fout: ${err}`);
    }

    const result = await middlewareRes.json();

    if (result.warning) {
      console.log("Waarschuwing:", result.warning);
    }

    const chapters = result.chapters ?? [];

    for (let ci = 0; ci < chapters.length; ci++) {
      const chapter = chapters[ci];
      const { data: chapterData, error: chapterError } = await supabase
        .from("document_chapters")
        .insert({
          theory_topic_id: theoryTopicId,
          title: chapter.title,
          content: chapter.content,
          page_start: chapter.pageStart ?? null,
          page_end: chapter.pageEnd ?? null,
          sort_order: ci,
        })
        .select()
        .single();

      if (chapterError) {
        console.error("Chapter insert fout:", chapterError);
        continue;
      }

      for (let ti = 0; ti < (chapter.topics ?? []).length; ti++) {
        const topic = chapter.topics[ti];
        await supabase.from("document_topics").insert({
          chapter_id: chapterData.id,
          title: topic.title,
          content: topic.content,
          sort_order: ti,
        });
      }
    }

    await supabase
      .from("theory_topics")
      .update({
        parsing_status: "completed",
        parsed_at: new Date().toISOString(),
        parsing_error: null,
      })
      .eq("id", theoryTopicId);

    return new Response(
      JSON.stringify({ success: true, chaptersCount: chapters.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("parse-document fout:", error);
    try {
      const { theoryTopicId } = await req.clone().json();
      if (theoryTopicId) {
        await supabase.from("theory_topics").update({
          parsing_status: "failed",
          parsing_error: error instanceof Error ? error.message : "Onbekende fout",
        }).eq("id", theoryTopicId);
      }
    } catch {}
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

Na deze prompt in Lovable zou je in je server terminal moeten zien:
```
[PARSE] fileContent: 17788570 bytes, file: spring-w2.pptx
[PPTX] Geëxtraheerd: 5849 tekens