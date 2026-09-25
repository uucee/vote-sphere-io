import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface PositionDraft {
  title: string;
  description: string;
  max_candidates: number;
  max_winners: number;
}

const ElectionCreate = () => {
  const navigate = useNavigate();
  const { groupId } = useGroupContext();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAdhoc, setIsAdhoc] = useState(false);
  const [nominationStart, setNominationStart] = useState("");
  const [nominationEnd, setNominationEnd] = useState("");
  const [votingStart, setVotingStart] = useState("");
  const [votingEnd, setVotingEnd] = useState("");

  const [positions, setPositions] = useState<PositionDraft[]>([
    { title: "", description: "", max_candidates: 5, max_winners: 1 },
  ]);

  const addPosition = () => setPositions([...positions, { title: "", description: "", max_candidates: 5, max_winners: 1 }]);
  const removePosition = (i: number) => setPositions(positions.filter((_, idx) => idx !== i));
  const updatePosition = (i: number, field: keyof PositionDraft, value: string | number) => {
    const updated = [...positions];
    (updated[i] as any)[field] = value;
    setPositions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !user) return;
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (positions.some((p) => !p.title.trim())) { toast.error("All positions need a title"); return; }

    setSaving(true);
    try {
      const { data: election, error } = await supabase
        .from("election_cycles")
        .insert({
          group_id: groupId,
          title: title.trim(),
          description: description.trim() || null,
          is_adhoc: isAdhoc,
          created_by: user.id,
          nomination_start: nominationStart || null,
          nomination_end: nominationEnd || null,
          voting_start: votingStart || null,
          voting_end: votingEnd || null,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      const posInserts = positions.map((p) => ({
        election_cycle_id: election.id,
        group_id: groupId,
        title: p.title.trim(),
        description: p.description.trim() || null,
        max_candidates: p.max_candidates,
        max_winners: p.max_winners,
        created_by: user.id,
      }));

      const { error: posErr } = await supabase.from("positions").insert(posInserts);
      if (posErr) throw posErr;

      toast.success("Election created successfully");
      navigate(`/group/elections/${election.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create election");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => navigate(-1)} className="flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Create Election</h1>
        <p className="text-sm text-muted-foreground">Set up a new election cycle with positions.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic info */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold">Election Details</h3>
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Board Elections 2026" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isAdhoc} onCheckedChange={setIsAdhoc} />
            <Label>Ad-hoc election (no fixed schedule)</Label>
          </div>
        </div>

        {/* Schedule */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold">Schedule</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nomination Start</Label>
              <Input type="datetime-local" value={nominationStart} onChange={(e) => setNominationStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nomination End</Label>
              <Input type="datetime-local" value={nominationEnd} onChange={(e) => setNominationEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Voting Start</Label>
              <Input type="datetime-local" value={votingStart} onChange={(e) => setVotingStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Voting End</Label>
              <Input type="datetime-local" value={votingEnd} onChange={(e) => setVotingEnd(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Positions */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Positions</h3>
            <Button type="button" variant="outline" size="sm" onClick={addPosition}>
              <Plus className="mr-1 h-3 w-3" /> Add Position
            </Button>
          </div>

          {positions.map((pos, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Position {i + 1}</span>
                {positions.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove position ${i + 1}`} onClick={() => removePosition(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={pos.title} onChange={(e) => updatePosition(i, "title", e.target.value)} placeholder="e.g. President" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={pos.description} onChange={(e) => updatePosition(i, "description", e.target.value)} placeholder="Role description…" rows={2} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Candidates (Top N)</Label>
                  <Input type="number" min={1} value={pos.max_candidates} onChange={(e) => updatePosition(i, "max_candidates", parseInt(e.target.value) || 1)} />
                </div>
                <div className="space-y-2">
                  <Label>Winners</Label>
                  <Input type="number" min={1} value={pos.max_winners} onChange={(e) => updatePosition(i, "max_winners", parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={saving}>{saving ? "Creating…" : "Create Election"}</Button>
        </div>
      </form>
    </div>
  );
};

export default ElectionCreate;
