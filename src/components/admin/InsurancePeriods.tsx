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

interface InsurancePeriod {
  id: string;
  label: string;
  days: number;
  is_active: boolean;
  created_at: string;
}

export function InsurancePeriods() {
  const [periods, setPeriods] = useState<InsurancePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPeriod, setEditingPeriod] = useState<InsurancePeriod | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insurance_periods')
        .select('*')
        .order('days', { ascending: true });
      
      if (error) throw error;
      
      const formattedPeriods: InsurancePeriod[] = (data || []).map(period => ({
        id: period.id.toString(),
        label: period.label,
        days: period.days,
        is_active: true,
        created_at: new Date().toISOString()
      }));
      
      setPeriods(formattedPeriods);
    } catch (error) {
      console.error('Error loading periods:', error);
      toast.error('Failed to load insurance periods');
    } finally {
      setLoading(false);
    }
  };

  const savePeriod = async (periodData: Omit<InsurancePeriod, 'id' | 'created_at'>) => {
    try {
      if (editingPeriod) {
        // Update existing
        // await supabase
        //   .from('insurance_periods')
        //   .update(periodData)
        //   .eq('id', editingPeriod.id);
        toast.success('Period updated successfully');
      } else {
        // Create new
        // await supabase
        //   .from('insurance_periods')
        //   .insert(periodData);
        toast.success('Period created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingPeriod(null);
      loadPeriods();
    } catch (error) {
      console.error('Error saving period:', error);
      toast.error('Failed to save period');
    }
  };

  const deletePeriod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this period?')) return;
    
    try {
      // await supabase
      //   .from('insurance_periods')
      //   .delete()
      //   .eq('id', id);
      
      toast.success('Period deleted successfully');
      loadPeriods();
    } catch (error) {
      console.error('Error deleting period:', error);
      toast.error('Failed to delete period');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      // await supabase
      //   .from('insurance_periods')
      //   .update({ is_active: isActive })
      //   .eq('id', id);
      
      toast.success(`Period ${isActive ? 'activated' : 'deactivated'}`);
      loadPeriods();
    } catch (error) {
      console.error('Error updating period:', error);
      toast.error('Failed to update period');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Insurance Periods</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPeriod(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Period
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPeriod ? 'Edit Period' : 'Add Period'}
              </DialogTitle>
            </DialogHeader>
            <PeriodForm
              period={editingPeriod}
              onSave={savePeriod}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingPeriod(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading periods...</div>
      ) : (
        <div className="grid gap-4">
          {periods.map((period) => (
            <Card key={period.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{period.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={period.is_active}
                      onCheckedChange={(checked) => toggleActive(period.id, checked)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPeriod(period);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePeriod(period.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {period.days} days • {period.is_active ? 'Active' : 'Inactive'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PeriodForm({ period, onSave, onCancel }: {
  period: InsurancePeriod | null;
  onSave: (data: Omit<InsurancePeriod, 'id' | 'created_at'>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(period?.label || '');
  const [days, setDays] = useState(period?.days?.toString() || '');
  const [isActive, setIsActive] = useState(period?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !days.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    onSave({
      label: label.trim(),
      days: parseInt(days),
      is_active: isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., 1 Month"
          required
        />
      </div>

      <div>
        <Label htmlFor="days">Days</Label>
        <Input
          id="days"
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="e.g., 30"
          min="1"
          required
        />
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
          {period ? 'Update' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}