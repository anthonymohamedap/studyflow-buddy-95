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
  const middlewareUrl = Deno.env.get("MIDDLEWARE_URL");
  if (!middlewareUrl) throw new Error("MIDDLEWARE_URL secret is niet geconfigureerd");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { topicId, assetType, topicContent, topicTitle } = await req.json();

    if (!topicId || !assetType || !topicContent) {
      return new Response(
        JSON.stringify({ error: "topicId, assetType en topicContent zijn vereist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["summary", "flashcards", "quiz", "keywords"].includes(assetType)) {
      return new Response(
        JSON.stringify({ error: "Ongeldig assetType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: topic, error: topicError } = await supabase
      .from("document_topics").select("id").eq("id", topicId).single();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({ error: "Topic niet gevonden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("revision_assets").upsert(
      { topic_id: topicId, asset_type: assetType, is_generating: true, content: {} },
      { onConflict: "topic_id,asset_type" }
    );

    const middlewareRes = await fetch(`${middlewareUrl}/generate-revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, assetType, topicContent, topicTitle }),
    });

    if (!middlewareRes.ok) throw new Error(`Middleware fout: ${await middlewareRes.text()}`);

    const { content } = await middlewareRes.json();

    await supabase.from("revision_assets").update({
      content,
      is_generating: false,
      generated_at: new Date().toISOString(),
    }).eq("topic_id", topicId).eq("asset_type", assetType);

    return new Response(
      JSON.stringify({ success: true, content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("generate-revision fout:", error);
    try {
      const { topicId, assetType } = await req.clone().json();
      if (topicId && assetType) {
        await supabase.from("revision_assets").update({ is_generating: false })
          .eq("topic_id", topicId).eq("asset_type", assetType);
      }
    } catch {}
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Onbekend" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
