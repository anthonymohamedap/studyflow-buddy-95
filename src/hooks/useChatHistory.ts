import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  topic_title: string | null;
  content_type: string;
  created_at: string;
  updated_at: string;
}

export function useChatHistory(courseId?: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load conversations for this course
  const loadConversations = useCallback(async () => {
    if (!user || !courseId) return;
    setLoadingConversations(true);
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .order('updated_at', { ascending: false })
      .limit(20);
    setConversations((data as Conversation[]) || []);
    setLoadingConversations(false);
  }, [user, courseId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setActiveConversationId(conversationId);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data as ChatMessage[])?.map(m => ({ 
      id: m.id, 
      role: m.role as "user" | "assistant", 
      content: m.content,
      created_at: m.created_at 
    })) || []);
    setLoadingMessages(false);
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (
    contentType: string,
    topicTitle?: string,
  ): Promise<string | null> => {
    if (!user || !courseId) return null;
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        course_id: courseId,
        content_type: contentType,
        topic_title: topicTitle || null,
      })
      .select('id')
      .single();
    if (error || !data) return null;
    const newId = (data as { id: string }).id;
    setActiveConversationId(newId);
    setMessages([]);
    loadConversations();
    return newId;
  }, [user, courseId, loadConversations]);

  // Save a message to the active conversation
  const saveMessage = useCallback(async (
    conversationId: string,
    role: "user" | "assistant",
    content: string,
  ) => {
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role,
      content,
    });
    // Update conversation's updated_at
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    await supabase.from('chat_conversations').delete().eq('id', conversationId);
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      setMessages([]);
    }
    loadConversations();
  }, [activeConversationId, loadConversations]);

  // Start new chat (clear active)
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  return {
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    loadConversations,
    loadMessages,
    createConversation,
    saveMessage,
    deleteConversation,
    startNewChat,
    setMessages,
  };
}
