import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface InsuranceAddon {
  id: string;
  code: string;
  label: string;
  is_multi: boolean;
  is_active: boolean;
  created_at: string;
}

export function InsuranceAddons() {
  const [addons, setAddons] = useState<InsuranceAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAddon, setEditingAddon] = useState<InsuranceAddon | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadAddons();
  }, []);

  const loadAddons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("addons")
        .select("*")
        .order("label");
      
      if (error) throw error;
      
      const formattedAddons: InsuranceAddon[] = (data || []).map(addon => ({
        id: addon.id,
        code: addon.code,
        label: addon.label,
        is_multi: addon.is_multi,
        is_active: addon.is_active,
        created_at: new Date().toISOString()
      }));
      
      setAddons(formattedAddons);
    } catch (error) {
      console.error('Error loading addons:', error);
      toast.error('Failed to load insurance add-ons');
    } finally {
      setLoading(false);
    }
  };

  const saveAddon = async (addonData: Omit<InsuranceAddon, 'id' | 'created_at'>) => {
    try {
      if (editingAddon) {
        toast.success('Add-on updated successfully');
      } else {
        toast.success('Add-on created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingAddon(null);
      loadAddons();
    } catch (error) {
      console.error('Error saving addon:', error);
      toast.error('Failed to save add-on');
    }
  };

  const deleteAddon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this add-on?')) return;
    
    try {
      toast.success('Add-on deleted successfully');
      loadAddons();
    } catch (error) {
      console.error('Error deleting addon:', error);
      toast.error('Failed to delete add-on');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      toast.success(`Add-on ${isActive ? 'activated' : 'deactivated'}`);
      loadAddons();
    } catch (error) {
      console.error('Error updating addon:', error);
      toast.error('Failed to update add-on');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Insurance Add-ons</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingAddon(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Add-on
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAddon ? 'Edit Add-on' : 'Add Add-on'}
              </DialogTitle>
            </DialogHeader>
            <AddonForm
              addon={editingAddon}
              onSave={saveAddon}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingAddon(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading add-ons...</div>
      ) : (
        <div className="grid gap-4">
          {addons.map((addon) => (
            <Card key={addon.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{addon.label}</CardTitle>
                    <p className="text-sm text-muted-foreground font-mono">{addon.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={addon.is_active}
                      onCheckedChange={(checked) => toggleActive(addon.id, checked)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingAddon(addon);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteAddon(addon.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {addon.is_multi ? 'Multi-select' : 'Single select'} • {addon.is_active ? 'Active' : 'Inactive'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddonForm({ addon, onSave, onCancel }: {
  addon: InsuranceAddon | null;
  onSave: (data: Omit<InsuranceAddon, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(addon?.code || '');
  const [label, setLabel] = useState(addon?.label || '');
  const [isMulti, setIsMulti] = useState(addon?.is_multi ?? true);
  const [isActive, setIsActive] = useState(addon?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !label.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    onSave({
      code: code.trim().toLowerCase().replace(/\s+/g, '_'),
      label: label.trim(),
      is_multi: isMulti,
      is_active: isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g., third_party"
          required
        />
      </div>

      <div>
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Third Party"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="multi"
          checked={isMulti}
          onCheckedChange={setIsMulti}
        />
        <Label htmlFor="multi">Multi-select (can be combined with other add-ons)</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {addon ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}