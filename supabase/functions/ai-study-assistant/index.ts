import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const middlewareUrl = Deno.env.get("MIDDLEWARE_URL");
  if (!middlewareUrl) throw new Error("MIDDLEWARE_URL secret is niet geconfigureerd");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { messages, courseId, courseName, context } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages vereist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Haal optioneel extra cursuscontext op uit de database
    let extraContext = context ?? "";
    if (courseId && !extraContext) {
      const { data: topics } = await supabase
        .from("document_topics")
        .select("title, content")
        .eq("course_id", courseId)
        .limit(5);

      if (topics && topics.length > 0) {
        extraContext = topics
          .map((t: { title: string; content: string }) => `${t.title}:\n${t.content}`)
          .join("\n\n")
          .slice(0, 6000);
      }
    }

    const middlewareRes = await fetch(`${middlewareUrl}/ai-study-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        courseName: courseName ?? "het vak",
        context: extraContext,
      }),
    });

    if (!middlewareRes.ok) throw new Error(`Middleware fout: ${await middlewareRes.text()}`);

    const { reply } = await middlewareRes.json();

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-study-assistant fout:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Onbekend" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
