import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useGroupContext() {
  const { user } = useAuth();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetch = async () => {
      // Try group_admins first
      const { data: admin } = await supabase
        .from("group_admins")
        .select("group_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (admin) { setGroupId(admin.group_id); setLoading(false); return; }

      // Try members
      const { data: member } = await supabase
        .from("members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      setGroupId(member?.group_id ?? null);
      setLoading(false);
    };

    fetch();
  }, [user]);

  return { groupId, loading };
}
